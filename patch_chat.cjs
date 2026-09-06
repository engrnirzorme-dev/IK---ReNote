const fs = require('fs');
let code = fs.readFileSync('components/ChatInterface.tsx', 'utf8');

// Add overflow-x-hidden to chat container
code = code.replace(
  /className="flex-grow p-4 overflow-y-auto chat-container bg-\[#282828\] relative"/g,
  'className="flex-grow p-4 overflow-y-auto overflow-x-hidden chat-container bg-[#282828] relative"'
);

// Add min-w-0 to the bottom text area wrapper to ensure it can shrink
code = code.replace(
  /<div className="flex-grow flex flex-col relative">/g,
  '<div className="flex-grow flex flex-col relative min-w-0">'
);

// Fix the suggestion buttons at the bottom of the chat interface (if any)
code = code.replace(
  /className="snap-start flex-shrink-0 px-3 py-1\.5 text-xs font-medium text-\[#A8ABB4\] bg-\[#2C2C2C\] hover:bg-\[#3C3C3C\] border border-\[rgba\(255,255,255,0\.1\)\] rounded-full transition-colors whitespace-nowrap"/g,
  'className="snap-start flex-shrink-0 px-3 py-1.5 text-xs font-medium text-[#A8ABB4] bg-[#2C2C2C] hover:bg-[#3C3C3C] border border-[rgba(255,255,255,0.1)] rounded-2xl transition-colors whitespace-normal break-words max-w-[250px] text-left"'
);

fs.writeFileSync('components/ChatInterface.tsx', code);
