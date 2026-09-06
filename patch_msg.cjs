const fs = require('fs');
let code = fs.readFileSync('components/MessageItem.tsx', 'utf8');

// Fix button text wrapping
code = code.replace(
  /className="flex items-center gap-1\.5 px-3 py-1\.5 bg-\[#2C2C2C\] border border-white\/\[\.1\] hover:bg-white\/\[\.08\] hover:border-\[#79B8FF\]\/50 rounded-full text-xs text-\[#E2E2E2\] transition-all text-left"/g,
  'className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2C2C2C] border border-white/[.1] hover:bg-white/[.08] hover:border-[#79B8FF]/50 rounded-2xl text-xs text-[#E2E2E2] transition-all text-left whitespace-normal break-words h-auto"'
);

fs.writeFileSync('components/MessageItem.tsx', code);
