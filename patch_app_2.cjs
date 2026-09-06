const fs = require('fs');
let app = fs.readFileSync('App.tsx', 'utf8');

// The block to replace
const oldEffect = `
  // --- PERSISTENCE: LOAD ON MOUNT ---
  useEffect(() => {
      if (!isAuthReady || !user) return;

      const loadData = async () => {
          try {
              const [savedUrls, savedFiles, savedSettings, savedSelections, savedChat, savedNotes] = await Promise.all([
                  loadUrlGroupsFromDB(),
                  loadFileGroupsFromDB(),
                  loadSettingsFromDB(),
                  loadSelectionsFromDB(),
                  loadChatHistoryFromDB(),
                  loadNotesFromDB()
              ]);

              if (savedUrls && Array.isArray(savedUrls) && savedUrls.length > 0) {
                  setUrlGroups(savedUrls);
              }
              if (savedFiles && Array.isArray(savedFiles)) {
                  setFileGroups(savedFiles);
              }
              if (savedSettings) {
                  if (savedSettings.language) setLanguage(savedSettings.language);
                  if (savedSettings.voiceSettings) setVoiceSettings(savedSettings.voiceSettings);
                  if (savedSettings.aiModel) setAiModel(savedSettings.aiModel);
              }
              if (savedSelections) {
                  if (savedSelections.urls) setSelectedUrls(new Set(savedSelections.urls as string[]));
                  if (savedSelections.fileIds) setSelectedFileIds(new Set(savedSelections.fileIds as string[]));
              }
              if (savedChat && Array.isArray(savedChat)) {
                  setChatMessages(savedChat);
              }
              if (savedNotes && Array.isArray(savedNotes)) {
                  setNotes(savedNotes);
              }

          } catch (e) {
              console.error("Failed to load persistence data", e);
          } finally {
              setIsDbLoaded(true);
          }
      };
      loadData();
  }, [isAuthReady, user]);
`;

const newEffect = `
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
            setFileGroups([{ id: 'default', name: 'General Files', files: [] }]);
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
`;

app = app.replace(oldEffect.trim(), newEffect.trim());
fs.writeFileSync('App.tsx', app);
console.log('Patched DB load effect');
