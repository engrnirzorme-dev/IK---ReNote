const fs = require('fs');
let app = fs.readFileSync('App.tsx', 'utf8');

const target = `          onUpdateNote={handleUpdateNote}
        />
      </div>`;
      
const replacement = `          onUpdateNote={handleUpdateNote}
        />
        </div>
      </div>`;

app = app.replace(target, replacement);
fs.writeFileSync('App.tsx', app);
