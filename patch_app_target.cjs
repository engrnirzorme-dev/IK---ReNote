const fs = require('fs');
let app = fs.readFileSync('App.tsx', 'utf8');

// Fix handleAddBulkUrlsToGroup
app = app.replace(
  "      if (!effectiveTargetGroupId && !newGroupName) {\n          if (urlGroups.length > 0) {\n              effectiveTargetGroupId = urlGroups[0].id;",
  "      // Ensure effectiveTargetGroupId exists in urlGroups, otherwise clear it\n      if (effectiveTargetGroupId && !urlGroups.some(g => g.id === effectiveTargetGroupId)) {\n          effectiveTargetGroupId = null;\n      }\n\n      if (!effectiveTargetGroupId && !newGroupName) {\n          if (urlGroups.length > 0) {\n              effectiveTargetGroupId = urlGroups[0].id;"
);

// Fix handleUploadFiles
app = app.replace(
  "      if (!effectiveTargetGroupId && !newGroupName) {\n          if (fileGroups.length > 0) {\n              effectiveTargetGroupId = fileGroups[0].id;",
  "      // Ensure effectiveTargetGroupId exists in fileGroups, otherwise clear it\n      if (effectiveTargetGroupId && !fileGroups.some(g => g.id === effectiveTargetGroupId)) {\n          effectiveTargetGroupId = null;\n      }\n\n      if (!effectiveTargetGroupId && !newGroupName) {\n          if (fileGroups.length > 0) {\n              effectiveTargetGroupId = fileGroups[0].id;"
);

fs.writeFileSync('App.tsx', app);
