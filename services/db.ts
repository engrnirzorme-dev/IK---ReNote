import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ChatMessage, FileGroup, LocalFile, URLGroup, Session } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Error signing in with Google", error);
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
};

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated");
  return uid;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const getSessionPath = (uid: string, sessionId: string) => {
    if (!sessionId) return `users/${uid}`;
    return sessionId === 'default' ? `users/${uid}` : `users/${uid}/sessions/${sessionId}`;
};

// --- Settings ---
export const saveSettingsToDB = async (settings: any) => {
  try {
    const uid = getUserId();
    const docRef = doc(db, `users/${uid}`);
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users/{uid}');
  }
};

export const loadSettingsFromDB = async (): Promise<any | null> => {
  try {
    const uid = getUserId();
    const docSnap = await getDoc(doc(db, `users/${uid}`));
    if (docSnap.exists()) return docSnap.data();
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users/{uid}');
    return null;
  }
};

// --- URL Groups ---
export const saveUrlGroupsToDB = async (groups: URLGroup[], sessionId: string = 'default') => {
  try {
    const uid = getUserId();
    const basePath = getSessionPath(uid, sessionId);
    const batch = writeBatch(db);
    
    for (const group of groups) {
      const docRef = doc(db, `${basePath}/urlGroups`, group.id);
      batch.set(docRef, {
        ...group,
        uid
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users/{uid}/urlGroups');
  }
};

export const loadUrlGroupsFromDB = async (sessionId: string = 'default'): Promise<URLGroup[] | null> => {
  try {
    const uid = getUserId();
    const basePath = getSessionPath(uid, sessionId);
    const snapshot = await getDocs(collection(db, `${basePath}/urlGroups`));
    if (snapshot.empty) return null;
    
    return snapshot.docs.map(docSnap => docSnap.data() as URLGroup);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users/{uid}/urlGroups');
    return null;
  }
};

// --- File Groups ---
export const saveFileGroupsToDB = async (groups: FileGroup[], sessionId: string = 'default') => {
    try {
      const uid = getUserId();
      const basePath = getSessionPath(uid, sessionId);
      const batch = writeBatch(db);
      
      for (const group of groups) {
        const docRef = doc(db, `${basePath}/fileGroups`, group.id);
        
        const serializedFiles = group.files.map(f => ({
          id: f.id,
          type: f.type,
          preview: f.preview || null,
          contentHash: f.contentHash || null
        }));
        
        batch.set(docRef, {
          id: group.id,
          name: group.name,
          files: serializedFiles,
          uid
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users/{uid}/fileGroups');
    }
};

export const loadFileGroupsFromDB = async (sessionId: string = 'default'): Promise<FileGroup[] | null> => {
    try {
        const uid = getUserId();
        const basePath = getSessionPath(uid, sessionId);
        const snapshot = await getDocs(collection(db, `${basePath}/fileGroups`));
        if (snapshot.empty) return null;
        
        return snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: data.id,
                name: data.name,
                files: data.files.map((f: any) => ({
                    ...f,
                    file: new File([], "restored-from-db")
                }))
            } as FileGroup;
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'users/{uid}/fileGroups');
        return null;
    }
};

// --- Selections ---
export const saveSelectionsToDB = async (urls: string[], fileIds: string[], sessionId: string = 'default') => {
  try {
    const uid = getUserId();
    const basePath = getSessionPath(uid, sessionId);
    const docRef = doc(db, basePath);
    await setDoc(docRef, { selectedUrls: urls, selectedFileIds: fileIds, uid }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users/{uid}');
  }
};

export const loadSelectionsFromDB = async (sessionId: string = 'default'): Promise<any | null> => {
  try {
    const uid = getUserId();
    const basePath = getSessionPath(uid, sessionId);
    const docSnap = await getDoc(doc(db, basePath));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { urls: data.selectedUrls || [], fileIds: data.selectedFileIds || [] };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users/{uid}');
    return null;
  }
};

// --- Notes ---
export const saveNotesToDB = async (notes: any[], sessionId: string = 'default') => {
  try {
    const uid = getUserId();
    const basePath = getSessionPath(uid, sessionId);
    const batch = writeBatch(db);
    
    for (const note of notes) {
      const docRef = doc(db, `${basePath}/notes`, note.id);
      batch.set(docRef, {
        ...note,
        uid,
        timestamp: note.timestamp.toISOString()
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users/{uid}/notes');
  }
};

export const loadNotesFromDB = async (sessionId: string = 'default'): Promise<any[] | null> => {
  try {
    const uid = getUserId();
    const basePath = getSessionPath(uid, sessionId);
    const snapshot = await getDocs(collection(db, `${basePath}/notes`));
    if (snapshot.empty) return null;
    
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        timestamp: new Date(data.timestamp)
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users/{uid}/notes');
    return null;
  }
};

// --- Chat History ---
export const saveChatHistoryToDB = async (messages: ChatMessage[], sessionId: string = 'default') => {
  try {
    const uid = getUserId();
    const basePath = getSessionPath(uid, sessionId);
    const batch = writeBatch(db);
        
    for (const msg of messages) {
      const docRef = doc(db, `${basePath}/chatHistory`, msg.id);
      batch.set(docRef, {
        uid,
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp.toISOString(),
        urlContext: msg.urlContext ? JSON.stringify(msg.urlContext) : null,
        suggestedActions: msg.suggestedActions || [],
        discoveredResources: msg.discoveredResources ? JSON.stringify(msg.discoveredResources) : null,
        comparisonData: msg.comparisonData ? JSON.stringify(msg.comparisonData) : null
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users/{uid}/chatHistory');
  }
};

export const loadChatHistoryFromDB = async (sessionId: string = 'default'): Promise<ChatMessage[] | null> => {
  try {
    const uid = getUserId();
    const basePath = getSessionPath(uid, sessionId);
    const snapshot = await getDocs(collection(db, `${basePath}/chatHistory`));
    if (snapshot.empty) return null;
        
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: data.id,
        text: data.text,
        sender: data.sender,
        timestamp: new Date(data.timestamp),
        urlContext: data.urlContext ? JSON.parse(data.urlContext) : undefined,
        suggestedActions: data.suggestedActions,
        discoveredResources: data.discoveredResources ? JSON.parse(data.discoveredResources) : undefined,
        comparisonData: data.comparisonData ? JSON.parse(data.comparisonData) : undefined
      } as ChatMessage;
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users/{uid}/chatHistory');
    return null;
  }
};

// --- Sessions ---
export const saveSessionsToDB = async (sessions: Session[]) => {
  try {
    const uid = getUserId();
    const batch = writeBatch(db);
    for (const session of sessions) {
      const docRef = doc(db, `users/${uid}/sessions_meta`, session.id);
      batch.set(docRef, {
        ...session,
        uid,
        lastAccessed: session.lastAccessed // String format as updated in types.ts
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users/{uid}/sessions_meta');
  }
};

export const loadSessionsFromDB = async (): Promise<Session[] | null> => {
  try {
    const uid = getUserId();
    const snapshot = await getDocs(collection(db, `users/${uid}/sessions_meta`));
    if (snapshot.empty) return null;
    
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: data.id,
        name: data.name,
        lastAccessed: data.lastAccessed
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users/{uid}/sessions_meta');
    return null;
  }
};

export const deleteSessionFromDB = async (sessionId: string) => {
    try {
        const uid = getUserId();
        const basePath = getSessionPath(uid, sessionId);
        
        const deleteCollection = async (path: string) => {
            const snapshot = await getDocs(collection(db, path));
            const batch = writeBatch(db);
            snapshot.docs.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();
        };
        
        await deleteCollection(`${basePath}/urlGroups`);
        await deleteCollection(`${basePath}/fileGroups`);
        await deleteCollection(`${basePath}/chatHistory`);
        await deleteCollection(`${basePath}/notes`);
        
        if (sessionId !== 'default') {
          await deleteDoc(doc(db, basePath));
        }
        await deleteDoc(doc(db, `users/${uid}/sessions_meta`, sessionId));
        return true;
    } catch (e) {
        console.error("Failed to delete session", e);
        return false;
    }
}

export const clearDB = async (sessionId: string = 'default') => {
    try {
        const uid = getUserId();
        const basePath = getSessionPath(uid, sessionId);
        
        const deleteCollection = async (path: string) => {
            const snapshot = await getDocs(collection(db, path));
            const batch = writeBatch(db);
            snapshot.docs.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();
        };
        
        await deleteCollection(`${basePath}/urlGroups`);
        await deleteCollection(`${basePath}/fileGroups`);
        await deleteCollection(`${basePath}/chatHistory`);
        await deleteCollection(`${basePath}/notes`);
        
        if (sessionId === 'default') {
          // Just clear data, don't delete settings document
        } else {
          await deleteDoc(doc(db, basePath));
        }
        return true;
    } catch (e) {
        console.error("Failed to clear DB", e);
        return false;
    }
}

// --- Backup & Restore Utilities ---
// Helper to convert File to Base64 for JSON export
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// Helper to convert Base64 back to File
const base64ToFile = async (base64: string, fileName: string, mimeType: string): Promise<File> => {
    const res = await fetch(base64);
    const blob = await res.blob();
    return new File([blob], fileName, { type: mimeType });
};

export const exportDatabase = async (sessionId: string = 'default'): Promise<string> => {
    const urlGroups = await loadUrlGroupsFromDB(sessionId);
    const fileGroups = await loadFileGroupsFromDB(sessionId);
    const settings = await loadSettingsFromDB();
    const selections = await loadSelectionsFromDB(sessionId);
    const chatHistory = await loadChatHistoryFromDB(sessionId);

    let serializedFileGroups: any[] = [];
    if (fileGroups && Array.isArray(fileGroups)) {
        serializedFileGroups = await Promise.all(fileGroups.map(async (group: FileGroup) => {
            const serializedFiles = await Promise.all(group.files.map(async (f: LocalFile) => {
                const base64 = await fileToBase64(f.file);
                return {
                    ...f,
                    file: {
                        name: f.file.name,
                        type: f.file.type,
                        lastModified: f.file.lastModified,
                        data: base64
                    }
                };
            }));
            return { ...group, files: serializedFiles };
        }));
    }

    const backupData = {
        timestamp: new Date().toISOString(),
        version: 1,
        data: {
            urlGroups,
            fileGroups: serializedFileGroups,
            settings,
            selections,
            chatHistory
        }
    };
    return JSON.stringify(backupData, null, 2);
};

export const importDatabase = async (jsonString: string, sessionId: string = 'default'): Promise<boolean> => {
    try {
        const parsed = JSON.parse(jsonString);
        if (!parsed.data) throw new Error("Invalid backup file format");
        const { urlGroups, fileGroups, settings, selections, chatHistory } = parsed.data;

        if (urlGroups) await saveUrlGroupsToDB(urlGroups, sessionId);

        if (fileGroups && Array.isArray(fileGroups)) {
            const restoredFileGroups = await Promise.all(fileGroups.map(async (group: any) => {
                const restoredFiles = await Promise.all(group.files.map(async (f: any) => {
                    const fileObj = await base64ToFile(f.file.data, f.file.name, f.file.type);
                    return {
                        ...f,
                        file: fileObj
                    } as LocalFile;
                }));
                return { ...group, files: restoredFiles };
            }));
            await saveFileGroupsToDB(restoredFileGroups, sessionId);
        }

        if (settings) await saveSettingsToDB(settings);
        
        if (selections) {
            await saveSelectionsToDB(selections.urls || [], selections.fileIds || [], sessionId);
        }

        if (chatHistory && Array.isArray(chatHistory)) {
            const rehydratedChat = chatHistory.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            }));
            await saveChatHistoryToDB(rehydratedChat, sessionId);
        }
        return true;
    } catch (e) {
        console.error("Import failed:", e);
        return false;
    }
};
