

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChatMessage, MessageSender, URLGroup, VoiceSettings, LocalFile, FileGroup, AIModel, ThinkingLevel, Note, Session } from './types';
import { generateContentWithUrlContext, getInitialSuggestions, getFollowUpSuggestions, discoverResources, generateComparison, generateAudioOverview } from './services/geminiService';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import ChatInterface from './components/ChatInterface';
import { translations, Language } from './translations';
import { saveUrlGroupsToDB, loadUrlGroupsFromDB, 
    saveFileGroupsToDB, loadFileGroupsFromDB, 
    saveSettingsToDB, loadSettingsFromDB,
    saveSelectionsToDB, loadSelectionsFromDB,
    saveChatHistoryToDB, loadChatHistoryFromDB,
    saveNotesToDB, loadNotesFromDB,
    loadSessionsFromDB, saveSessionsToDB, deleteSessionFromDB
} from './services/db';
import { auth, loginWithGoogle, logout } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LogIn, LogOut, ChevronDown, Plus, Trash2, Edit2, Check, X, FolderKanban } from 'lucide-react';

const INITIAL_URL_GROUPS: URLGroup[] = [];

// Helper to generate SHA-256 Hash for file content deduplication
const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper to normalize URLs for duplicate detection (removes trailing slash, query params etc usually)
const normalizeUrl = (url: string): string => {
    try {
        const u = new URL(url);
        // We keep origin and pathname. We could optionally strip query params if tracking is an issue.
        // For docs, query params might change language, so we keep them, but we strip trailing slash.
        return (u.origin + u.pathname).replace(/\/$/, '') + u.search; 
    } catch (e) {
        return url;
    }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [urlGroups, setUrlGroups] = useState<URLGroup[]>(INITIAL_URL_GROUPS);
  
  // URL State
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(() => {
    const allUrls = INITIAL_URL_GROUPS.flatMap(group => group.urls);
    return new Set(allUrls);
  });
  
  // File State (Grouped)
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('bn'); 
  
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    speed: 1.0,
    voiceURI: null
  });

  const [aiModel, setAiModel] = useState<AIModel>('auto');
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [initialQuerySuggestions, setInitialQuerySuggestions] = useState<string[]>([]);
  
  // Loading state for DB
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isGeneratingAudioOverview, setIsGeneratingAudioOverview] = useState(false);
  const [audioOverviewUrl, setAudioOverviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);

  const [sessions, setSessions] = useState<Session[]>([{ id: 'default', name: 'Default Workspace', lastAccessed: new Date().toISOString() }]);
  const [activeSessionId, setActiveSessionId] = useState<string>('default');
  const [isSessionListOpen, setIsSessionListOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionEditName, setSessionEditName] = useState('');


  const MAX_URLS = 100; 

  const currentUrlsForChat = useMemo(() => Array.from(selectedUrls), [selectedUrls]);
  
  const currentFilesForChat = useMemo(() => {
    const allFiles = fileGroups.flatMap(g => g.files);
    return allFiles.filter(f => selectedFileIds.has(f.id));
  }, [fileGroups, selectedFileIds]);

  const t = translations[language];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) {
        setIsDbLoaded(false);
        setUrlGroups(INITIAL_URL_GROUPS);
        setFileGroups([]);
        setChatMessages([]);
        setSelectedUrls(new Set(INITIAL_URL_GROUPS.flatMap(group => group.urls)));
        setSelectedFileIds(new Set());
      }
    });
    return () => unsubscribe();
  }, []);

  const loadSessionData = useCallback(async (sessionId: string) => {
    setIsDbLoaded(false);
    try {
        const [savedUrls, savedFiles, savedSelections, savedChat, savedNotes] = await Promise.all([
            loadUrlGroupsFromDB(sessionId),
            loadFileGroupsFromDB(sessionId),
            loadSelectionsFromDB(sessionId),
            loadChatHistoryFromDB(sessionId),
            loadNotesFromDB(sessionId)
        ]);

        if (savedUrls && Array.isArray(savedUrls) && savedUrls.length > 0) {
            setUrlGroups(savedUrls);
        } else {
            setUrlGroups(INITIAL_URL_GROUPS);
        }

        if (savedFiles && Array.isArray(savedFiles) && savedFiles.length > 0) {
            setFileGroups(savedFiles);
        } else {
            setFileGroups([]);
        }

        if (savedSelections) {
            if (savedSelections.urls) setSelectedUrls(new Set(savedSelections.urls as string[]));
            if (savedSelections.fileIds) setSelectedFileIds(new Set(savedSelections.fileIds as string[]));
        } else {
            setSelectedUrls(new Set(INITIAL_URL_GROUPS.flatMap(group => group.urls)));
            setSelectedFileIds(new Set());
        }

        if (savedChat && Array.isArray(savedChat)) {
            setChatMessages(savedChat);
        } else {
            setChatMessages([]);
        }

        if (savedNotes && Array.isArray(savedNotes)) {
            setNotes(savedNotes);
        } else {
            setNotes([]);
        }
    } catch (e) {
        console.error("Failed to load session data", e);
    } finally {
        setIsDbLoaded(true);
    }
  }, []);

  // --- PERSISTENCE: LOAD ON MOUNT ---
  useEffect(() => {
      if (!isAuthReady || !user) return;

      const initDB = async () => {
          try {
              // Load global settings
              const savedSettings = await loadSettingsFromDB();
              let currentActiveSession = 'default';
              if (savedSettings) {
                  if (savedSettings.language) setLanguage(savedSettings.language);
                  if (savedSettings.voiceSettings) setVoiceSettings(savedSettings.voiceSettings);
                  if (savedSettings.aiModel) setAiModel(savedSettings.aiModel);
                  if (savedSettings.activeSessionId) currentActiveSession = savedSettings.activeSessionId;
              }

              // Load sessions list
              let savedSessions = await loadSessionsFromDB();
              if (savedSessions && savedSessions.length > 0) {
                  setSessions(savedSessions);
                  // Ensure activeSession exists in the list
                  if (!savedSessions.find((s) => s.id === currentActiveSession)) {
                      currentActiveSession = savedSessions[0].id;
                  }
              } else {
                  // Initialize default session if no sessions exist
                  const defaultSession = { id: 'default', name: 'Default Workspace', lastAccessed: new Date().toISOString() };
                  await saveSessionsToDB([defaultSession]);
                  setSessions([defaultSession]);
                  currentActiveSession = 'default';
              }
              
              setActiveSessionId(currentActiveSession);
              await loadSessionData(currentActiveSession);
          } catch (e) {
              console.error("Failed to init db", e);
              setIsDbLoaded(true);
          }
      };
      initDB();
  }, [isAuthReady, user, loadSessionData]);

  // --- PERSISTENCE: SAVE ON CHANGE ---
  const isInitialMount = useRef(true);

  useEffect(() => {
      if (!isDbLoaded) return;
      if (isInitialMount.current) { isInitialMount.current = false; return; }
      saveUrlGroupsToDB(urlGroups, activeSessionId);
  }, [urlGroups, isDbLoaded, activeSessionId]);

  useEffect(() => {
      if (!isDbLoaded) return;
      saveFileGroupsToDB(fileGroups, activeSessionId);
  }, [fileGroups, isDbLoaded, activeSessionId]);

  useEffect(() => {
      if (!isDbLoaded) return;
      saveSettingsToDB({ language, voiceSettings, aiModel, activeSessionId });
  }, [language, voiceSettings, aiModel, activeSessionId, isDbLoaded]);

  useEffect(() => {
      if (!isDbLoaded) return;
      saveSelectionsToDB(Array.from(selectedUrls), Array.from(selectedFileIds), activeSessionId);
  }, [selectedUrls, selectedFileIds, isDbLoaded, activeSessionId]);
  
  useEffect(() => {
      if (!isDbLoaded) return;
      if (chatMessages.length > 0) {
          saveChatHistoryToDB(chatMessages, activeSessionId);
      }
  }, [chatMessages, isDbLoaded, activeSessionId]);

  const handleCreateSession = async () => {
    const newSessionId = Date.now().toString();
    const newSession = {
      id: newSessionId,
      name: `New Workspace ${sessions.length + 1}`,
      lastAccessed: new Date().toISOString()
    };
    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    saveSessionsToDB(updatedSessions);
    setActiveSessionId(newSessionId);
    await loadSessionData(newSessionId); // Will load empty defaults
  };

  const handleSwitchSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    
    // Update last accessed
    const updatedSessions = sessions.map(s => 
      s.id === sessionId ? { ...s, lastAccessed: new Date().toISOString() } : s
    );
    setSessions(updatedSessions);
    saveSessionsToDB(updatedSessions);
    
    setActiveSessionId(sessionId);
    await loadSessionData(sessionId);
  };
  
  const handleRenameSession = async (sessionId: string, newName: string) => {
      if (!newName.trim()) return;
      const updatedSessions = sessions.map(s => 
          s.id === sessionId ? { ...s, name: newName.trim() } : s
      );
      setSessions(updatedSessions);
      saveSessionsToDB(updatedSessions);
      setEditingSessionId(null);
  };
  
  const handleDeleteSession = async (sessionId: string) => {
      if (sessions.length <= 1) return; // Cannot delete last session
      
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(updatedSessions);
      await deleteSessionFromDB(sessionId);
      
      if (activeSessionId === sessionId) {
          const nextSession = updatedSessions[0].id;
          setActiveSessionId(nextSession);
          await loadSessionData(nextSession);
      }
  };

  // Handle Welcome Message
   useEffect(() => {
    if (!isDbLoaded) return;
    
    // Only show welcome if NO chat history exists
    if (chatMessages.length > 0) return;

    const apiKey = process.env.API_KEY;
    const count = selectedUrls.size;
    const welcomeMessageText = !apiKey 
        ? t.errorApiKey
        : t.welcomeBody(count);
    
    setChatMessages([{
        id: `system-welcome-${Date.now()}`,
        text: welcomeMessageText,
        sender: MessageSender.SYSTEM,
        timestamp: new Date(),
    }]);
  }, [isDbLoaded]); // Removed dependencies that trigger re-render loops

  const fetchAndSetInitialSuggestions = useCallback(async (currentUrls: string[], lang: Language, model: AIModel) => {
    setIsFetchingSuggestions(true);
    setInitialQuerySuggestions([]); 
    try {
      // Pass file count as a hint if files exist, though we mainly use URLs for topic extraction in the current service
      const response = await getInitialSuggestions(currentUrls, lang, model); 
      let suggestionsArray: string[] = [];
      if (response.text) {
        try {
          let jsonStr = response.text.trim();
          const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; 
          const match = jsonStr.match(fenceRegex);
          if (match && match[2]) jsonStr = match[2].trim();
          const parsed = JSON.parse(jsonStr);
          if (parsed && Array.isArray(parsed.suggestions)) {
            suggestionsArray = (parsed.suggestions as any[]).filter((s: unknown): s is string => typeof s === 'string');
          }
        } catch (parseError) {
          console.warn("Failed to parse suggestions JSON:", parseError);
        }
      }
      setInitialQuerySuggestions(suggestionsArray.slice(0, 4)); 
    } catch (e: any) {
      console.error('Failed to fetch initial suggestions', e);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, []); 

  // Handle Initial Suggestions (Separated to ensure it runs even if welcome message exists)
  useEffect(() => {
    if (!isDbLoaded || !process.env.API_KEY) return;
    
    // Allow fetching suggestions if chat is empty OR only has the welcome message (length <= 1)
    if (chatMessages.length > 1) return;

    if (selectedUrls.size > 0 || selectedFileIds.size > 0) {
        const timer = setTimeout(() => {
            fetchAndSetInitialSuggestions(Array.from(selectedUrls).slice(0, 10) as string[], language, aiModel); 
        }, 1000);
        return () => clearTimeout(timer);
    }
  }, [isDbLoaded, selectedUrls.size, selectedFileIds.size, language, chatMessages.length, aiModel, fetchAndSetInitialSuggestions]);

  // --- URL Management ---
  const handleAddUrlToGroup = (url: string, targetGroupId: string | null, newGroupName: string | null) => {
    handleAddBulkUrlsToGroup([url], targetGroupId, newGroupName);
  };

  const handleAddBulkUrlsToGroup = (urlsToAdd: string[], targetGroupId: string | null, newGroupName: string | null) => {
      // 1. Handle New Group Creation
      let effectiveTargetGroupId = targetGroupId;
      
      if (newGroupName) {
          const newId = `group-${Date.now()}`;
          const newGroup: URLGroup = {
              id: newId,
              name: newGroupName,
              urls: []
          };
          setUrlGroups(prev => [...prev, newGroup]);
          effectiveTargetGroupId = newId;
      }
      
      // 2. Add URLs to the effective target group
      // Ensure effectiveTargetGroupId exists in urlGroups, otherwise clear it
      if (effectiveTargetGroupId && !urlGroups.some(g => g.id === effectiveTargetGroupId)) {
          effectiveTargetGroupId = null;
      }

      if (!effectiveTargetGroupId && !newGroupName) {
          if (urlGroups.length > 0) {
              effectiveTargetGroupId = urlGroups[0].id;
          } else {
              const newId = `group-${Date.now()}`;
              setUrlGroups(prev => [...prev, { id: newId, name: 'Default', urls: [] }]);
              effectiveTargetGroupId = newId;
          }
      }

      if (effectiveTargetGroupId) {
          setUrlGroups(prevGroups => 
              prevGroups.map(group => {
                if (group.id === effectiveTargetGroupId) {
                   const groupNormalized = new Set(group.urls.map(u => normalizeUrl(u)));
                   const newUrls = urlsToAdd.filter(u => !groupNormalized.has(normalizeUrl(u)));
                   
                   if (newUrls.length > 0) {
                       setSelectedUrls(prev => {
                           const next = new Set(prev);
                           newUrls.forEach(u => next.add(u));
                           return next;
                       });
                       return { ...group, urls: [...group.urls, ...newUrls] };
                   }
                }
                return group;
              })
            );
      }
  };

  const handleAddDiscoveredResources = (urls: string[], groupId: string | null, newGroupName: string | null) => {
     handleAddBulkUrlsToGroup(urls, groupId, newGroupName);
  };

  const handleRemoveUrl = (urlToRemove: string) => {
    setUrlGroups(prevGroups =>
      prevGroups.map(group => {
        return { ...group, urls: group.urls.filter(url => url !== urlToRemove) };
      })
    );
    setSelectedUrls(prev => {
        const next = new Set(prev);
        next.delete(urlToRemove);
        return next;
    });
  };

  const handleToggleUrl = (url: string) => {
      setSelectedUrls(prev => {
          const next = new Set(prev);
          if (next.has(url)) next.delete(url);
          else next.add(url);
          return next;
      });
  };

  const handleToggleGroup = (groupUrls: string[], shouldSelect: boolean) => {
      setSelectedUrls(prev => {
          const next = new Set(prev);
          groupUrls.forEach(url => {
              if (shouldSelect) next.add(url);
              else next.delete(url);
          });
          return next;
      });
  };

  // --- File Management ---
  const handleUploadFiles = async (files: File[], targetGroupId: string | null, newGroupName: string | null) => {
      // 1. Prepare Files with IDs, Preview, Hash
      const processedFiles: LocalFile[] = await Promise.all(files.map(async (f) => {
          const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const hash = await generateFileHash(f);
          let type: 'image' | 'pdf' | 'text' = 'text';
          let preview: string | undefined = undefined;

          if (f.type.startsWith('image/')) {
              type = 'image';
              preview = URL.createObjectURL(f);
          } else if (f.type === 'application/pdf') {
              type = 'pdf';
          } else {
              type = 'text';
              // Generate snippet preview
              const text = await f.text();
              preview = text.substring(0, 100) + (text.length > 100 ? '...' : '');
          }

          return { id, file: f, type, preview, contentHash: hash };
      }));

      // Deduplicate against ALL files in ALL groups
      const existingHashes = new Set(fileGroups.flatMap(g => g.files).map(f => f.contentHash));
      const uniqueFiles = processedFiles.filter(f => {
          if (existingHashes.has(f.contentHash)) {
              console.warn(t.duplicateFileWarning, f.file.name);
              return false;
          }
          return true;
      });

      if (uniqueFiles.length === 0) return;

      // 2. Handle Grouping
      let effectiveTargetGroupId = targetGroupId;
      if (newGroupName) {
          const newId = `fgroup-${Date.now()}`;
          setFileGroups(prev => [...prev, { id: newId, name: newGroupName, files: [] }]);
          effectiveTargetGroupId = newId;
      }

      // Ensure effectiveTargetGroupId exists in fileGroups, otherwise clear it
      if (effectiveTargetGroupId && !fileGroups.some(g => g.id === effectiveTargetGroupId)) {
          effectiveTargetGroupId = null;
      }

      if (!effectiveTargetGroupId && !newGroupName) {
          if (fileGroups.length > 0) {
              effectiveTargetGroupId = fileGroups[0].id;
          } else {
              const newId = `fgroup-${Date.now()}`;
              setFileGroups(prev => [...prev, { id: newId, name: 'General Files', files: [] }]);
              effectiveTargetGroupId = newId;
          }
      }

      if (effectiveTargetGroupId) {
          setFileGroups(prev => prev.map(g => {
              if (g.id === effectiveTargetGroupId) {
                  return { ...g, files: [...g.files, ...uniqueFiles] };
              }
              return g;
          }));
          
          // Auto-select uploaded files
          setSelectedFileIds(prev => {
              const next = new Set(prev);
              uniqueFiles.forEach(f => next.add(f.id));
              return next;
          });
      }
  };

  const handleRemoveFile = (id: string) => {
      setFileGroups(prev => prev.map(g => ({
          ...g,
          files: g.files.filter(f => f.id !== id)
      })));
      setSelectedFileIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
      });
  };

  const handleToggleFile = (id: string) => {
      setSelectedFileIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const handleToggleFileGroup = (groupId: string, shouldSelect: boolean) => {
      const group = fileGroups.find(g => g.id === groupId);
      if (group) {
          setSelectedFileIds(prev => {
              const next = new Set(prev);
              group.files.forEach(f => {
                  if (shouldSelect) next.add(f.id);
                  else next.delete(f.id);
              });
              return next;
          });
      }
  };

  const handleMoveFiles = (fileIds: string[], targetGroupId: string) => {
     // Find files to move
     const filesToMove: LocalFile[] = [];
     const newGroups = fileGroups.map(g => {
         const remaining = g.files.filter(f => {
             if (fileIds.includes(f.id)) {
                 filesToMove.push(f);
                 return false;
             }
             return true;
         });
         return { ...g, files: remaining };
     });

     // Add to target
     setFileGroups(newGroups.map(g => {
         if (g.id === targetGroupId) {
             return { ...g, files: [...g.files, ...filesToMove] };
         }
         return g;
     }));
     
     // Reset selection or keep? Keeping selection logic is usually expected.
  };

  const handleDeleteFileGroup = (groupId: string) => {
      if (fileGroups.length <= 1) {
          alert("Cannot delete the last group.");
          return;
      }
      // Remove group and its files
      setFileGroups(prev => prev.filter(g => g.id !== groupId));
      // Cleanup selection
      // (Optional: could re-verify selections)
  };

  const handleRenameFileGroup = (groupId: string, newName: string) => {
      setFileGroups(prev => prev.map(g => {
          if (g.id === groupId) {
              return { ...g, name: newName };
          }
          return g;
      }));
  };

  // Duplicate Scan
  const handleScanDuplicates = () => {
      let removedCount = 0;
      
      // Deduplicate URLs
      setUrlGroups(prevGroups => {
         const seen = new Set<string>();
         return prevGroups.map(g => {
             const uniqueUrls = g.urls.filter(u => {
                 const norm = normalizeUrl(u);
                 if (seen.has(norm)) {
                     removedCount++;
                     return false;
                 }
                 seen.add(norm);
                 return true;
             });
             return { ...g, urls: uniqueUrls };
         });
      });

      // Deduplicate Files
      setFileGroups(prevGroups => {
          const seenHashes = new Set<string>();
          return prevGroups.map(g => {
              const uniqueFiles = g.files.filter(f => {
                  if (f.contentHash && seenHashes.has(f.contentHash)) {
                      removedCount++;
                      // Also remove from selectedFileIds
                      setSelectedFileIds(prev => {
                          const next = new Set(prev);
                          next.delete(f.id);
                          return next;
                      });
                      return false;
                  }
                  if (f.contentHash) {
                      seenHashes.add(f.contentHash);
                  }
                  return true;
              });
              return { ...g, files: uniqueFiles };
          });
      });

      return removedCount;
  };

  const handleGenerateAudioOverview = async () => {
    if (currentUrlsForChat.length === 0 && currentFilesForChat.length === 0) {
      alert(language === 'bn' ? 'দয়া করে প্রথমে কিছু ডকুমেন্ট সিলেক্ট করুন।' : 'Please select some documents first.');
      return;
    }

    setIsGeneratingAudioOverview(true);
    try {
      const url = await generateAudioOverview(currentUrlsForChat, currentFilesForChat, language);
      setAudioOverviewUrl(url);
    } catch (error) {
      console.error("Audio Overview Error:", error);
      alert(t.audioOverviewError);
    } finally {
      setIsGeneratingAudioOverview(false);
    }
  };

  const handleSaveNote = useCallback((title: string, content: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      title,
      content,
      timestamp: new Date()
    };
    setNotes(prev => {
      const updated = [newNote, ...prev];
      saveNotesToDB(updated);
      return updated;
    });
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveNotesToDB(updated);
      return updated;
    });
  }, []);

  const handleUpdateNote = useCallback((id: string, content: string) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, content, timestamp: new Date() } : n);
      saveNotesToDB(updated);
      return updated;
    });
  }, []);

  // --- Chat ---
  const handleSendMessage = async (query: string, mode: 'chat' | 'research' | 'compare') => {
    if (!query.trim()) return;

    // If this is the first real message, clear the welcome message to clean up UI
    // unless we want to keep it. Usually chat apps keep it until scrolled out.
    // But for our "empty state suggestions" logic, having 2 messages means not empty.
    // That is handled by useEffect.
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text: query,
      sender: MessageSender.USER,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    try {
      let responseText = '';
      let urlContextData: any[] | undefined;
      let discoveredResources: any[] | undefined;
      let comparisonData: any | undefined;
      
      const activeUrls = Array.from(selectedUrls) as string[];

      if (mode === 'research') {
          const result = await discoverResources(query, language, aiModel);
          responseText = result.text;
          discoveredResources = result.discoveredResources;
      } else if (mode === 'compare') {
          const result = await generateComparison(query, activeUrls, language, currentFilesForChat, aiModel);
          responseText = result.text;
          comparisonData = result.comparisonData;
          urlContextData = result.urlContextMetadata;
      } else {
          // Normal Chat
          const thinkingLevel = isThinkingMode ? ThinkingLevel.HIGH : undefined;
          const response = await generateContentWithUrlContext(query, activeUrls, language, currentFilesForChat, aiModel, thinkingLevel, useMaps);
          responseText = response.text;
          urlContextData = response.urlContextMetadata;
          discoveredResources = response.discoveredResources;
      }

      // Get Follow-up suggestions
      let suggestions: string[] = [];
      if (mode === 'chat') {
         suggestions = await getFollowUpSuggestions(query, responseText, language);
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: MessageSender.MODEL,
        timestamp: new Date(),
        urlContext: urlContextData,
        suggestedActions: suggestions,
        discoveredResources: discoveredResources,
        comparisonData: comparisonData
      };

      setChatMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        sender: MessageSender.MODEL,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQueryClick = (query: string) => {
      handleSendMessage(query, 'chat');
  };

  // --- RENDER ---
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#1E1E1E] flex items-center justify-center text-[#E2E2E2]">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1E1E1E] flex flex-col items-center justify-center text-[#E2E2E2] p-4">
        <div className="max-w-md w-full bg-[#252525] border border-white/[.1] rounded-xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#79B8FF]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <LogIn size={32} className="text-[#79B8FF]" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome to IK - ReNote</h1>
          <p className="text-[#A8ABB4] mb-8">Please sign in to access your knowledge base and chat history.</p>
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#1E1E1E] text-[#E2E2E2] font-sans overflow-hidden selection:bg-[#79B8FF] selection:text-[#1E1E1E]">
      {/* Sidebar (Desktop: Static, Mobile: Absolute/Overlay) */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-80 bg-[#1E1E1E] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 border-r border-[rgba(255,255,255,0.05)] flex flex-col
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        {/* Workspace Manager */}
        <div className="relative border-b border-white/[.05] shrink-0">
          <button 
            onClick={() => setIsSessionListOpen(!isSessionListOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/[.02] transition-colors"
          >
            <div className="flex items-center gap-2 overflow-hidden text-[#E2E2E2]">
              <FolderKanban size={18} className="text-[#79B8FF] shrink-0" />
              <span className="font-medium truncate">
                {sessions.find(s => s.id === activeSessionId)?.name || 'Default Workspace'}
              </span>
            </div>
            <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isSessionListOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isSessionListOpen && (
            <div className="absolute top-full left-0 right-0 bg-[#252525] border-b border-white/[.05] shadow-xl z-50 max-h-60 overflow-y-auto">
              <div className="p-2 space-y-1">
                {sessions.map(session => (
                  <div key={session.id} className={`group flex items-center justify-between p-2 rounded-lg transition-colors ${activeSessionId === session.id ? 'bg-[#79B8FF]/10 text-[#79B8FF]' : 'text-gray-300 hover:bg-white/[.02]'}`}>
                    {editingSessionId === session.id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input 
                          type="text" 
                          value={sessionEditName}
                          onChange={(e) => setSessionEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSession(session.id, sessionEditName);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          className="flex-1 bg-[#1E1E1E] text-white border border-white/[.1] rounded px-2 py-1 text-sm outline-none focus:border-[#79B8FF]"
                          autoFocus
                          onBlur={() => setEditingSessionId(null)}
                        />
                      </div>
                    ) : (
                      <button 
                        onClick={() => { handleSwitchSession(session.id); setIsSessionListOpen(false); }}
                        className="flex-1 text-left truncate text-sm"
                      >
                        {session.name}
                      </button>
                    )}
                    
                    {editingSessionId !== session.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setSessionEditName(session.name); }}
                          className="p-1 hover:bg-white/[.1] rounded text-gray-400 hover:text-white"
                          title="Rename"
                        >
                          <Edit2 size={14} />
                        </button>
                        {sessions.length > 1 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                            className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-white/[.05]">
                <button 
                  onClick={() => { handleCreateSession(); setIsSessionListOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-white/[.05] hover:bg-white/[.1] text-sm text-gray-300 transition-colors"
                >
                  <Plus size={16} />
                  New Workspace
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto relative">
          <KnowledgeBaseManager 
          urlGroups={urlGroups}
          selectedUrls={selectedUrls}
          onAddUrl={handleAddUrlToGroup}
          onAddBulkUrl={handleAddBulkUrlsToGroup}
          onRemoveUrl={handleRemoveUrl}
          onToggleUrl={handleToggleUrl}
          onToggleGroup={handleToggleGroup}
          maxUrls={MAX_URLS}
          onCloseSidebar={() => setIsSidebarOpen(false)}
          language={language}
          onLanguageChange={setLanguage}
          // File props
          fileGroups={fileGroups}
          selectedFileIds={selectedFileIds}
          onUploadFiles={handleUploadFiles}
          onRemoveFile={handleRemoveFile}
          onToggleFile={handleToggleFile}
          onCreateFileGroup={() => {}} // Inline creation handled in component
          onDeleteFileGroup={handleDeleteFileGroup}
          onRenameFileGroup={handleRenameFileGroup}
          onMoveFiles={handleMoveFiles}
          onToggleFileGroup={handleToggleFileGroup}
          onScanDuplicates={handleScanDuplicates}
          isGeneratingAudioOverview={isGeneratingAudioOverview}
          audioOverviewUrl={audioOverviewUrl}
          onGenerateAudioOverview={handleGenerateAudioOverview}
          notes={notes}
          onDeleteNote={handleDeleteNote}
          onUpdateNote={handleUpdateNote}
        />
        </div>
      </div>
      
      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <div className="flex-1 p-2 md:p-4 overflow-hidden">
          <ChatInterface 
            messages={chatMessages} 
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            initialQuerySuggestions={initialQuerySuggestions}
            onSuggestedQueryClick={handleSuggestedQueryClick}
            isFetchingSuggestions={isFetchingSuggestions}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeUrls={Array.from(selectedUrls)}
            language={language}
            voiceSettings={voiceSettings}
            onVoiceSettingsChange={setVoiceSettings}
            availableGroups={urlGroups}
            onAddDiscoveredResources={handleAddDiscoveredResources}
            activeFileCount={selectedFileIds.size}
            aiModel={aiModel}
            onAiModelChange={setAiModel}
            isThinkingMode={isThinkingMode}
            onToggleThinkingMode={() => setIsThinkingMode(!isThinkingMode)}
            useMaps={useMaps}
            onToggleMaps={() => setUseMaps(!useMaps)}
            onSaveNote={handleSaveNote}
            activeSessionId={activeSessionId}
          />
        </div>
      </div>
    </div>
  );
};

export default App;