
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MessageSender, VoiceSettings, URLGroup, AIModel } from '../types'; 
import MessageItem from './MessageItem';
import SettingsModal from './SettingsModal';
import { Send, Menu, Download, FileText, FileCode, Sparkles, Settings, Globe, Scale, X, Layers, Brain, MapPin, Mic, MicOff, Loader2 } from 'lucide-react';
import { transcribeAudio } from '../services/geminiService';
import { marked } from 'marked';
import { translations, Language } from '../translations';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (query: string, mode: 'chat' | 'research' | 'compare') => void;
  isLoading: boolean;
  placeholderText?: string;
  initialQuerySuggestions?: string[];
  onSuggestedQueryClick?: (query: string) => void;
  isFetchingSuggestions?: boolean;
  onToggleSidebar?: () => void;
  activeUrls?: string[];
  language: Language;
  voiceSettings: VoiceSettings;
  onVoiceSettingsChange: (settings: VoiceSettings) => void;
  availableGroups?: URLGroup[];
  onAddDiscoveredResources?: (urls: string[], groupId: string | null, newGroupName: string | null) => void;
  activeFileCount?: number;
  aiModel: AIModel;
  onAiModelChange: (model: AIModel) => void;
  isThinkingMode: boolean;
  onToggleThinkingMode: () => void;
  useMaps: boolean;
  onToggleMaps: () => void;
  onSaveNote?: (title: string, content: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  placeholderText,
  initialQuerySuggestions,
  onSuggestedQueryClick,
  isFetchingSuggestions,
  onToggleSidebar,
  activeUrls,
  language,
  voiceSettings,
  onVoiceSettingsChange,
  availableGroups,
  onAddDiscoveredResources,
  activeFileCount = 0,
  aiModel,
  onAiModelChange,
  isThinkingMode,
  onToggleThinkingMode,
  useMaps,
  onToggleMaps,
  onSaveNote
}) => {
  const [userQuery, setUserQuery] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'chat' | 'research' | 'compare'>('chat');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const t = translations[language];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if (userQuery.trim() && !isLoading) {
      onSendMessage(userQuery.trim(), activeMode);
      setUserQuery('');
      if (activeMode !== 'chat') setActiveMode('chat'); 
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsTranscribing(true);
          const transcription = await transcribeAudio(base64Audio);
          setIsTranscribing(false);
          if (transcription) {
            setUserQuery(prev => prev + (prev ? ' ' : '') + transcription);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert(t.micPermissionError);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };

  const handleExportMarkdown = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const header = `# Knowledge Base Chat Export\nDate: ${timestamp}\n\n## Active Context\nURLs: ${activeUrls?.length || 0}\nFiles: ${activeFileCount}\n\n---\n\n`;
    
    const body = messages.map(msg => {
      const role = msg.sender === MessageSender.USER ? 'User' : (msg.sender === MessageSender.MODEL ? 'AI' : 'System');
      let content = msg.text;
      if (msg.comparisonData) {
          content = `[Comparison Table: ${msg.comparisonData.title}]\n\n` + content;
      }
      return `### ${role} (${msg.timestamp.toLocaleTimeString()})\n\n${content}\n\n`;
    }).join('---\n\n');

    downloadFile(header + body, `chat-export-${timestamp}.md`, 'text/markdown');
  };

  const handleExportHTML = () => {
    const timestamp = new Date().toLocaleDateString();
    const title = `Chat Export`;
    
    const css = `
      body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; background: #f4f4f9; color: #333; }
      .header { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .header h1 { margin: 0 0 10px 0; font-size: 24px; }
      .url-list { font-size: 14px; color: #666; }
      .url-list ul { margin: 5px 0; padding-left: 20px; }
      .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; background: #fff; border-left: 4px solid #ccc; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      .message.user { border-left-color: #007bff; background: #eef7ff; }
      .message.model { border-left-color: #28a745; }
      .message.system { border-left-color: #6c757d; font-style: italic; background: #f8f9fa; }
      .meta { font-size: 12px; color: #888; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; }
      pre { background: #282c34; color: #abb2bf; padding: 10px; border-radius: 4px; overflow-x: auto; }
      code { font-family: Consolas, Monaco, monospace; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 0.9em; }
      th, td { border: 1px solid #ddd; padding: 8px; }
      th { background-color: #f2f2f2; text-align: left; }
    `;

    const messagesHtml = messages.map(msg => {
      const roleClass = msg.sender === MessageSender.USER ? 'user' : (msg.sender === MessageSender.MODEL ? 'model' : 'system');
      const roleName = msg.sender === MessageSender.USER ? 'User' : (msg.sender === MessageSender.MODEL ? 'AI Assistant' : 'System');
      const contentHtml = marked.parse(msg.text || '');
      
      let extraHtml = '';
      if (msg.comparisonData) {
          extraHtml = `
            <div style="margin: 10px 0; overflow-x: auto;">
                <strong>${msg.comparisonData.title}</strong>
                <table>
                    <thead><tr>${msg.comparisonData.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>
                        ${msg.comparisonData.rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
                    </tbody>
                </table>
            </div>
          `;
      }

      return `
        <div class="message ${roleClass}">
          <div class="meta">${roleName} &bull; ${msg.timestamp.toLocaleTimeString()}</div>
          <div class="content">
            ${extraHtml}
            ${contentHtml}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css">
        <style>${css}</style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p><strong>Date:</strong> ${timestamp}</p>
          <div class="url-list">
            <strong>Active Context:</strong>
            ${activeUrls?.length} Links, ${activeFileCount} Files
          </div>
        </div>
        <div class="chat-container">
          ${messagesHtml}
        </div>
      </body>
      </html>
    `;

    downloadFile(html, `chat-export-${new Date().getTime()}.html`, 'text/html');
  };

  const showHeroSuggestions = messages.length <= 1 && initialQuerySuggestions && initialQuerySuggestions.length > 0;
  
  let activePlaceholder = placeholderText || t.askPlaceholder(activeUrls?.length || 0);
  if (activeMode === 'research') activePlaceholder = t.researchPlaceholder;
  if (activeMode === 'compare') activePlaceholder = t.comparisonPlaceholder;

  return (
    <div className="flex flex-col h-full bg-[#1E1E1E] rounded-xl shadow-md border border-[rgba(255,255,255,0.05)] relative">
      <div className="p-4 border-b border-[rgba(255,255,255,0.05)] flex justify-between items-center relative">
        <div className="flex items-center gap-3">
           {onToggleSidebar && (
            <button 
              onClick={onToggleSidebar}
              className="p-1.5 text-[#A8ABB4] hover:text-white rounded-md hover:bg-white/10 transition-colors md:hidden"
              aria-label="Open knowledge base"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-[#E2E2E2] flex items-center gap-2">
                Docs & Files
                <span className="text-xs bg-[#2C2C2C] border border-white/[.1] px-2 py-0.5 rounded-full text-[#A8ABB4] flex items-center gap-1">
                    <Layers size={10} />
                    {activeUrls?.length || 0} Links, {activeFileCount} Files
                </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-[#A8ABB4] hover:text-white rounded-md hover:bg-white/10 transition-colors"
                title={t.settings}
            >
                <Settings size={20} />
            </button>

            <div className="relative" ref={exportMenuRef}>
            <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#A8ABB4] bg-white/[.05] hover:bg-white/[.1] hover:text-white rounded-lg transition-colors border border-white/[.05]"
                title={t.exportChat}
            >
                <Download size={16} />
                <span className="hidden sm:inline">{t.exportChat}</span>
            </button>
            
            {isExportMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#2C2C2C] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-xl overflow-hidden z-50">
                <div className="p-2">
                    <p className="text-xs font-semibold text-[#777777] px-2 py-1 uppercase tracking-wider">{t.downloadAs}</p>
                    <button 
                    onClick={handleExportMarkdown}
                    className="w-full flex items-center gap-2 px-2 py-2 text-sm text-[#E2E2E2] hover:bg-white/[.08] rounded-md transition-colors text-left"
                    >
                    <FileText size={14} className="text-[#79B8FF]" />
                    <span>{t.markdown}</span>
                    </button>
                    <button 
                    onClick={handleExportHTML}
                    className="w-full flex items-center gap-2 px-2 py-2 text-sm text-[#E2E2E2] hover:bg-white/[.08] rounded-md transition-colors text-left"
                    >
                    <FileCode size={14} className="text-orange-400" />
                    <span>{t.html}</span>
                    </button>
                </div>
                </div>
            )}
            </div>
        </div>
      </div>

      <div className="flex-grow p-4 overflow-y-auto overflow-x-hidden chat-container bg-[#282828] relative">
        <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
          
          {messages.map((msg) => (
            <MessageItem 
                key={msg.id} 
                message={msg} 
                onSuggestedActionClick={onSuggestedQueryClick} 
                language={language}
                voiceSettings={voiceSettings}
                availableGroups={availableGroups}
                onAddDiscoveredResources={onAddDiscoveredResources}
                onSaveNote={onSaveNote}
            />
          ))}
          
          {isFetchingSuggestions && messages.length <= 1 && (
              <div className="flex justify-center items-center p-10">
                  <div className="flex flex-col items-center space-y-3 text-[#A8ABB4]">
                      <Sparkles className="w-8 h-8 animate-pulse text-[#79B8FF]" />
                      <span className="text-sm">{t.analyzingSuggestions}</span>
                  </div>
              </div>
          )}

          {showHeroSuggestions && onSuggestedQueryClick && (
             <div className="flex-grow flex flex-col justify-center items-center pb-20 animate-in fade-in duration-500">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-[#E2E2E2] mb-2">{t.heroTitle}</h3>
                  <p className="text-[#A8ABB4]">{t.heroSubtitle}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                  {initialQuerySuggestions!.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => onSuggestedQueryClick(suggestion)}
                      className="p-4 bg-[#333] hover:bg-[#3D3D3D] border border-white/[.05] rounded-xl text-left transition-all hover:scale-[1.02] hover:shadow-lg group"
                    >
                      <span className="text-[#E2E2E2] text-sm font-medium group-hover:text-[#79B8FF] transition-colors">
                        {suggestion}
                      </span>
                    </button>
                  ))}
                </div>
             </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t border-[rgba(255,255,255,0.05)] bg-[#1E1E1E] rounded-b-xl relative">
        
        {activeMode !== 'chat' && (
            <div className="absolute -top-3 left-6 z-10">
                 <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-in slide-in-from-bottom-2 ${
                     activeMode === 'research' ? 'bg-[#79B8FF] text-[#1E1E1E]' : 'bg-[#eab308] text-[#1E1E1E]' 
                 }`}>
                     {activeMode === 'research' ? <Globe size={12} /> : <Scale size={12} />}
                     <span className="max-w-[150px] truncate">{activeMode === 'research' ? t.deepResearch : t.comparisonMode}</span>
                     <button 
                        onClick={() => setActiveMode('chat')}
                        className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                     >
                        <X size={10} />
                     </button>
                 </div>
            </div>
        )}

        <div className="flex items-end gap-2">
            
          <div className="flex bg-white/[.05] rounded-lg p-1 gap-1 flex-shrink-0">
              <button
                onClick={() => setActiveMode(activeMode === 'research' ? 'chat' : 'research')}
                className={`p-2 rounded-md transition-all ${
                    activeMode === 'research'
                    ? 'bg-[#79B8FF] text-[#1E1E1E] shadow-sm' 
                    : 'text-[#A8ABB4] hover:text-white hover:bg-white/[.1]'
                }`}
                title={t.deepResearch}
              >
                 <Globe size={18} />
              </button>

              <button
                onClick={() => setActiveMode(activeMode === 'compare' ? 'chat' : 'compare')}
                className={`p-2 rounded-md transition-all ${
                    activeMode === 'compare'
                    ? 'bg-[#eab308] text-[#1E1E1E] shadow-sm' 
                    : 'text-[#A8ABB4] hover:text-white hover:bg-white/[.1]'
                }`}
                title={t.comparisonMode}
              >
                 <Scale size={18} />
              </button>

              <button
                onClick={onToggleThinkingMode}
                className={`p-2 rounded-md transition-all ${
                    isThinkingMode
                    ? 'bg-purple-500 text-white shadow-sm' 
                    : 'text-[#A8ABB4] hover:text-white hover:bg-white/[.1]'
                }`}
                title={t.thinkingMode}
              >
                 <Brain size={18} />
              </button>

              <button
                onClick={onToggleMaps}
                className={`p-2 rounded-md transition-all ${
                    useMaps
                    ? 'bg-green-500 text-white shadow-sm' 
                    : 'text-[#A8ABB4] hover:text-white hover:bg-white/[.1]'
                }`}
                title={t.mapsGrounding}
              >
                 <MapPin size={18} />
              </button>
          </div>

          <div className="flex-grow flex flex-col relative min-w-0">
              {isTranscribing && (
                  <div className="absolute -top-6 left-2 text-[10px] text-[#79B8FF] flex items-center gap-1 animate-pulse">
                      <Loader2 size={10} className="animate-spin" />
                      {t.transcribing}
                  </div>
              )}
              <textarea
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder={activePlaceholder}
                className={`w-full h-10 min-h-[40px] py-2 px-3 border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] placeholder-[#777777] rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all resize-none text-sm ${
                    activeMode === 'research' ? 'ring-1 ring-[#79B8FF] border-[#79B8FF]/50' : 
                    activeMode === 'compare' ? 'ring-1 ring-[#eab308] border-[#eab308]/50' : 
                    isThinkingMode ? 'ring-1 ring-purple-500 border-purple-500/50' : ''
                }`}
                rows={1}
                disabled={isLoading || isTranscribing}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
          </div>

          <div className="flex gap-1">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || isTranscribing}
                className={`h-10 w-10 p-2 rounded-lg transition-all flex items-center justify-center flex-shrink-0 ${
                    isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-white/[.05] text-[#A8ABB4] hover:bg-white/[.1] hover:text-white'
                }`}
                title={t.voiceMode}
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <button
                onClick={handleSend}
                disabled={isLoading || !userQuery.trim() || isTranscribing}
                className="h-10 w-10 p-2 bg-white/[.12] hover:bg-white/20 text-white rounded-lg transition-colors disabled:bg-[#4A4A4A] disabled:text-[#777777] flex items-center justify-center flex-shrink-0"
                aria-label="Send message"
              >
                {(isLoading && messages[messages.length-1]?.isLoading && messages[messages.length-1]?.sender === MessageSender.MODEL) ? 
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 
                  : <Send size={18} />
                }
              </button>
          </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        voiceSettings={voiceSettings}
        onVoiceSettingsChange={onVoiceSettingsChange}
        language={language}
        aiModel={aiModel}
        onAiModelChange={onAiModelChange}
      />

    </div>
  );
};

export default ChatInterface;
