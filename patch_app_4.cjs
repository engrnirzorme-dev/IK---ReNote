const fs = require('fs');
let app = fs.readFileSync('App.tsx', 'utf8');

// Update lucide-react import
app = app.replace(
  "import { LogIn, LogOut } from 'lucide-react';",
  "import { LogIn, LogOut, ChevronDown, Plus, Trash2, Edit2, Check, X, FolderKanban } from 'lucide-react';"
);

// Inject Workspace Manager UI in render
const oldSidebarRender = `      <div className={\`
        fixed inset-y-0 left-0 z-40 w-80 bg-[#1E1E1E] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 border-r border-[rgba(255,255,255,0.05)]
        \${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      \`}>
        <KnowledgeBaseManager `;

const newSidebarRender = `      <div className={\`
        fixed inset-y-0 left-0 z-40 w-80 bg-[#1E1E1E] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 border-r border-[rgba(255,255,255,0.05)] flex flex-col
        \${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      \`}>
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
            <ChevronDown size={16} className={\`text-gray-400 transition-transform duration-200 \${isSessionListOpen ? 'rotate-180' : ''}\`} />
          </button>
          
          {isSessionListOpen && (
            <div className="absolute top-full left-0 right-0 bg-[#252525] border-b border-white/[.05] shadow-xl z-50 max-h-60 overflow-y-auto">
              <div className="p-2 space-y-1">
                {sessions.map(session => (
                  <div key={session.id} className={\`group flex items-center justify-between p-2 rounded-lg transition-colors \${activeSessionId === session.id ? 'bg-[#79B8FF]/10 text-[#79B8FF]' : 'text-gray-300 hover:bg-white/[.02]'}\`}>
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
          <KnowledgeBaseManager `;

app = app.replace(oldSidebarRender, newSidebarRender);
fs.writeFileSync('App.tsx', app);
console.log('Patched Sidebar UI');
