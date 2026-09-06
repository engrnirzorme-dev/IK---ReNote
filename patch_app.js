const fs = require('fs');

let app = fs.readFileSync('App.tsx', 'utf8');

// 1. Add Session import
app = app.replace(
  "import { ChatMessage, MessageSender, URLGroup, VoiceSettings, LocalFile, FileGroup, AIModel, ThinkingLevel, Note } from './types';",
  "import { ChatMessage, MessageSender, URLGroup, VoiceSettings, LocalFile, FileGroup, AIModel, ThinkingLevel, Note, Session } from './types';"
);

// 2. Add Session DB methods import
app = app.replace(
  "saveNotesToDB, loadNotesFromDB",
  "saveNotesToDB, loadNotesFromDB,\n    loadSessionsFromDB, saveSessionsToDB, deleteSessionFromDB"
);

// 3. Add states
const statesToInject = `
  const [sessions, setSessions] = useState<Session[]>([{ id: 'default', name: 'Default Workspace', lastAccessed: new Date().toISOString() }]);
  const [activeSessionId, setActiveSessionId] = useState<string>('default');
  const [isSessionListOpen, setIsSessionListOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionEditName, setSessionEditName] = useState('');
`;
app = app.replace(
  "const [notes, setNotes] = useState<Note[]>([]);",
  "const [notes, setNotes] = useState<Note[]>([]);\n" + statesToInject
);

fs.writeFileSync('App.tsx', app);
console.log('Patched imports and states');
