
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useState, useRef } from 'react';
import { X, Volume2, Database, Trash2, Download, Upload, RefreshCw, LogOut, Cpu } from 'lucide-react';
import { VoiceSettings, AIModel } from '../types';
import { translations, Language } from '../translations';
import { clearDB, exportDatabase, importDatabase } from '../services/db';
import { logout } from '../services/firebase';

interface SettingsModalProps {
  activeSessionId?: string;
  isOpen: boolean;
  onClose: () => void;
  voiceSettings: VoiceSettings;
  onVoiceSettingsChange: (settings: VoiceSettings) => void;
  language: Language;
  aiModel: AIModel;
  onAiModelChange: (model: AIModel) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  activeSessionId,
  isOpen,
  onClose,
  voiceSettings,
  onVoiceSettingsChange,
  language,
  aiModel,
  onAiModelChange
}) => {
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    
    // Chrome loads voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleClearData = async () => {
      if (window.confirm(t.clearStorageConfirm)) {
          await clearDB(activeSessionId);
          alert(t.storageCleared);
          window.location.reload();
      }
  };

  const handleExport = async () => {
      try {
          setIsProcessing(true);
          const json = await exportDatabase();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `chat-docs-backup-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error(e);
          alert("Export failed.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!window.confirm(t.importConfirm)) {
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
      }

      try {
          setIsProcessing(true);
          const text = await file.text();
          const success = await importDatabase(text, activeSessionId);
          if (success) {
              alert(t.importSuccessMsg);
              window.location.reload();
          } else {
              alert("Import failed. Invalid file format.");
          }
      } catch (e) {
          console.error(e);
          alert("Error reading file.");
      } finally {
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  if (!isOpen) return null;

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onVoiceSettingsChange({
      ...voiceSettings,
      speed: parseFloat(e.target.value)
    });
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onVoiceSettingsChange({
      ...voiceSettings,
      voiceURI: e.target.value === 'default' ? null : e.target.value
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1E1E1E] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.05)] bg-[#252525]">
          <h2 className="text-lg font-semibold text-[#E2E2E2] flex items-center gap-2">
            <Volume2 size={20} className="text-[#79B8FF]" />
            {t.settings}
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 text-[#A8ABB4] hover:text-white rounded-md hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* AI Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-[#E2E2E2] flex items-center gap-2">
                <Cpu size={16} className="text-[#79B8FF]" />
                {t.aiModel}
              </label>
            </div>
            <select
              value={aiModel}
              onChange={(e) => onAiModelChange(e.target.value as AIModel)}
              className="w-full p-2.5 bg-[#2C2C2C] border border-[rgba(255,255,255,0.1)] rounded-lg text-sm text-[#E2E2E2] focus:ring-1 focus:ring-[#79B8FF] outline-none"
            >
              <option value="auto">{t.modelAuto}</option>
              <option value="gemini-3.1-pro-preview">{t.modelPro}</option>
              <option value="gemini-3-flash-preview">{t.modelFlash}</option>
              <option value="gemini-3.1-flash-lite-preview">{t.modelFlashLite}</option>
            </select>
            <p className="text-xs text-[#777] mt-2">
              {t.aiModelInfo}
            </p>
          </div>

          {/* Voice Speed */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-[#E2E2E2]">{t.voiceSpeed}</label>
              <span className="text-xs text-[#79B8FF] font-mono bg-[#79B8FF]/10 px-2 py-0.5 rounded">
                {voiceSettings.speed.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={voiceSettings.speed}
              onChange={handleSpeedChange}
              className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#79B8FF]"
            />
            <div className="flex justify-between mt-1 text-[10px] text-[#777]">
              <span>0.5x</span>
              <span>1.0x</span>
              <span>2.0x</span>
            </div>
          </div>

          {/* Voice Selection */}
          <div>
            <label className="block text-sm font-medium text-[#E2E2E2] mb-2">{t.voiceTone}</label>
            <select
              value={voiceSettings.voiceURI || 'default'}
              onChange={handleVoiceChange}
              className="w-full p-2.5 bg-[#2C2C2C] border border-[rgba(255,255,255,0.1)] rounded-lg text-sm text-[#E2E2E2] focus:ring-1 focus:ring-[#79B8FF] outline-none"
            >
              <option value="default">{t.systemDefault}</option>
              <optgroup label="Gemini High-Quality Voices">
                <option value="gemini-Zephyr">Zephyr (Gemini)</option>
                <option value="gemini-Kore">Kore (Gemini)</option>
                <option value="gemini-Puck">Puck (Gemini)</option>
                <option value="gemini-Charon">Charon (Gemini)</option>
                <option value="gemini-Fenrir">Fenrir (Gemini)</option>
              </optgroup>
              <optgroup label="System Voices">
                {availableVoices.map((voice, index) => (
                  <option key={`${voice.voiceURI}-${index}`} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="text-xs text-[#777] mt-2">
              {t.voiceToneInfo}
            </p>
          </div>

          {/* Backup & Restore */}
          <div className="pt-4 border-t border-white/[.05]">
               <h3 className="text-sm font-medium text-[#E2E2E2] mb-3 flex items-center gap-2">
                  <Database size={16} className="text-[#A8ABB4]" />
                  {t.backupRestore}
              </h3>
              <p className="text-xs text-[#777] mb-3 leading-relaxed">
                  {t.backupDesc}
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleExport}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-[#2C2C2C] hover:bg-[#333] border border-white/[.1] hover:border-[#79B8FF]/50 rounded-lg transition-all group"
                  >
                      {isProcessing ? <RefreshCw size={20} className="animate-spin text-[#79B8FF]"/> : <Download size={20} className="text-[#79B8FF] group-hover:scale-110 transition-transform"/>}
                      <span className="text-xs font-medium text-[#E2E2E2]">{t.exportData}</span>
                  </button>
                  
                  <button 
                    onClick={handleImportClick}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-[#2C2C2C] hover:bg-[#333] border border-white/[.1] hover:border-green-400/50 rounded-lg transition-all group"
                  >
                      {isProcessing ? <RefreshCw size={20} className="animate-spin text-green-400"/> : <Upload size={20} className="text-green-400 group-hover:scale-110 transition-transform"/>}
                      <span className="text-xs font-medium text-[#E2E2E2]">{t.importData}</span>
                  </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleFileChange}
              />
          </div>

          {/* Data Management Section */}
          <div className="pt-4 border-t border-white/[.05]">
              <h3 className="text-sm font-medium text-[#E2E2E2] mb-3 flex items-center gap-2">
                  <Trash2 size={16} className="text-red-400" />
                  {t.dangerZone}
              </h3>
              <div className="space-y-3">
                <button 
                  onClick={handleClearData}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20"
                >
                    {t.clearStorage}
                </button>
                <button 
                  onClick={async () => {
                    await logout();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#333] hover:bg-[#3D3D3D] text-[#E2E2E2] text-sm font-medium rounded-lg transition-colors border border-white/[.05]"
                >
                    <LogOut size={16} />
                    Sign Out
                </button>
              </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.05)] bg-[#252525] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#333] hover:bg-[#3D3D3D] text-[#E2E2E2] text-sm font-medium rounded-lg transition-colors border border-white/[.05]"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
