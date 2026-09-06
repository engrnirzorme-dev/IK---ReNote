
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, ChevronRight, X, Download, FileText, FileCode, Sparkles, Loader2, CheckSquare, Square, Globe, Search, ListPlus, Link2, Upload, File as FileIcon, Image as ImageIcon, FileType, FolderPlus, Folder, ArrowRightLeft, FileDown, Brush, Database, Edit2, Layers } from 'lucide-react';
import { URLGroup, LocalFile, FileGroup, Note } from '../types';
import { generateContentWithUrlContext } from '../services/geminiService';
import { marked } from 'marked';
import { translations, Language } from '../translations';
import JSZip from 'jszip';

interface KnowledgeBaseManagerProps {
  urlGroups: URLGroup[];
  selectedUrls: Set<string>;
  onAddUrl: (url: string, targetGroupId: string | null, newGroupName: string | null) => void;
  onAddBulkUrl: (urls: string[], targetGroupId: string | null, newGroupName: string | null) => void;
  onRemoveUrl: (url: string) => void;
  onToggleUrl: (url: string) => void;
  onToggleGroup: (groupUrls: string[], shouldSelect: boolean) => void;
  maxUrls?: number;
  onCloseSidebar?: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  // File props
  fileGroups: FileGroup[];
  selectedFileIds: Set<string>;
  onUploadFiles: (files: File[], targetGroupId: string | null, newGroupName: string | null) => void;
  onRemoveFile: (id: string) => void;
  onToggleFile: (id: string) => void;
  onCreateFileGroup: (name: string) => void;
  onDeleteFileGroup: (id: string) => void;
  onRenameFileGroup: (id: string, newName: string) => void;
  onMoveFiles: (fileIds: string[], targetGroupId: string) => void;
  onToggleFileGroup: (groupId: string, shouldSelect: boolean) => void;
  // Deduplication
  onScanDuplicates?: () => number;
  // Audio Overview
  isGeneratingAudioOverview?: boolean;
  audioOverviewUrl?: string | null;
  onGenerateAudioOverview?: () => void;
  // Notes
  notes?: Note[];
  onDeleteNote?: (id: string) => void;
  onUpdateNote?: (id: string, content: string) => void;
}

const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({ 
  urlGroups,
  selectedUrls,
  onAddUrl, 
  onAddBulkUrl,
  onRemoveUrl,
  onToggleUrl,
  onToggleGroup,
  maxUrls = 50,
  onCloseSidebar,
  language,
  onLanguageChange,
  fileGroups,
  selectedFileIds,
  onUploadFiles,
  onRemoveFile,
  onToggleFile,
  onCreateFileGroup,
  onDeleteFileGroup,
  onRenameFileGroup,
  onMoveFiles,
  onToggleFileGroup,
  onScanDuplicates,
  isGeneratingAudioOverview = false,
  audioOverviewUrl = null,
  onGenerateAudioOverview,
  notes = [],
  onDeleteNote,
  onUpdateNote
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'links' | 'files' | 'notes'>('all');
  
  // Section Expansion States (Collapsible / Minimizable)
  const [isAudioOverviewExpanded, setIsAudioOverviewExpanded] = useState<boolean>(true);
  const [isAddLinkExpanded, setIsAddLinkExpanded] = useState<boolean>(true);
  const [isUploadExpanded, setIsUploadExpanded] = useState<boolean>(true);
  const [isLinkCategoriesExpanded, setIsLinkCategoriesExpanded] = useState<boolean>(true);
  const [isFileCategoriesExpanded, setIsFileCategoriesExpanded] = useState<boolean>(true);
  
  // Link Tab States
  const [currentUrlInput, setCurrentUrlInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [linkTargetGroupId, setLinkTargetGroupId] = useState<string>(urlGroups[0]?.id || 'gemini-overview');
  const [isNewLinkGroupMode, setIsNewLinkGroupMode] = useState(false);
  const [newLinkGroupName, setNewLinkGroupName] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set()); 
  
  // File Tab States
  const [uploadTargetGroupId, setUploadTargetGroupId] = useState<string>(fileGroups[0]?.id || 'default');
  const [isNewFileGroupMode, setIsNewFileGroupMode] = useState(false);
  const [newFileGroupName, setNewFileGroupName] = useState('');
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter groups based on search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return urlGroups;
    const lowerTerm = searchTerm.toLowerCase();
    return urlGroups.map(group => {
        const groupMatches = group.name.toLowerCase().includes(lowerTerm);
        const filteredUrls = groupMatches 
            ? group.urls 
            : group.urls.filter(url => url.toLowerCase().includes(lowerTerm));
        return { ...group, urls: filteredUrls };
    }).filter(group => group.urls.length > 0 || group.name.toLowerCase().includes(lowerTerm));
  }, [urlGroups, searchTerm]);

  // Filter File Groups
  const filteredFileGroups = useMemo(() => {
      if (!searchTerm.trim()) return fileGroups;
      const lowerTerm = searchTerm.toLowerCase();
      return fileGroups.map(group => {
          const groupMatches = group.name.toLowerCase().includes(lowerTerm);
          const filteredFiles = groupMatches
            ? group.files
            : group.files.filter(f => f.file.name.toLowerCase().includes(lowerTerm));
          return { ...group, files: filteredFiles };
      }).filter(group => group.files.length > 0 || group.name.toLowerCase().includes(lowerTerm));
  }, [fileGroups, searchTerm]);

  // Auto-expand groups when searching
  useEffect(() => {
    if (searchTerm.trim()) {
        if (activeTab === 'links') {
            const matchingGroupIds = filteredGroups.map(g => g.id);
            setExpandedGroups(new Set(matchingGroupIds));
        } else {
            const matchingGroupIds = filteredFileGroups.map(g => g.id);
            setExpandedGroups(new Set(matchingGroupIds));
        }
    }
  }, [searchTerm, filteredGroups, filteredFileGroups, activeTab]);

  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      return true;
    } catch (e) {
      return false;
    }
  };

  const extractUrlsFromText = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s,]+)/g;
    const matches = text.match(urlRegex);
    if (!matches) return [];
    return matches.map(url => url.replace(/[.,;)]$/, '')).filter(isValidUrl);
  };

  const handleAddUrl = () => {
    if (isBulkMode) {
        handleBulkAdd();
        return;
    }

    if (!currentUrlInput.trim()) {
      setError(t.errorEmptyUrl);
      return;
    }
    if (!isValidUrl(currentUrlInput)) {
      setError(t.errorInvalidUrl);
      return;
    }

    // Determine target
    const targetId = isNewLinkGroupMode ? null : linkTargetGroupId;
    const newGroup = isNewLinkGroupMode ? newLinkGroupName : null;
    
    if (isNewLinkGroupMode && !newLinkGroupName.trim()) {
        setError(t.newGroupName + " required.");
        return;
    }

    // Check duplicate in existing group
    if (targetId) {
        const targetGroup = urlGroups.find(g => g.id === targetId);
        if (targetGroup && targetGroup.urls.includes(currentUrlInput)) {
            setError(t.errorDuplicateUrl);
            return;
        }
    }

    onAddUrl(currentUrlInput, targetId, newGroup);
    
    // Reset inputs
    setCurrentUrlInput('');
    if (isNewLinkGroupMode) {
        setIsNewLinkGroupMode(false);
        setNewLinkGroupName('');
    }
    setError(null);
  };

  const handleBulkAdd = () => {
      if (!bulkInput.trim()) {
          setError(language === 'bn' ? 'টেক্সট ইনপুট খালি।' : 'Input is empty.');
          return;
      }
      const extractedUrls = extractUrlsFromText(bulkInput);
      if (extractedUrls.length === 0) {
          setError(language === 'bn' ? 'কোনো সঠিক লিংক পাওয়া যায়নি।' : 'No valid URLs found in text.');
          return;
      }
      
      const targetId = isNewLinkGroupMode ? null : linkTargetGroupId;
      const newGroup = isNewLinkGroupMode ? newLinkGroupName : null;

      if (isNewLinkGroupMode && !newLinkGroupName.trim()) {
        setError(t.newGroupName + " required.");
        return;
      }

      const uniqueUrls = Array.from(new Set(extractedUrls));
      onAddBulkUrl(uniqueUrls, targetId, newGroup);
      
      setBulkInput('');
      if (isNewLinkGroupMode) {
        setIsNewLinkGroupMode(false);
        setNewLinkGroupName('');
    }
      setError(null);
      // Optional: keep in bulk mode or switch back? Keeping it allows more adding.
  };

  const toggleGroupExpand = (groupId: string) => {
      setExpandedGroups(prev => {
          const next = new Set(prev);
          if (next.has(groupId)) next.delete(groupId);
          else next.add(groupId);
          return next;
      });
  };

  const downloadFile = (content: string | Blob, fileName: string, contentType: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportListMarkdown = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    let content = `# Knowledge Base Link Export\nDate: ${timestamp}\n\n`;

    urlGroups.forEach(group => {
      content += `## ${group.name}\n`;
      if (group.urls.length === 0) {
        content += `_(No URLs)_\n`;
      } else {
        group.urls.forEach(url => {
          const isSelected = selectedUrls.has(url) ? '(Selected)' : '';
          content += `- <${url}> ${isSelected}\n`;
        });
      }
      content += `\n`;
    });

    downloadFile(content, `kb-links-${timestamp}.md`, 'text/markdown');
    setIsExportMenuOpen(false);
  };

  const handleGenerateSmartReport = async (format: 'md' | 'html') => {
    setIsExportMenuOpen(false);
    setIsGeneratingReport(true);
    const timestamp = new Date().toLocaleString();
    const langName = language === 'bn' ? 'Bengali' : 'English';
    const reportTitle = language === 'bn' ? 'বিস্তারিত নলেজ বেস রিপোর্ট (বাংলা)' : 'Comprehensive Knowledge Base Report';
    
    let fullReportMarkdown = `# ${reportTitle}\nGenerated on: ${timestamp}\n\n> This report was automatically generated by AI based on the selected documentation.\n\n`;
    
    try {
        let hasProcessedAny = false;
        // Logic to process active groups only
        for (const group of urlGroups) {
            if (group.urls.length === 0) continue;
            setGenerationStatus(language === 'bn' ? `${group.name} বিশ্লেষণ করা হচ্ছে...` : `Analyzing ${group.name}...`);
            hasProcessedAny = true;
            
            const prompt = `Create a detailed summary of: "${group.name}" based on these URLs. Write in ${langName}. Use Markdown.`;
            try {
                const response = await generateContentWithUrlContext(prompt, group.urls, language);
                fullReportMarkdown += `## Category: ${group.name}\n\n${response.text}\n\n**Source URLs:**\n${group.urls.map(u => `- <${u}>`).join('\n')}\n\n---\n\n`;
            } catch (err) {
                fullReportMarkdown += `## Category: ${group.name}\n\n*(Error generating summary)*\n\n---\n\n`;
            }
        }
        if (!hasProcessedAny) fullReportMarkdown += "\n*No URLs found to analyze.*";
        
        setGenerationStatus(t.finalizing);
        if (format === 'md') {
             downloadFile(fullReportMarkdown, `smart_report_${language}.md`, 'text/markdown');
        } else {
             const rawHtml = await marked.parse(fullReportMarkdown); 
             const html = `<!DOCTYPE html><html lang="${language}"><body style="font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto;line-height:1.6;">${rawHtml}</body></html>`;
             downloadFile(html, `smart_report_${language}.html`, 'text/html');
        }
    } catch (globalErr) {
        alert("Report error");
    } finally {
        setIsGeneratingReport(false);
        setGenerationStatus('');
    }
  };

  // File Handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const filesArray = Array.from(e.target.files);
          const targetGroup = isNewFileGroupMode ? null : uploadTargetGroupId;
          const newGroup = isNewFileGroupMode ? (newFileGroupName || 'New Uploads') : null;
          
          onUploadFiles(filesArray, targetGroup, newGroup);
          
          if (fileInputRef.current) fileInputRef.current.value = '';
          setNewFileGroupName('');
          setIsNewFileGroupMode(false);
      }
  };

  const handleDownloadSelectedFiles = async () => {
    const filesToDownload = fileGroups.flatMap(g => g.files).filter(f => selectedFileIds.has(f.id));
    if (filesToDownload.length === 0) return;

    if (filesToDownload.length === 1) {
        const f = filesToDownload[0];
        const link = document.createElement('a');
        link.href = URL.createObjectURL(f.file);
        link.download = f.file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        const zip = new JSZip();
        filesToDownload.forEach(f => {
            zip.file(f.file.name, f.file);
        });
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'exported_files.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const handleScanDuplicates = () => {
      if (onScanDuplicates) {
          const count = onScanDuplicates();
          if (count > 0) {
              alert(t.duplicatesFound(count));
          } else {
              alert(t.noDuplicatesFound);
          }
      }
  };

  return (
    <div className="p-4 bg-[#1E1E1E] shadow-md rounded-xl h-full flex flex-col border border-[rgba(255,255,255,0.05)] relative overflow-hidden">
      
      {isGeneratingReport && (
        <div className="absolute inset-0 z-50 bg-[#1E1E1E]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="w-10 h-10 text-[#79B8FF] animate-spin mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">{t.generatingReport}</h3>
          <p className="text-[#A8ABB4] text-sm">{generationStatus}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-[#E2E2E2]">{t.kbTitle}</h2>
        <div className="flex items-center gap-2">
            <button onClick={() => onLanguageChange(language === 'en' ? 'bn' : 'en')} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[.05] hover:bg-white/[.1] text-xs font-medium text-[#A8ABB4] hover:text-[#79B8FF] transition-colors border border-white/[.05]">
                <Globe size={12} /><span>{language === 'en' ? 'EN' : 'BN'}</span>
            </button>
            <div className="relative" ref={exportMenuRef}>
                <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="p-1.5 text-[#A8ABB4] hover:text-white rounded-md hover:bg-white/10 transition-colors">
                    <Download size={20} />
                </button>
                {isExportMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-[#2C2C2C] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-xl overflow-hidden z-40">
                         {activeTab === 'links' ? (
                             <>
                                <button onClick={handleExportListMarkdown} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#E2E2E2] hover:bg-white/[.08]"><FileText size={14}/><span>{t.linkListMd}</span></button>
                                <button onClick={() => handleGenerateSmartReport('md')} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#79B8FF] hover:bg-white/[.08]"><Sparkles size={14}/><span>{t.generateReportMd}</span></button>
                             </>
                         ) : (
                             <button onClick={handleDownloadSelectedFiles} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#E2E2E2] hover:bg-white/[.08]"><FileDown size={14}/><span>{t.exportSelected}</span></button>
                         )}
                         
                         {/* Deduplication Tool in Menu */}
                         <div className="border-t border-white/[.1] my-1"></div>
                         <button onClick={() => { setIsExportMenuOpen(false); handleScanDuplicates(); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-yellow-500 hover:bg-white/[.08]">
                             <Brush size={14}/><span>{t.scanDuplicates}</span>
                         </button>
                    </div>
                )}
            </div>
            {onCloseSidebar && <button onClick={onCloseSidebar} className="p-1 text-[#A8ABB4] md:hidden"><X size={24} /></button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#252525] p-1 rounded-lg mb-4 border border-white/[.05] gap-1 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('all')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-[#333] text-[#E2E2E2] shadow-sm' : 'text-[#777] hover:text-[#E2E2E2]'}`}
          >
              <Layers size={14} />
              {t.tabAll || (language === 'bn' ? 'সব' : 'All')}
          </button>
          <button 
            onClick={() => setActiveTab('links')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'links' ? 'bg-[#333] text-[#E2E2E2] shadow-sm' : 'text-[#777] hover:text-[#E2E2E2]'}`}
          >
              <Link2 size={14} />
              {t.tabLinks}
          </button>
          <button 
            onClick={() => setActiveTab('files')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'files' ? 'bg-[#333] text-[#E2E2E2] shadow-sm' : 'text-[#777] hover:text-[#E2E2E2]'}`}
          >
              <FileIcon size={14} />
              {t.tabFiles}
          </button>
          <button 
            onClick={() => setActiveTab('notes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'notes' ? 'bg-[#333] text-[#E2E2E2] shadow-sm' : 'text-[#777] hover:text-[#E2E2E2]'}`}
          >
              <Edit2 size={14} />
              {t.tabNotes}
          </button>
      </div>

      {/* Scrollable Container for Entire Sidebar Content Below Tabs */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 chat-container flex flex-col">
          
          {/* Audio Overview Section (NotebookLM Style, Collapsible) */}
          <div className="p-3 bg-gradient-to-br from-[#79B8FF]/10 to-transparent rounded-xl border border-[#79B8FF]/20 transition-all">
              <div 
                onClick={() => setIsAudioOverviewExpanded(!isAudioOverviewExpanded)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                  <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#79B8FF]/20 rounded-lg">
                          <Sparkles size={14} className="text-[#79B8FF]" />
                      </div>
                      <span className="text-xs font-semibold text-white">{t.audioOverview}</span>
                  </div>
                  <button 
                    type="button" 
                    className="p-1 text-[#A8ABB4] hover:text-white rounded hover:bg-white/10 transition-colors"
                  >
                      {isAudioOverviewExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
              </div>

              {isAudioOverviewExpanded && (
                <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] text-[#A8ABB4] leading-relaxed">
                      {t.audioOverviewDescription}
                  </p>
                  
                  {audioOverviewUrl ? (
                      <div className="space-y-2">
                          <audio controls src={audioOverviewUrl} className="w-full h-8 custom-audio-player" />
                          <button 
                            onClick={onGenerateAudioOverview}
                            disabled={isGeneratingAudioOverview}
                            className="w-full py-1.5 text-[10px] font-medium text-[#79B8FF] hover:text-white border border-[#79B8FF]/30 hover:bg-[#79B8FF]/20 rounded-lg transition-all flex items-center justify-center gap-2"
                          >
                              {isGeneratingAudioOverview ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
                              {t.generateAudioOverview}
                          </button>
                      </div>
                  ) : (
                      <button 
                        onClick={onGenerateAudioOverview}
                        disabled={isGeneratingAudioOverview}
                        className="w-full py-2 bg-[#79B8FF] hover:bg-[#66a3ff] disabled:opacity-50 text-[#1E1E1E] text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-[#79B8FF]/10 transition-all active:scale-95"
                      >
                          {isGeneratingAudioOverview ? (
                              <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>{t.generatingAudioOverview}</span>
                              </>
                          ) : (
                              <>
                                  <Sparkles size={14} />
                                  <span>{t.generateAudioOverview}</span>
                              </>
                          )}
                      </button>
                  )}
                </div>
              )}
          </div>
          
          {/* Tab Content: All (Links + Files combined) */}
          {activeTab === 'all' && (
            <div className="space-y-4">
                {/* Search Bar */}
                <div className="px-1 space-y-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" size={14} />
                        <input 
                            type="text"
                            placeholder={language === 'bn' ? 'সব লিংক ও ফাইল খুঁজুন...' : 'Search all links & files...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-9 pl-9 pr-8 text-sm bg-[#252525] border border-white/[.05] rounded-lg text-[#E2E2E2] placeholder-[#555] focus:ring-1 focus:ring-[#79B8FF]/50"
                        />
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555]"><X size={12} /></button>}
                    </div>

                    {/* Bulk File Selection Actions if selected */}
                    {selectedFileIds.size > 0 && (
                         <div className="flex items-center justify-between bg-[#79B8FF]/10 px-2 py-1.5 rounded-lg border border-[#79B8FF]/20 animate-in fade-in slide-in-from-top-1">
                             <span className="text-xs text-[#79B8FF] font-medium">{selectedFileIds.size} files selected</span>
                             <div className="flex gap-2 relative">
                                 <div className="relative">
                                     <button onClick={() => setMoveMenuOpen(!moveMenuOpen)} className="flex items-center gap-1 text-[10px] text-[#E2E2E2] hover:text-white bg-white/10 px-2 py-1 rounded">
                                         <ArrowRightLeft size={10} /> {t.moveSelected}
                                     </button>
                                     {moveMenuOpen && (
                                         <div className="absolute right-0 top-full mt-1 w-40 bg-[#2C2C2C] border border-white/10 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
                                             {fileGroups.map(g => (
                                                 <button 
                                                    key={g.id}
                                                    onClick={() => {
                                                        onMoveFiles(Array.from(selectedFileIds), g.id);
                                                        setMoveMenuOpen(false);
                                                    }}
                                                    className="w-full text-left text-xs px-2 py-1.5 text-[#A8ABB4] hover:bg-white/5 hover:text-white truncate"
                                                 >
                                                     {g.name}
                                                 </button>
                                             ))}
                                         </div>
                                     )}
                                 </div>
                                 <button onClick={handleDownloadSelectedFiles} className="flex items-center gap-1 text-[10px] text-[#E2E2E2] hover:text-white bg-white/10 px-2 py-1 rounded">
                                     <Download size={10} />
                                 </button>
                             </div>
                         </div>
                    )}
                </div>

                {/* Section 1: Web Link Categories */}
                <div className="space-y-2">
                    <button 
                        onClick={() => setIsLinkCategoriesExpanded(!isLinkCategoriesExpanded)}
                        className="flex items-center justify-between w-full px-1 text-xs font-bold text-[#79B8FF] uppercase tracking-wider group hover:opacity-80 transition-opacity"
                    >
                        <div className="flex items-center gap-2">
                            <Globe size={14} />
                            <span>{t.linkCategories || (language === 'bn' ? 'ওয়েব লিংক ক্যাটাগরি' : 'Web Link Categories')}</span>
                        </div>
                        {isLinkCategoriesExpanded ? <ChevronUp size={14} className="opacity-50 group-hover:opacity-100" /> : <ChevronDown size={14} className="opacity-50 group-hover:opacity-100" />}
                    </button>

                    {isLinkCategoriesExpanded && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        {filteredGroups.length === 0 && (
                            <p className="text-xs text-[#555] italic px-2 py-1">{t.noUrls}</p>
                        )}

                    {filteredGroups.map(group => {
                        const isExpanded = expandedGroups.has(group.id);
                        const allSelected = group.urls.length > 0 && group.urls.every(u => selectedUrls.has(u));
                        const someSelected = group.urls.some(u => selectedUrls.has(u));

                        return (
                            <div key={group.id} className="bg-[#2C2C2C] border border-[rgba(255,255,255,0.05)] rounded-lg overflow-hidden">
                                <div className="flex items-center px-3 py-2 bg-[#333] hover:bg-[#3a3a3a] transition-colors gap-2">
                                    <button onClick={() => toggleGroupExpand(group.id)} className="text-[#A8ABB4] hover:text-white">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    <button onClick={() => onToggleGroup(group.urls, !allSelected)} className={`text-[#A8ABB4] hover:text-[#79B8FF] ${allSelected ? 'text-[#79B8FF]' : ''}`}>
                                        {allSelected ? <CheckSquare size={16} /> : (someSelected ? <Square size={16} fill="currentColor" fillOpacity={0.5} className="text-[#79B8FF]" /> : <Square size={16} />)}
                                    </button>
                                    <span onClick={() => toggleGroupExpand(group.id)} className="text-sm font-medium text-[#E2E2E2] flex-grow cursor-pointer select-none">
                                        {group.name} <span className="text-[#777] text-xs">({group.urls.length})</span>
                                    </span>
                                </div>
                                {isExpanded && (
                                    <div className="px-2 py-2 space-y-1 bg-[#252525]">
                                        {group.urls.map(url => {
                                            const isSelected = selectedUrls.has(url);
                                            return (
                                                <div key={url} className={`flex items-center gap-2 p-1.5 rounded transition-all group ${isSelected ? 'bg-[#79B8FF]/10 border-l-2 border-[#79B8FF]' : 'hover:bg-white/[.05] border-l-2 border-transparent'}`}>
                                                    <button onClick={() => onToggleUrl(url)} className={`${isSelected ? 'text-[#79B8FF]' : 'text-[#555] group-hover:text-[#777]'}`}>
                                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                    </button>
                                                    <p className={`text-xs truncate font-mono flex-grow ${isSelected ? 'text-[#79B8FF]' : 'text-[#BBB]'}`} title={url}>{url}</p>
                                                    <button onClick={() => onRemoveUrl(url)} className="text-[#555] hover:text-[#f87171] opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                                </div>
                                            );
                                        })}
                                        {group.urls.length === 0 && <p className="text-xs text-[#555] pl-8 italic">{t.noUrls}</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    </div>
                  )}
                </div>

                {/* Section 2: File Categories */}
                <div className="space-y-2 pt-2 border-t border-white/[.05]">
                    <button 
                        onClick={() => setIsFileCategoriesExpanded(!isFileCategoriesExpanded)}
                        className="flex items-center justify-between w-full px-1 text-xs font-bold text-[#79B8FF] uppercase tracking-wider group hover:opacity-80 transition-opacity"
                    >
                        <div className="flex items-center gap-2">
                            <Folder size={14} />
                            <span>{t.fileCategories || (language === 'bn' ? 'ফাইল ক্যাটাগরি' : 'File Categories')}</span>
                        </div>
                        {isFileCategoriesExpanded ? <ChevronUp size={14} className="opacity-50 group-hover:opacity-100" /> : <ChevronDown size={14} className="opacity-50 group-hover:opacity-100" />}
                    </button>

                    {isFileCategoriesExpanded && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        {filteredFileGroups.length === 0 && (
                             <p className="text-xs text-[#555] italic px-2 py-1">{t.noFiles}</p>
                        )}
                    
                    {filteredFileGroups.map(group => {
                         const isExpanded = expandedGroups.has(group.id);
                         const allSelected = group.files.length > 0 && group.files.every(f => selectedFileIds.has(f.id));
                         const someSelected = group.files.some(f => selectedFileIds.has(f.id));
                         
                         return (
                            <div key={group.id} className="bg-[#2C2C2C] border border-[rgba(255,255,255,0.05)] rounded-lg overflow-hidden">
                                 {/* Group Header */}
                                 <div className="flex items-center px-3 py-2 bg-[#333] hover:bg-[#3a3a3a] transition-colors gap-2 group">
                                    <button onClick={() => toggleGroupExpand(group.id)} className="text-[#A8ABB4] hover:text-white">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    <button onClick={() => onToggleFileGroup(group.id, !allSelected)} className={`text-[#A8ABB4] hover:text-[#79B8FF] ${allSelected ? 'text-[#79B8FF]' : ''}`}>
                                        {allSelected ? <CheckSquare size={16} /> : (someSelected ? <Square size={16} fill="currentColor" fillOpacity={0.5} className="text-[#79B8FF]" /> : <Square size={16} />)}
                                    </button>
                                    {editingGroupId === group.id ? (
                                        <input
                                            type="text"
                                            value={editingGroupName}
                                            onChange={(e) => setEditingGroupName(e.target.value)}
                                            onBlur={() => {
                                                if (editingGroupName.trim()) {
                                                    onRenameFileGroup(group.id, editingGroupName.trim());
                                                }
                                                setEditingGroupId(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    if (editingGroupName.trim()) {
                                                        onRenameFileGroup(group.id, editingGroupName.trim());
                                                    }
                                                    setEditingGroupId(null);
                                                } else if (e.key === 'Escape') {
                                                    setEditingGroupId(null);
                                                }
                                            }}
                                            className="text-sm font-medium text-[#E2E2E2] flex-grow bg-[#2C2C2C] border border-[#79B8FF] rounded px-1 focus:outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <span 
                                            onClick={() => toggleGroupExpand(group.id)} 
                                            onDoubleClick={() => {
                                                setEditingGroupId(group.id);
                                                setEditingGroupName(group.name);
                                            }}
                                            className="text-sm font-medium text-[#E2E2E2] flex-grow cursor-pointer select-none truncate"
                                            title="Double click to rename"
                                        >
                                            {group.name} <span className="text-[#777] text-xs">({group.files.length})</span>
                                        </span>
                                    )}
                                    {editingGroupId !== group.id && (
                                        <button onClick={() => {
                                            setEditingGroupId(group.id);
                                            setEditingGroupName(group.name);
                                        }} className="text-[#555] hover:text-[#79B8FF] opacity-0 group-hover:opacity-100 transition-opacity" title="Rename group">
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                    <button onClick={() => onDeleteFileGroup(group.id)} className="text-[#555] hover:text-[#f87171] opacity-0 group-hover:opacity-100 transition-opacity" title={t.deleteGroup}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                 {/* Files */}
                                 {isExpanded && (
                                     <div className="px-2 py-2 space-y-1 bg-[#252525]">
                                         {group.files.map(file => {
                                             const isSelected = selectedFileIds.has(file.id);
                                             return (
                                                  <div key={file.id} className={`relative flex items-start gap-2 p-2 rounded transition-all group ${isSelected ? 'bg-[#79B8FF]/10 border border-[#79B8FF]/30' : 'hover:bg-white/[.05] border border-transparent'}`}>
                                                     <button onClick={() => onToggleFile(file.id)} className={`mt-1 ${isSelected ? 'text-[#79B8FF]' : 'text-[#555] group-hover:text-[#777]'}`}>
                                                         {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                     </button>
                                                     
                                                     {/* Preview / Icon */}
                                                     <div className="flex-shrink-0 w-8 h-8 rounded bg-[#333] flex items-center justify-center overflow-hidden border border-white/5">
                                                         {file.type === 'image' && file.preview ? (
                                                             <img src={file.preview} alt="preview" className="w-full h-full object-cover" />
                                                         ) : (
                                                             file.type === 'pdf' ? <FileType size={16} className="text-red-400" /> 
                                                             : <FileText size={16} className="text-blue-400" />
                                                         )}
                                                     </div>

                                                     <div className="min-w-0 flex-grow">
                                                         <p className={`text-xs font-medium truncate ${isSelected ? 'text-[#E2E2E2]' : 'text-[#BBB]'}`} title={file.file.name}>{file.file.name}</p>
                                                         
                                                         {/* Text Snippet Preview */}
                                                         {file.type === 'text' && file.preview && (
                                                             <p className="text-[10px] text-[#777] line-clamp-2 mt-0.5 font-mono bg-black/20 p-1 rounded">
                                                                 {file.preview}
                                                             </p>
                                                         )}
                                                     </div>

                                                     <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                          <button onClick={() => onRemoveFile(file.id)} className="text-[#555] hover:text-[#f87171]"><Trash2 size={14} /></button>
                                                     </div>
                                                  </div>
                                             );
                                         })}
                                         {group.files.length === 0 && <p className="text-xs text-[#555] pl-8 italic">{t.noFiles}</p>}
                                     </div>
                                 )}
                             </div>
                          );
                     })}
                     </div>
                   )}
                </div>
            </div>
          )}

          {/* Tab Content: Links */}
          {activeTab === 'links' && (
            <div className="space-y-3">
                {/* Search Bar */}
                <div className="px-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" size={14} />
                        <input 
                            type="text"
                            placeholder={language === 'bn' ? 'খুঁজুন...' : 'Search...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-9 pl-9 pr-8 text-sm bg-[#252525] border border-white/[.05] rounded-lg text-[#E2E2E2] placeholder-[#555] focus:ring-1 focus:ring-[#79B8FF]/50"
                        />
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555]"><X size={12} /></button>}
                    </div>
                </div>

                {/* Collapsible Add Link Input Card */}
                <div className="p-3 bg-[#252525] rounded-lg border border-white/[.05] transition-all">
                    <div 
                      onClick={() => setIsAddLinkExpanded(!isAddLinkExpanded)}
                      className="flex items-center justify-between cursor-pointer select-none"
                    >
                        <div className="flex items-center gap-2">
                            <Plus size={14} className="text-[#79B8FF]" />
                            <span className="text-xs font-semibold text-[#E2E2E2]">
                                {t.addLinkSection || (language === 'bn' ? 'নতুন লিংক / টেক্সট যোগ করুন' : 'Add New Link / Extract')}
                            </span>
                        </div>
                        <button 
                          type="button" 
                          className="p-1 text-[#A8ABB4] hover:text-white rounded hover:bg-white/10 transition-colors"
                        >
                            {isAddLinkExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>

                    {isAddLinkExpanded && (
                      <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1">
                        {/* Mode Switcher Tabs */}
                        <div className="flex bg-[#2C2C2C] p-0.5 rounded-lg border border-white/[.05]">
                             <button 
                                onClick={() => { setIsBulkMode(false); setError(null); }}
                                className={`flex-1 py-1.5 text-[10px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${!isBulkMode ? 'bg-[#333] text-[#79B8FF] shadow-sm' : 'text-[#777] hover:text-[#E2E2E2]'}`}
                             >
                                 <Link2 size={12} /> {t.addLinkMode}
                             </button>
                             <button 
                                onClick={() => { setIsBulkMode(true); setError(null); }}
                                className={`flex-1 py-1.5 text-[10px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${isBulkMode ? 'bg-[#333] text-[#79B8FF] shadow-sm' : 'text-[#777] hover:text-[#E2E2E2]'}`}
                             >
                                 <ListPlus size={12} /> {t.textExtractMode}
                             </button>
                        </div>

                        {/* Group Selector for Links (Common) */}
                         <div className="flex items-center gap-2 min-w-0 w-full">
                            <span className="text-xs text-[#A8ABB4] flex-shrink-0">{t.linkGroupLabel}</span>
                            {isNewLinkGroupMode ? (
                                <div className="flex items-center gap-1 flex-grow min-w-0">
                                     <input 
                                        type="text" 
                                        value={newLinkGroupName}
                                        onChange={(e) => setNewLinkGroupName(e.target.value)}
                                        placeholder={t.newGroupName}
                                        className="h-7 text-xs bg-[#2C2C2C] border border-white/10 rounded px-2 w-full min-w-0 focus:outline-none focus:border-[#79B8FF]"
                                        autoFocus
                                    />
                                    <button onClick={() => setIsNewLinkGroupMode(false)} className="text-[#555] hover:text-white flex-shrink-0"><X size={14}/></button>
                                </div>
                            ) : (
                                <select 
                                    value={linkTargetGroupId} 
                                    onChange={(e) => {
                                        if (e.target.value === 'NEW') {
                                            setIsNewLinkGroupMode(true);
                                        } else {
                                            setLinkTargetGroupId(e.target.value);
                                        }
                                    }}
                                    className="h-7 text-xs bg-[#2C2C2C] border border-white/10 rounded px-1 text-[#A8ABB4] focus:outline-none focus:border-[#79B8FF] flex-grow min-w-0 truncate max-w-full"
                                >
                                    {urlGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    <option value="NEW">+ {t.createNewGroup}</option>
                                </select>
                            )}
                        </div>
                        
                        {/* Input Area */}
                        {isBulkMode ? (
                            <div className="animate-in fade-in zoom-in-95 duration-200 min-w-0 w-full">
                                <textarea 
                                    value={bulkInput} 
                                    onChange={(e) => setBulkInput(e.target.value)} 
                                    placeholder={t.pasteTextPlaceholder} 
                                    className="w-full h-24 p-2 text-xs bg-[#2C2C2C] border border-[rgba(255,255,255,0.1)] rounded-lg text-[#E2E2E2] resize-none mb-2 focus:ring-1 focus:ring-[#79B8FF]/50" 
                                />
                                <button onClick={handleBulkAdd} className="w-full py-1.5 bg-[#79B8FF]/20 text-[#79B8FF] text-xs font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-[#79B8FF]/30 transition-colors">
                                    <Sparkles size={12} />{t.extractBtn}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 min-w-0 w-full">
                                <input type="url" value={currentUrlInput} onChange={(e) => setCurrentUrlInput(e.target.value)} placeholder={t.addPlaceholder} className="flex-grow min-w-0 h-8 py-1 px-2.5 border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] rounded-lg text-sm focus:ring-1 focus:ring-[#79B8FF]/50" onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()} />
                                <button onClick={handleAddUrl} className="h-8 w-8 p-1.5 bg-[#79B8FF]/20 text-[#79B8FF] rounded-lg flex items-center justify-center hover:bg-[#79B8FF]/30 transition-colors flex-shrink-0"><Plus size={16} /></button>
                            </div>
                        )}
                        {error && <p className="text-xs text-[#f87171]">{error}</p>}
                      </div>
                    )}
                </div>

                {/* Category / Groups List */}
                <div className="space-y-2">
                    {filteredGroups.map(group => {
                        const isExpanded = expandedGroups.has(group.id);
                        const allSelected = group.urls.length > 0 && group.urls.every(u => selectedUrls.has(u));
                        const someSelected = group.urls.some(u => selectedUrls.has(u));

                        return (
                            <div key={group.id} className="bg-[#2C2C2C] border border-[rgba(255,255,255,0.05)] rounded-lg overflow-hidden">
                                <div className="flex items-center px-3 py-2 bg-[#333] hover:bg-[#3a3a3a] transition-colors gap-2">
                                    <button onClick={() => toggleGroupExpand(group.id)} className="text-[#A8ABB4] hover:text-white">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    <button onClick={() => onToggleGroup(group.urls, !allSelected)} className={`text-[#A8ABB4] hover:text-[#79B8FF] ${allSelected ? 'text-[#79B8FF]' : ''}`}>
                                        {allSelected ? <CheckSquare size={16} /> : (someSelected ? <Square size={16} fill="currentColor" fillOpacity={0.5} className="text-[#79B8FF]" /> : <Square size={16} />)}
                                    </button>
                                    <span onClick={() => toggleGroupExpand(group.id)} className="text-sm font-medium text-[#E2E2E2] flex-grow cursor-pointer select-none">
                                        {group.name} <span className="text-[#777] text-xs">({group.urls.length})</span>
                                    </span>
                                </div>
                                {isExpanded && (
                                    <div className="px-2 py-2 space-y-1 bg-[#252525]">
                                        {group.urls.map(url => {
                                            const isSelected = selectedUrls.has(url);
                                            return (
                                                <div key={url} className={`flex items-center gap-2 p-1.5 rounded transition-all group ${isSelected ? 'bg-[#79B8FF]/10 border-l-2 border-[#79B8FF]' : 'hover:bg-white/[.05] border-l-2 border-transparent'}`}>
                                                    <button onClick={() => onToggleUrl(url)} className={`${isSelected ? 'text-[#79B8FF]' : 'text-[#555] group-hover:text-[#777]'}`}>
                                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                    </button>
                                                    <p className={`text-xs truncate font-mono flex-grow ${isSelected ? 'text-[#79B8FF]' : 'text-[#BBB]'}`} title={url}>{url}</p>
                                                    <button onClick={() => onRemoveUrl(url)} className="text-[#555] hover:text-[#f87171] opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                                </div>
                                            );
                                        })}
                                        {group.urls.length === 0 && <p className="text-xs text-[#555] pl-8 italic">{t.noUrls}</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
          )}

          {/* Tab Content: Files */}
          {activeTab === 'files' && (
            <div className="space-y-3">
                {/* File Search & Bulk Actions */}
                <div className="px-1 space-y-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" size={14} />
                        <input 
                            type="text"
                            placeholder={language === 'bn' ? 'ফাইল খুঁজুন...' : 'Search files...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-9 pl-9 pr-8 text-sm bg-[#252525] border border-white/[.05] rounded-lg text-[#E2E2E2] placeholder-[#555] focus:ring-1 focus:ring-[#79B8FF]/50"
                        />
                    </div>
                    {/* Bulk Actions if selection exists */}
                    {selectedFileIds.size > 0 && (
                         <div className="flex items-center justify-between bg-[#79B8FF]/10 px-2 py-1.5 rounded-lg border border-[#79B8FF]/20 animate-in fade-in slide-in-from-top-1">
                             <span className="text-xs text-[#79B8FF] font-medium">{selectedFileIds.size} selected</span>
                             <div className="flex gap-2 relative">
                                 {/* Move Menu */}
                                 <div className="relative">
                                     <button onClick={() => setMoveMenuOpen(!moveMenuOpen)} className="flex items-center gap-1 text-[10px] text-[#E2E2E2] hover:text-white bg-white/10 px-2 py-1 rounded">
                                         <ArrowRightLeft size={10} /> {t.moveSelected}
                                     </button>
                                     {moveMenuOpen && (
                                         <div className="absolute right-0 top-full mt-1 w-40 bg-[#2C2C2C] border border-white/10 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
                                             {fileGroups.map(g => (
                                                 <button 
                                                    key={g.id}
                                                    onClick={() => {
                                                        onMoveFiles(Array.from(selectedFileIds), g.id);
                                                        setMoveMenuOpen(false);
                                                    }}
                                                    className="w-full text-left text-xs px-2 py-1.5 text-[#A8ABB4] hover:bg-white/5 hover:text-white truncate"
                                                 >
                                                     {g.name}
                                                 </button>
                                             ))}
                                         </div>
                                     )}
                                 </div>
                                 <button onClick={handleDownloadSelectedFiles} className="flex items-center gap-1 text-[10px] text-[#E2E2E2] hover:text-white bg-white/10 px-2 py-1 rounded">
                                     <Download size={10} />
                                 </button>
                             </div>
                         </div>
                    )}
                </div>

                {/* Collapsible Upload File Section */}
                <div className="bg-[#252525] rounded-lg p-3 border border-white/[.05] transition-all">
                    <div 
                      onClick={() => setIsUploadExpanded(!isUploadExpanded)}
                      className="flex items-center justify-between cursor-pointer select-none"
                    >
                        <div className="flex items-center gap-2">
                            <Upload size={14} className="text-[#79B8FF]" />
                            <span className="text-xs font-semibold text-[#E2E2E2]">
                                {t.uploadFileSection || (language === 'bn' ? 'নতুন ফাইল আপলোড করুন' : 'Upload New Files')}
                            </span>
                        </div>
                        <button 
                          type="button" 
                          className="p-1 text-[#A8ABB4] hover:text-white rounded hover:bg-white/10 transition-colors"
                        >
                            {isUploadExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>

                    {isUploadExpanded && (
                      <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center justify-between">
                             <label className="text-xs font-bold text-[#777777] uppercase">{t.uploadTo}</label>
                             <div className="flex items-center gap-2">
                                {isNewFileGroupMode ? (
                                    <input 
                                        type="text" 
                                        value={newFileGroupName}
                                        onChange={(e) => setNewFileGroupName(e.target.value)}
                                        placeholder={t.newGroupName}
                                        className="h-6 w-32 text-xs bg-[#2C2C2C] border border-white/10 rounded px-1 focus:outline-none focus:border-[#79B8FF]"
                                        autoFocus
                                    />
                                ) : (
                                    <select 
                                        value={uploadTargetGroupId} 
                                        onChange={(e) => {
                                            if (e.target.value === 'NEW') {
                                                setIsNewFileGroupMode(true);
                                            } else {
                                                setUploadTargetGroupId(e.target.value);
                                            }
                                        }}
                                        className="h-6 w-32 text-xs bg-[#2C2C2C] border border-white/10 rounded px-1 text-[#A8ABB4] focus:outline-none focus:border-[#79B8FF]"
                                    >
                                        {fileGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        <option value="NEW">+ {t.createNewGroup}</option>
                                    </select>
                                )}
                                {isNewFileGroupMode && <button onClick={() => setIsNewFileGroupMode(false)} className="text-[#555] hover:text-white"><X size={12}/></button>}
                             </div>
                        </div>

                        <input 
                            type="file" 
                            multiple 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileSelect} 
                            accept="application/pdf,image/*,text/*,application/json,text/markdown"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-16 border border-dashed border-white/[.1] hover:border-[#79B8FF]/50 bg-[#2C2C2C] rounded-lg flex flex-col items-center justify-center transition-all group cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                 <Upload size={16} className="text-[#777] group-hover:text-[#79B8FF]" />
                                 <span className="text-xs font-medium text-[#A8ABB4] group-hover:text-white">{t.uploadBtn}</span>
                            </div>
                        </button>
                      </div>
                    )}
                </div>

                {/* Grouped File List */}
                <div className="space-y-2">
                    {filteredFileGroups.length === 0 && (
                         <div className="text-center py-10 opacity-50">
                            <Folder size={32} className="mx-auto mb-2 text-[#555]" />
                            <p className="text-xs text-[#777]">{t.noFiles}</p>
                         </div>
                    )}
                    
                    {filteredFileGroups.map(group => {
                         const isExpanded = expandedGroups.has(group.id);
                         const allSelected = group.files.length > 0 && group.files.every(f => selectedFileIds.has(f.id));
                         const someSelected = group.files.some(f => selectedFileIds.has(f.id));
                         
                         return (
                            <div key={group.id} className="bg-[#2C2C2C] border border-[rgba(255,255,255,0.05)] rounded-lg overflow-hidden">
                                 {/* Group Header */}
                                 <div className="flex items-center px-3 py-2 bg-[#333] hover:bg-[#3a3a3a] transition-colors gap-2 group">
                                    <button onClick={() => toggleGroupExpand(group.id)} className="text-[#A8ABB4] hover:text-white">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    <button onClick={() => onToggleFileGroup(group.id, !allSelected)} className={`text-[#A8ABB4] hover:text-[#79B8FF] ${allSelected ? 'text-[#79B8FF]' : ''}`}>
                                        {allSelected ? <CheckSquare size={16} /> : (someSelected ? <Square size={16} fill="currentColor" fillOpacity={0.5} className="text-[#79B8FF]" /> : <Square size={16} />)}
                                    </button>
                                    {editingGroupId === group.id ? (
                                        <input
                                            type="text"
                                            value={editingGroupName}
                                            onChange={(e) => setEditingGroupName(e.target.value)}
                                            onBlur={() => {
                                                if (editingGroupName.trim()) {
                                                    onRenameFileGroup(group.id, editingGroupName.trim());
                                                }
                                                setEditingGroupId(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    if (editingGroupName.trim()) {
                                                        onRenameFileGroup(group.id, editingGroupName.trim());
                                                    }
                                                    setEditingGroupId(null);
                                                } else if (e.key === 'Escape') {
                                                    setEditingGroupId(null);
                                                }
                                            }}
                                            className="text-sm font-medium text-[#E2E2E2] flex-grow bg-[#2C2C2C] border border-[#79B8FF] rounded px-1 focus:outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <span 
                                            onClick={() => toggleGroupExpand(group.id)} 
                                            onDoubleClick={() => {
                                                setEditingGroupId(group.id);
                                                setEditingGroupName(group.name);
                                            }}
                                            className="text-sm font-medium text-[#E2E2E2] flex-grow cursor-pointer select-none truncate"
                                            title="Double click to rename"
                                        >
                                            {group.name} <span className="text-[#777] text-xs">({group.files.length})</span>
                                        </span>
                                    )}
                                    {editingGroupId !== group.id && (
                                        <button onClick={() => {
                                            setEditingGroupId(group.id);
                                            setEditingGroupName(group.name);
                                        }} className="text-[#555] hover:text-[#79B8FF] opacity-0 group-hover:opacity-100 transition-opacity" title="Rename group">
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                    <button onClick={() => onDeleteFileGroup(group.id)} className="text-[#555] hover:text-[#f87171] opacity-0 group-hover:opacity-100 transition-opacity" title={t.deleteGroup}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {/* Files */}
                                {isExpanded && (
                                    <div className="px-2 py-2 space-y-1 bg-[#252525]">
                                        {group.files.map(file => {
                                            const isSelected = selectedFileIds.has(file.id);
                                            return (
                                                 <div key={file.id} className={`relative flex items-start gap-2 p-2 rounded transition-all group ${isSelected ? 'bg-[#79B8FF]/10 border border-[#79B8FF]/30' : 'hover:bg-white/[.05] border border-transparent'}`}>
                                                    <button onClick={() => onToggleFile(file.id)} className={`mt-1 ${isSelected ? 'text-[#79B8FF]' : 'text-[#555] group-hover:text-[#777]'}`}>
                                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                    </button>
                                                    
                                                    {/* Preview / Icon */}
                                                    <div className="flex-shrink-0 w-8 h-8 rounded bg-[#333] flex items-center justify-center overflow-hidden border border-white/5">
                                                        {file.type === 'image' && file.preview ? (
                                                            <img src={file.preview} alt="preview" className="w-full h-full object-cover" />
                                                        ) : (
                                                            file.type === 'pdf' ? <FileType size={16} className="text-red-400" /> 
                                                            : <FileText size={16} className="text-blue-400" />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-grow">
                                                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-[#E2E2E2]' : 'text-[#BBB]'}`} title={file.file.name}>{file.file.name}</p>
                                                        
                                                        {/* Text Snippet Preview */}
                                                        {file.type === 'text' && file.preview && (
                                                            <p className="text-[10px] text-[#777] line-clamp-2 mt-0.5 font-mono bg-black/20 p-1 rounded">
                                                                {file.preview}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                         <button onClick={() => onRemoveFile(file.id)} className="text-[#555] hover:text-[#f87171]"><Trash2 size={14} /></button>
                                                    </div>
                                                 </div>
                                            );
                                        })}
                                        {group.files.length === 0 && <p className="text-xs text-[#555] pl-8 italic">{t.noFiles}</p>}
                                    </div>
                                )}
                            </div>
                         );
                    })}
                </div>
            </div>
          )}

          {/* Tab Content: Notes */}
          {activeTab === 'notes' && (
            <div className="space-y-3">
                {(!notes || notes.length === 0) ? (
                    <div className="text-center py-10 opacity-50">
                        <Edit2 size={32} className="mx-auto mb-2 text-[#555]" />
                        <p className="text-xs text-[#777] px-4">{t.noNotes}</p>
                    </div>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className="bg-[#2C2C2C] border border-white/[.05] rounded-lg p-3 group relative">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-bold text-[#79B8FF] truncate pr-8">{note.title}</h4>
                                <button 
                                    onClick={() => onDeleteNote?.(note.id)}
                                    className="absolute top-3 right-3 text-[#555] hover:text-[#f87171] opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <textarea 
                                value={note.content}
                                onChange={(e) => onUpdateNote?.(note.id, e.target.value)}
                                className="w-full bg-transparent text-xs text-[#BBB] border-none focus:ring-0 p-0 resize-none min-h-[60px] font-sans leading-relaxed"
                            />
                            <div className="mt-2 text-[9px] text-[#555] flex justify-between items-center">
                                <span>{new Date(note.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
          )}

          {/* Footer: Storage Status */}
          <div className="mt-auto pt-3 border-t border-white/[.05] flex justify-between items-center text-[10px] text-[#555] px-1">
              <div className="flex items-center gap-1.5" title="Data persists in browser">
                  <Database size={12} className="text-[#28a745]" />
                  <span className="font-medium text-[#777]">{t.storageStatusMsg || "Auto-saved to browser"}</span>
              </div>
              <div className="flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-[#28a745] rounded-full animate-pulse"></span>
                 <span>Online</span>
              </div>
          </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
