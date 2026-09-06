const fs = require('fs');
let app = fs.readFileSync('App.tsx', 'utf8');

// The block to replace
const oldSaveEffects = `
  // --- PERSISTENCE: SAVE ON CHANGE ---
  // We use separate effects to avoid saving everything when only one thing changes
  const isInitialMount = useRef(true);

  useEffect(() => {
      if (!isDbLoaded) return;
      if (isInitialMount.current) { isInitialMount.current = false; return; }
      saveUrlGroupsToDB(urlGroups);
  }, [urlGroups, isDbLoaded]);

  useEffect(() => {
      if (!isDbLoaded) return;
      saveFileGroupsToDB(fileGroups);
  }, [fileGroups, isDbLoaded]);

  useEffect(() => {
      if (!isDbLoaded) return;
      saveSettingsToDB({ language, voiceSettings, aiModel });
  }, [language, voiceSettings, aiModel, isDbLoaded]);

  useEffect(() => {
      if (!isDbLoaded) return;
      saveSelectionsToDB(Array.from(selectedUrls), Array.from(selectedFileIds));
  }, [selectedUrls, selectedFileIds, isDbLoaded]);
  
  // Save Chat History
  useEffect(() => {
      if (!isDbLoaded) return;
      if (chatMessages.length > 0) {
          saveChatHistoryToDB(chatMessages);
      }
  }, [chatMessages, isDbLoaded]);
`;

const newSaveEffects = `
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
      name: \`New Workspace \${sessions.length + 1}\`,
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
`;

app = app.replace(oldSaveEffects.trim(), newSaveEffects.trim());
fs.writeFileSync('App.tsx', app);
console.log('Patched App save effects');
