# IK - ReNote 📝✨

**Advanced Document Intelligence & AI-Powered Note Taking Platform**

> Created by **ইঞ্জিনিয়ার নির্ঝর** • L9_META_DESIGNER • (ID: ikDev)

---

## 🎯 Vision & Purpose

**IK - ReNote** is a next-generation intelligent note-taking and document analysis platform that seamlessly integrates **Google's Gemini AI** with a modern React interface. It enables users to:

- 💡 **Chat with Documentation** - Ask questions about URLs, PDFs, and uploaded documents
- 🎙️ **Audio-First Interactions** - Voice input/output via Gemini Live API with multi-speaker TTS
- 📊 **Smart Comparisons** - Generate structured comparison tables from multiple sources
- 🔍 **Context-Aware Search** - Leverage Google Search & Maps grounding for discovery
- 🌍 **Multilingual Support** - Bengali & English with adaptive language routing
- 📦 **Session Persistence** - Firebase-backed conversation history and notes
- 🎨 **Dark-Optimized UX** - Tailwind CSS with atom-one-dark syntax highlighting

---

## 🏗️ Architecture & Meta Blueprint

### Core Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend Framework** | React (JSX) | 19.1.0 | Component-based UI with Hooks |
| **Build Tool** | Vite | 6.2.0 | Lightning-fast dev & production builds |
| **Language** | TypeScript | ~5.8.2 | Type-safe application layer (88.1%) |
| **Styling** | Tailwind CSS | - | Utility-first dark-mode design |
| **AI Engine** | Google Gemini API | @google/genai ^1.0.1 | Multi-modal LLM with tools |
| **Backend** | Firebase | 12.11.0 | Real-time DB, Auth, Storage |
| **Document Processing** | pdfjs-dist | 5.6.205 | Client-side PDF text extraction |
| **Markdown Rendering** | marked + highlight.js | 13.0.2, 11.9.0 | Rich syntax highlighting |
| **Icons** | lucide-react | 0.417.0 | Consistent icon system |
| **Utilities** | jszip | 3.10.1 | Archive handling for file groups |

### Language Composition
- **TypeScript**: 88.1% (Core application logic)
- **JavaScript**: 10.9% (Runtime/transpiled)
- **Other**: 1% (Config files)

---

## 📂 Project Structure

```
IK---ReNote/
├── index.html              # Entry point (dark mode, Tailwind CDN, ESM imports)
├── index.tsx               # React root (StrictMode, root render)
├── index.css               # Global styles (dark scrollbars, markdown prose)
├── App.tsx                 # Main app component (chat UI, session mgmt, state)
│
├── types.ts                # TypeScript interfaces
│   ├── MessageSender       # ENUM: user | model | system
│   ├── ChatMessage         # Messages with metadata
│   ├── URLGroup / FileGroup # Grouped resources
│   ├── Session             # Conversation sessions
│   ├── LocalFile           # File metadata with content hashing
│   ├── AIModel             # Type union for 4 Gemini variants
│   └── ThinkingLevel       # HIGH | LOW | MINIMAL
│
├── services/
│   ├── geminiService.ts    # AI orchestration layer (600+ lines)
│   │   ├── determineModel()      # Smart model routing based on prompt/context
│   │   ├── generateContentWithUrlContext() # Core Q&A with grounding
│   │   ├── generateSpeech()      # TTS via gemini-2.5-flash-preview-tts
│   │   ├── generateAudioOverview() # Podcast-style multi-speaker audio
│   │   ├── generateComparison()  # Structured JSON table generation
│   │   ├── getInitialSuggestions() # URL-based topic suggestions
│   │   ├── getFollowUpSuggestions() # Context-aware next steps
│   │   ├── discoverResources()   # Google Search + web grounding
│   │   ├── connectToLiveAPI()    # Real-time voice API bridge
│   │   ├── transcribeAudio()     # Audio → text
│   │   ├── withExponentialBackoff() # Rate-limit retry logic
│   │   └── fileToPart()          # File → Gemini multimodal part converter
│   │
│   └── firebaseService.ts  # (implicit) Database/Auth integration
│
├── utils/
│   └── pdfExtractor.ts     # PDF text extraction + RAG-style chunking
│       ├── 800k char limit handling
│       ├── Keyword-based relevance scoring
│       └── Fallback to base64 for OCR
│
├── components/
│   └── (Chat UI components - message list, input box, sidebars, etc.)
│
├── package.json            # Dependencies, scripts, metadata
├── tsconfig.json           # TypeScript compiler options (ES2022 target)
├── vite.config.ts          # Build config (port 3000, alias @/*, env loader)
├── .gitignore              # Standard Node.js ignore patterns
└── .env (local only)       # GEMINI_API_KEY (not in repo)
```

---

## 🔌 Gemini AI Integration Patterns

### 1. **Model Auto-Routing** (`determineModel()`)
```typescript
Based on:
  - promptLength: short (<200) → Flash Lite | long (>1000) → Flash
  - urlCount: >3 URLs → Flash (token efficiency) | <=3 → Pro if complex
  - isComplexTask: image/video analysis → Pro
  - Default: gemini-3-flash-preview (cost-optimized)

Available Models:
  • gemini-3.1-pro-preview          (Deep reasoning)
  • gemini-3-flash-preview          (Balanced speed/cost)
  • gemini-3.1-flash-lite-preview   (Ultra-fast for simple tasks)
  • gemini-2.5-flash-preview-tts    (Audio generation)
  • gemini-3.1-flash-live-preview   (Real-time voice)
```

### 2. **Grounding Tools** (Context Awareness)

| Tool | Use Case | Output |
|------|----------|--------|
| `urlContext` | Explicit URL list provided | URL metadata extraction |
| `googleSearch` | No URLs, general query | Web search results + discovery |
| `googleMaps` | Location-based queries | Map tiles + location data |

### 3. **Safety Configuration**
```typescript
// Block MEDIUM_AND_ABOVE for:
- HARASSMENT
- HATE_SPEECH
- SEXUALLY_EXPLICIT
- DANGEROUS_CONTENT
```

### 4. **Multimodal File Processing**

**Text Files** → Direct content + `--- File markers ---`

**PDFs** → Two-tier strategy:
- ≤800k chars: Full text extraction
- >800k chars: RAG-based chunking
  - Split into 100k char chunks
  - Keyword scoring based on prompt
  - Select top chunks by relevance
  - Fallback to base64 if extraction fails

**Images/Video** → Base64 inline data (MIME type encoded)

### 5. **Rate-Limit Resilience** (`withExponentialBackoff`)
```typescript
Retry delays: [5s, 10s, 30s]
Detects: 429 status, "quota" in message
Max attempts: 4 (1 initial + 3 retries)
```

### 6. **Language Routing** (Bengali/English)
```typescript
If language === 'bn':
  - Append: "Answer entirely in Bengali/Bangla language"
  - Generate suggestions in Bengali
  - Multi-speaker TTS with Bangla support

Else:
  - English instructions + responses
```

---

## 🎨 User Interface Architecture

### Main Components

1. **Chat Container** (Left Panel)
   - Message thread with sender differentiation (User/Model/System)
   - Markdown rendering with syntax highlighting
   - Loading states with spinners
   - Suggested actions + discovered resources

2. **Sidebar** (Right Panel - Collapsible)
   - **Tabs**:
     - Sessions: Browse, create, rename, delete chat history
     - URL Groups: Manage document URLs for context
     - File Groups: Upload PDFs, images, text files
     - Notes: Local note-taking interface
   - Firebase sync for persistence
   - Session-based state management

3. **Input Area** (Bottom)
   - Text message field with auto-focus
   - Voice recording (Gemini Live)
   - Model selection dropdown
   - Thinking level toggle (HIGH/LOW/MINIMAL)
   - Submit button with typing indicator

4. **Dark Theme Defaults**
   - Background: `#282828` (dark gray)
   - Text: `#E2E2E2` (light gray)
   - Accents: `#79B8FF` (GitHub blue links)
   - Blockquotes: `#A8ABB4` (muted)
   - Syntax: atom-one-dark highlighting

---

## 🚀 Key Features Deep Dive

### A. Chat with Documents
```typescript
User uploads URLs → App fetches content via urlContext tool
            ↓
Gemini analyzes content + user prompt
            ↓
Returns: text response + discovered resources + URL metadata
            ↓
UI renders markdown with syntax highlighting
```

### B. Audio-First Mode
```typescript
User starts recording → connectToLiveAPI()
            ↓
Real-time audio stream → Gemini Live (gemini-3.1-flash-live-preview)
            ↓
Live transcription + response generation
            ↓
Multi-speaker TTS (Kore for Alex, Puck for Taylor)
            ↓
Audio blob → WAV header creation → play in UI
```

### C. Comparison Engine
```typescript
Input: "Compare Flash vs Pro" + URLs/files
            ↓
generateComparison() → Prompt Gemini with schema
            ↓
Parse JSON response:
  {
    "title": "...",
    "headers": ["Feature", "Flash", "Pro"],
    "rows": [[...], [...]],
    "summary": "..."
  }
            ↓
Render as structured table in UI
```

### D. Resource Discovery
```typescript
User searches topic → discoverResources()
            ↓
Google Search grounding (automatic web crawl)
            ↓
Extract groundingChunks with URLs + titles
            ↓
Dedup + filter invalid URLs
            ↓
Populate URL suggestions in sidebar
```

### E. Session Management
```typescript
Each chat is a "Session":
  - ID (Firebase doc ID)
  - name: "Project Planning", "API Docs", etc.
  - lastAccessed: timestamp
  - Messages: array of ChatMessage
  - Files/URLs: grouped

Firebase stores in real-time DB → synced across tabs
```

---

## 🔧 Development Workflow

### Setup

```bash
# 1. Clone repository
git clone https://github.com/engrnirzorme-dev/IK---ReNote.git
cd IK---ReNote

# 2. Install dependencies
npm install

# 3. Set up environment
cat > .env << 'EOF'
GEMINI_API_KEY=your_api_key_here
EOF

# 4. Start dev server
npm run dev
# Server runs on http://0.0.0.0:3000
```

### Build

```bash
# Type-check
npm run lint

# Production build
npm run build
# Output: dist/

# Preview
npm run preview
```

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server (hot reload, 0.0.0.0:3000) |
| `npm run build` | Vite production build → dist/ |
| `npm run preview` | Serve dist/ locally for testing |
| `npm run lint` | TypeScript type-checking (no emit) |

---

## 🌍 Deployment & Environment

### Required Env Vars
- `GEMINI_API_KEY`: Google AI Studio API key ([get here](https://aistudio.google.com/))
- `process.env.GEMINI_API_KEY`: Also exposed to Vite define

### Vite Config Specifics
```typescript
server: {
  port: 3000,
  host: '0.0.0.0'  // Allows external connections
}

resolve.alias['@'] = root  // Path alias for imports
```

### CDN Dependencies (in HTML)
- Tailwind CSS (via `cdn.tailwindcss.com`)
- Highlight.js theme (CDN)
- ESM import map for React, marked, lucide-react, etc.

---

## 💡 Advanced Patterns

### 1. The "200k Rule" (Token Context Limit)
```typescript
1 token ≈ 4 characters
Gemini context = 200,000 tokens
Max safe context ≈ 800,000 characters

For PDFs > 800k chars:
  → Use RAG-style chunking
  → Score chunks by prompt relevance
  → Return top N chunks
```

### 2. Thinking Mode
```typescript
User can set:
  - HIGH: Deep reasoning (slower, more tokens)
  - LOW: Standard thinking
  - MINIMAL: Fast responses (default)

Maps to: config.thinkingConfig.thinkingLevel
```

### 3. Comparison JSON Schema Enforcement
```typescript
Prompt Gemini with exact JSON schema
  ↓
If responseMimeType="application/json":
  Use strict JSON mode (requires no tools)
Else:
  Parse markdown code fences: ```json ... ```
  ↓
Fallback to raw text if parsing fails
```

### 4. Multi-Speaker TTS
```typescript
// Podcast-style generation
speakers: [
  {
    speaker: 'Alex',
    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
  },
  {
    speaker: 'Taylor',
    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
  }
]

Output: PCM audio → WAV header → Blob → playable URL
```

---

## 📊 Meta Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Frontend (App.tsx)                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐   │
│  │  Chat UI         │  │  Sidebar (Tabs)  │  │  Input Zone   │   │
│  │  - Messages      │  │  - Sessions      │  │  - Text/Voice │   │
│  │  - Markdown      │  │  - URLs/Files    │  │  - Model Sel  │   │
│  │  - Resources     │  │  - Notes         │  │  - Submit     │   │
│  └──────────────────┘  └──────────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                  ┌──────────────────────┐
                  │  Service Layer       │
                  │  geminiService.ts    │
                  │ ┌────────────────┐   │
                  │ │ determineModel │   │
                  │ │ generateContent│   │
                  │ │ generateSpeech │   │
                  │ │ discoverResources   │
                  │ └────────────────┘   │
                  └──────────────────────┘
                              ↓
        ┌─────────────────────────────────────┐
        │  Google Gemini API + Tools           │
        │  ┌──────────────────────────────┐   │
        │  │ Models:                      │   │
        │  │ • 3.1-Pro (reasoning)        │   │
        │  │ • 3-Flash (balanced)         │   │
        │  │ • 3.1-Flash-Lite (speed)     │   │
        │  │ • 2.5-TTS (audio)            │   │
        │  │ • 3.1-Flash-Live (voice)     │   │
        │  └──────────────────────────────┘   │
        │  ┌──────────────────────────────┐   │
        │  │ Grounding Tools:             │   │
        │  │ • urlContext                 │   │
        │  │ • googleSearch               │   │
        │  │ • googleMaps                 │   │
        │  └──────────────────────────────┘   │
        └─────────────────────────────────────┘
                        ↓ ↓ ↓
         ┌──────────┬──────────┬──────────┐
         │ Firebase │   URLs   │  Files   │
         │ (Storage)│ (Context)│ (Upload) │
         └──────────┴──────────┴──────────┘
```

---

## 🎯 Use Cases

1. **Technical Documentation Q&A**
   - Users paste API docs URLs → Ask specific questions
   - Gemini extracts relevant sections → Answers with context

2. **Research Synthesis**
   - Load multiple PDFs + web articles
   - Generate comparison tables (Flash vs Pro, etc.)
   - Get podcast-style summaries in Bengali/English

3. **Voice-Driven Workflow**
   - Users with accessibility needs speak queries
   - Gemini Live processes audio → Real-time responses
   - Multi-speaker TTS playback for engagement

4. **Note Organization**
   - Each session = topic (e.g., "Project Alpha", "React Tips")
   - Chat history + embedded notes + attached files
   - Firebase persistence across devices

---

## 🔐 Security & Privacy

- **API Key**: Set via `.env` (never committed)
- **Firebase Auth**: Implicit (configurable in `firebaseService.ts`)
- **Content**: Sent to Gemini API (Google's data policies apply)
- **Safety Settings**: BLOCK_MEDIUM_AND_ABOVE on 4 harm categories
- **No Tracking**: Client-side only (Vite + React)

---

## 📦 Naming Convention

**Project Name**: `IK - ReNote`
- **IK** = Identifier by ikDev (ইঞ্জিনিয়ার নির্ঝর)
- **ReNote** = Re-imagined Note-taking with AI
- **Original Template**: Based on Google Gemini AI Studio template

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| "API Key not configured" | Set `process.env.GEMINI_API_KEY` in `.env` |
| 429 Quota Exceeded | Built-in exponential backoff (5s, 10s, 30s) |
| PDF extraction fails | Falls back to base64 (OCR-compatible) |
| Chat not syncing | Check Firebase config in `firebaseService.ts` |
| Voice not working | Ensure microphone permission + Live API key |

---

## 📚 Resources

- [Google AI SDK](https://github.com/google-gemini/generative-ai-js)
- [Gemini API Docs](https://ai.google.dev/)
- [React 19 Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Firebase Web SDK](https://firebase.google.com/)

---

## 📝 License

**SPDX**: Apache-2.0 (as declared in source files)

---

## 👤 Author

**ইঞ্জিনিয়ার নির্ঝর** (Engineer Nirjhor)  
L9_META_DESIGNER | ikDev  
[GitHub Profile](https://github.com/engrnirzorme-dev)

---

## 🎉 Getting Started Checklist

- [ ] Clone repository
- [ ] Install `npm install`
- [ ] Set `.env` with `GEMINI_API_KEY`
- [ ] Run `npm run dev`
- [ ] Open http://localhost:3000
- [ ] Add a URL → Ask a question
- [ ] Try voice mode
- [ ] Generate a comparison table
- [ ] Export session notes

---

**Last Updated**: 2026-09-06  
**Repository**: https://github.com/engrnirzorme-dev/IK---ReNote  
**Status**: Active Development 🚀
