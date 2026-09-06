
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { ChatMessage, MessageSender, VoiceSettings, URLGroup, DiscoveredResource, ComparisonData } from '../types';
import { ArrowRight, Volume2, StopCircle, Copy, Check, Download, Globe, Plus, FolderPlus, Save, Scale, Loader2 } from 'lucide-react';
import { translations, Language } from '../translations';
import { generateSpeech } from '../services/geminiService';

// Configure marked to use highlight.js for syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-', // Prefix for CSS classes
} as any);

interface MessageItemProps {
  message: ChatMessage;
  onSuggestedActionClick?: (action: string) => void;
  language: Language;
  voiceSettings: VoiceSettings;
  availableGroups?: URLGroup[];
  onAddDiscoveredResources?: (urls: string[], groupId: string | null, newGroupName: string | null) => void;
  onSaveNote?: (title: string, content: string) => void;
}

const SenderAvatar: React.FC<{ sender: MessageSender }> = ({ sender }) => {
  let avatarChar = '';
  let bgColorClass = '';
  let textColorClass = '';

  if (sender === MessageSender.USER) {
    avatarChar = 'U';
    bgColorClass = 'bg-white/[.12]';
    textColorClass = 'text-white';
  } else if (sender === MessageSender.MODEL) {
    avatarChar = 'AI';
    bgColorClass = 'bg-[#777777]'; 
    textColorClass = 'text-[#E2E2E2]';
  } else { // SYSTEM
    avatarChar = 'S';
    bgColorClass = 'bg-[#4A4A4A]';
    textColorClass = 'text-[#E2E2E2]';
  }

  return (
    <div className={`w-8 h-8 rounded-full ${bgColorClass} ${textColorClass} flex items-center justify-center text-sm font-semibold flex-shrink-0`}>
      {avatarChar}
    </div>
  );
};

const ComparisonTable: React.FC<{ data: ComparisonData, language: Language }> = ({ data, language }) => {
    const t = translations[language];
    return (
        <div className="mt-4 overflow-hidden rounded-lg border border-white/[.1] bg-[#252525] shadow-lg animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 p-3 bg-white/[.05] border-b border-white/[.1]">
                <Scale size={18} className="text-[#79B8FF]" />
                <h4 className="font-semibold text-[#E2E2E2] text-sm">{data.title || t.comparisonTitle}</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#E2E2E2]">
                    <thead className="bg-white/[.02] text-xs uppercase text-[#A8ABB4]">
                        <tr>
                            {data.headers.map((header, idx) => (
                                <th key={idx} className="px-4 py-3 font-medium border-b border-white/[.05]">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.05]">
                        {data.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-white/[.02] transition-colors">
                                {row.map((cell, cellIdx) => (
                                    <td key={cellIdx} className={`px-4 py-3 ${cellIdx === 0 ? 'font-medium text-[#79B8FF]' : ''}`}>
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ResourceDiscoveryCard: React.FC<{ 
  resources: DiscoveredResource[], 
  language: Language, 
  availableGroups: URLGroup[],
  onImport: (urls: string[], groupId: string | null, newGroupName: string | null) => void 
}> = ({ resources, language, availableGroups, onImport }) => {
  const t = translations[language];
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set(resources.map(r => r.url))); // Default select all
  const [targetGroupId, setTargetGroupId] = useState<string>(availableGroups[0]?.id || 'new');
  const [newGroupName, setNewGroupName] = useState('');
  const [isImported, setIsImported] = useState(false);

  const handleToggle = (url: string) => {
    const next = new Set(selectedUrls);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    setSelectedUrls(next);
  };

  const handleImport = () => {
    if (selectedUrls.size === 0) return;
    
    const isNewGroup = targetGroupId === 'new';
    if (isNewGroup && !newGroupName.trim()) return;

    onImport(
      Array.from(selectedUrls), 
      isNewGroup ? null : targetGroupId,
      isNewGroup ? newGroupName : null
    );
    setIsImported(true);
  };

  if (isImported) {
    return (
      <div className="mt-3 p-4 bg-[#28a745]/10 border border-[#28a745]/30 rounded-lg flex items-center gap-3 text-[#28a745] animate-in fade-in">
        <Check size={20} />
        <span className="font-medium text-sm">{t.importSuccess}</span>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-[#252525] border border-white/[.08] rounded-lg overflow-hidden shadow-lg animate-in slide-in-from-top-2">
      <div className="p-3 bg-white/[.05] border-b border-white/[.08] flex items-center gap-2">
        <Globe size={16} className="text-[#79B8FF]" />
        <h4 className="text-sm font-semibold text-[#E2E2E2]">{t.foundResources}</h4>
      </div>
      
      <div className="p-3">
        <p className="text-xs text-[#A8ABB4] mb-3">{t.selectToImport}</p>
        
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
          {resources.map((res, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 rounded hover:bg-white/[.05] transition-colors">
              <input 
                type="checkbox" 
                checked={selectedUrls.has(res.url)}
                onChange={() => handleToggle(res.url)}
                className="mt-1 rounded border-gray-600 bg-gray-700 text-[#79B8FF] focus:ring-0 focus:ring-offset-0"
              />
              <div className="min-w-0 flex-1">
                <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#79B8FF] hover:underline font-medium block truncate">
                  {res.title}
                </a>
                <p className="text-[10px] text-[#777] truncate">{res.url}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[.08] pt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#A8ABB4] mb-1">{t.addToGroup}</label>
            <select 
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="w-full text-xs bg-[#2C2C2C] border border-white/[.1] text-[#E2E2E2] rounded p-2 focus:ring-1 focus:ring-[#79B8FF]"
            >
              {availableGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
              <option value="new">+ {t.createNewGroup}</option>
            </select>
          </div>

          {targetGroupId === 'new' && (
            <div className="animate-in fade-in slide-in-from-top-1">
              <label className="block text-xs font-medium text-[#A8ABB4] mb-1">{t.newGroupName}</label>
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., React Docs"
                  className="w-full text-xs bg-[#2C2C2C] border border-white/[.1] text-[#E2E2E2] rounded p-2 focus:ring-1 focus:ring-[#79B8FF]"
                />
              </div>
            </div>
          )}

          <button 
            onClick={handleImport}
            disabled={selectedUrls.size === 0 || (targetGroupId === 'new' && !newGroupName.trim())}
            className="w-full py-2 bg-[#79B8FF]/20 hover:bg-[#79B8FF]/30 text-[#79B8FF] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded flex items-center justify-center gap-2 transition-colors"
          >
            {targetGroupId === 'new' ? <FolderPlus size={14} /> : <Save size={14} />}
            {t.importBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  onSuggestedActionClick, 
  language, 
  voiceSettings,
  availableGroups,
  onAddDiscoveredResources,
  onSaveNote
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isNoteSaved, setIsNoteSaved] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const isUser = message.sender === MessageSender.USER;
  const isModel = message.sender === MessageSender.MODEL;
  const isSystem = message.sender === MessageSender.SYSTEM;
  
  const t = translations[language];

  // Stop speaking when component unmounts
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsGeneratingAudio(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text || '');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([message.text || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `answer-${message.timestamp.getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveToNotes = () => {
    if (!onSaveNote || !message.text) return;
    const title = message.text.split('\n')[0].substring(0, 50) || 'Note';
    onSaveNote(title, message.text);
    setIsNoteSaved(true);
    setTimeout(() => setIsNoteSaved(false), 2000);
  };

  const playGeminiAudio = async (base64Audio: string) => {
    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      
      // Gemini TTS returns raw PCM 16-bit 24kHz mono
      const float32Data = new Float32Array(bytes.length / 2);
      const dataView = new DataView(bytes.buffer);
      for (let i = 0; i < float32Data.length; i++) {
        float32Data[i] = dataView.getInt16(i * 2, true) / 32768;
      }
      
      const audioBuffer = audioCtx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = voiceSettings.speed;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        audioSourceRef.current = null;
      };
      
      audioSourceRef.current = source;
      source.start(0);
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
    }
  };

  const handleSpeak = async () => {
    if (isPlaying || isGeneratingAudio) {
      stopAudio();
      return;
    }

    stopAudio();

    const textToSpeak = message.comparisonData ? message.comparisonData.summary : message.text;
    if (!textToSpeak) return;

    if (voiceSettings.voiceURI?.startsWith('gemini-')) {
      setIsGeneratingAudio(true);
      const voiceName = voiceSettings.voiceURI.replace('gemini-', '');
      const base64Audio = await generateSpeech(textToSpeak, voiceName);
      setIsGeneratingAudio(false);
      
      if (base64Audio) {
        playGeminiAudio(base64Audio);
      } else {
        alert("Failed to generate speech. Please check your API key or try again.");
      }
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = voiceSettings.speed;
    
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (voiceSettings.voiceURI) {
      selectedVoice = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
    } 

    if (!selectedVoice && !voiceSettings.voiceURI) {
        const femaleKeywords = ['female', 'zira', 'google us english', 'samantha', 'karen'];
        selectedVoice = voices.find(v => femaleKeywords.some(k => v.name.toLowerCase().includes(k)));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const renderMessageContent = () => {
    if (isModel && !message.isLoading) {
      const proseClasses = "prose prose-sm prose-invert w-full min-w-0 max-w-none break-words overflow-x-auto"; 
      const rawMarkup = marked.parse(message.text || "") as string;
      return (
        <div className="w-full min-w-0">
            {message.comparisonData && (
                <ComparisonTable data={message.comparisonData} language={language} />
            )}
            <div className={`${proseClasses} ${message.comparisonData ? 'mt-4 pt-2 border-t border-white/[.1]' : ''}`} dangerouslySetInnerHTML={{ __html: rawMarkup }} />
        </div>
      );
    }
    
    let textColorClass = '';
    if (isUser) {
        textColorClass = 'text-white';
    } else if (isSystem) {
        textColorClass = 'text-[#A8ABB4]';
    } else { // Model loading, also use prose colors
        textColorClass = 'text-[#E2E2E2]';
    }
    return <div className={`whitespace-pre-wrap text-sm ${textColorClass} break-words min-w-0`}>{message.text}</div>;
  };
  
  let bubbleClasses = "p-3 rounded-lg shadow w-full min-w-0 break-words "; // Added min-w-0 break-words

  if (isUser) {
    bubbleClasses += "bg-white/[.12] text-white rounded-br-none";
  } else if (isModel) {
    bubbleClasses += `bg-[rgba(119,119,119,0.10)] border-t border-[rgba(255,255,255,0.04)] backdrop-blur-lg rounded-bl-none`;
  } else { // System message
    bubbleClasses += "bg-[#2C2C2C] text-[#A8ABB4] rounded-bl-none";
  }

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-2 max-w-[95%] md:max-w-[85%]`}>
        {!isUser && <SenderAvatar sender={message.sender} />}
        <div className="flex flex-col gap-2 w-full min-w-0">
          <div className={bubbleClasses}>
            {message.isLoading ? (
              <div className="flex items-center space-x-1.5">
                <div className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s] ${isUser ? 'bg-white' : 'bg-[#A8ABB4]'}`}></div>
                <div className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s] ${isUser ? 'bg-white' : 'bg-[#A8ABB4]'}`}></div>
                <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isUser ? 'bg-white' : 'bg-[#A8ABB4]'}`}></div>
              </div>
            ) : (
              renderMessageContent()
            )}
            
            {/* Context URLs Metadata */}
            {isModel && message.urlContext && message.urlContext.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-[rgba(255,255,255,0.1)]">
                <h4 className="text-xs font-semibold text-[#A8ABB4] mb-1">{t.contextUrls}</h4>
                <ul className="space-y-0.5">
                  {message.urlContext.map((meta, index) => {
                    const statusText = typeof meta.urlRetrievalStatus === 'string' 
                      ? meta.urlRetrievalStatus.replace('URL_RETRIEVAL_STATUS_', '') 
                      : 'UNKNOWN';
                    const isSuccess = meta.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS';

                    return (
                      <li key={index} className="text-[11px] text-[#A8ABB4]">
                        <a href={meta.retrievedUrl} target="_blank" rel="noopener noreferrer" className="hover:underline break-all text-[#79B8FF]">
                          {meta.retrievedUrl}
                        </a>
                        <span className={`ml-1.5 px-1 py-0.5 rounded-sm text-[9px] ${
                          isSuccess
                            ? 'bg-white/[.12] text-white'
                            : 'bg-slate-600/30 text-slate-400'
                        }`}>
                          {statusText}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            
            {/* Discovered Resources Card */}
            {isModel && message.discoveredResources && message.discoveredResources.length > 0 && availableGroups && onAddDiscoveredResources && (
                <ResourceDiscoveryCard 
                    resources={message.discoveredResources}
                    language={language}
                    availableGroups={availableGroups}
                    onImport={onAddDiscoveredResources}
                />
            )}

            {/* Actions Toolbar for AI messages */}
            {isModel && !message.isLoading && (
              <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                 <button 
                  onClick={handleSpeak}
                  disabled={isGeneratingAudio}
                  className={`p-1.5 rounded-md transition-colors ${isPlaying || isGeneratingAudio ? 'text-[#79B8FF] bg-[#79B8FF]/10' : 'text-[#777] hover:text-white hover:bg-white/[.05]'}`}
                  title={isPlaying ? t.stop : t.play}
                 >
                   {isGeneratingAudio ? <Loader2 size={16} className="animate-spin" /> : isPlaying ? <StopCircle size={16} /> : <Volume2 size={16} />}
                 </button>
                 
                 <button 
                  onClick={handleCopy}
                  className="p-1.5 text-[#777] hover:text-white hover:bg-white/[.05] rounded-md transition-colors"
                  title={isCopied ? t.copied : t.copy}
                 >
                   {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                 </button>

                 <button 
                  onClick={handleDownload}
                  className="p-1.5 text-[#777] hover:text-white hover:bg-white/[.05] rounded-md transition-colors"
                  title={t.downloadSingle}
                 >
                   <Download size={16} />
                 </button>

                 {onSaveNote && (
                   <button 
                     onClick={handleSaveToNotes}
                     className={`p-1.5 rounded-md transition-colors ${isNoteSaved ? 'text-green-500 bg-green-500/10' : 'text-[#777] hover:text-white hover:bg-white/[.05]'}`}
                     title={isNoteSaved ? t.noteSaved : t.saveToNotes}
                   >
                     {isNoteSaved ? <Check size={16} /> : <Save size={16} />}
                   </button>
                 )}
              </div>
            )}
          </div>

          {/* Suggested Actions */}
          {isModel && message.suggestedActions && message.suggestedActions.length > 0 && onSuggestedActionClick && (
              <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-bold text-[#777777] uppercase tracking-wider ml-1">{t.suggestedActions}</p>
                  <div className="flex flex-wrap gap-2">
                      {message.suggestedActions.map((action, idx) => (
                          <button
                              key={idx}
                              onClick={() => onSuggestedActionClick(action)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2C2C2C] border border-white/[.1] hover:bg-white/[.08] hover:border-[#79B8FF]/50 rounded-2xl text-xs text-[#E2E2E2] transition-all text-left whitespace-normal break-words h-auto"
                          >
                              <span>{action}</span>
                              <ArrowRight size={10} className="text-[#79B8FF]" />
                          </button>
                      ))}
                  </div>
              </div>
          )}
        </div>
        {isUser && <SenderAvatar sender={message.sender} />}
      </div>
    </div>
  );
};

export default MessageItem;
