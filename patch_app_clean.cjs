const fs = require('fs');

let app = fs.readFileSync('App.tsx', 'utf8');

// 1. Remove initial data constants and empty INITIAL_URL_GROUPS
app = app.replace(/const GEMINI_DOCS_URLS = \[\s*[\s\S]*?\s*\];\s*/, '');
app = app.replace(/const MODEL_CAPABILITIES_URLS = \[\s*[\s\S]*?\s*\];\s*/, '');
app = app.replace(/const GUIDES_AND_TUTORIALS_URLS = \[\s*[\s\S]*?\s*\];\s*/, '');
app = app.replace(/const LIVE_AND_REALTIME_URLS = \[\s*[\s\S]*?\s*\];\s*/, '');
app = app.replace(/const NEXT_GEN_AND_ROBOTICS_URLS = \[\s*[\s\S]*?\s*\];\s*/, '');
app = app.replace(/const INITIAL_URL_GROUPS: URLGroup\[\] = \[\s*[\s\S]*?\s*\];/, 'const INITIAL_URL_GROUPS: URLGroup[] = [];');

// 2. Fix empty state initialization
app = app.replace(
  "setFileGroups([{ id: 'default', name: 'General Files', files: [] }]);",
  "setFileGroups([]);"
);
app = app.replace(
  "setFileGroups([{ id: 'default', name: 'General Files', files: [] }]);",
  "setFileGroups([]);"
);
app = app.replace(
  "const [fileGroups, setFileGroups] = useState<FileGroup[]>([\n      { id: 'default', name: 'General Files', files: [] }\n  ]);",
  "const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);"
);

// 3. Fix handleAddBulkUrlsToGroup to create a new group if none exists
app = app.replace(
  "      if (!effectiveTargetGroupId && !newGroupName && urlGroups.length > 0) {\n          effectiveTargetGroupId = urlGroups[0].id;\n      }",
  "      if (!effectiveTargetGroupId && !newGroupName) {\n          if (urlGroups.length > 0) {\n              effectiveTargetGroupId = urlGroups[0].id;\n          } else {\n              const newId = `group-${Date.now()}`;\n              setUrlGroups(prev => [...prev, { id: newId, name: 'Default', urls: [] }]);\n              effectiveTargetGroupId = newId;\n          }\n      }"
);

// 4. Fix handleUploadFiles to create a new group if none exists
app = app.replace(
  "      if (!effectiveTargetGroupId && !newGroupName && fileGroups.length > 0) {\n          effectiveTargetGroupId = fileGroups[0].id;\n      }",
  "      if (!effectiveTargetGroupId && !newGroupName) {\n          if (fileGroups.length > 0) {\n              effectiveTargetGroupId = fileGroups[0].id;\n          } else {\n              const newId = `fgroup-${Date.now()}`;\n              setFileGroups(prev => [...prev, { id: newId, name: 'General Files', files: [] }]);\n              effectiveTargetGroupId = newId;\n          }\n      }"
);

fs.writeFileSync('App.tsx', app);
