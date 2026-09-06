
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Language } from './translations';

export enum MessageSender {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface UrlContextMetadataItem {
  retrievedUrl: string; 
  urlRetrievalStatus: string; 
}

export interface DiscoveredResource {
  url: string;
  title: string;
}

export interface ComparisonData {
  title: string;
  headers: string[]; // e.g., ["Feature", "Gemini Flash", "Gemini Pro"]
  rows: string[][]; // e.g., [["Speed", "High", "Medium"], ["Cost", "Low", "High"]]
  summary: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: Date;
  isLoading?: boolean;
  urlContext?: UrlContextMetadataItem[];
  suggestedActions?: string[];
  discoveredResources?: DiscoveredResource[];
  comparisonData?: ComparisonData;
}

export interface URLGroup {
  id: string;
  name: string;
  urls: string[];
}

export interface VoiceSettings {
  speed: number;
  voiceURI: string | null;
}

export type AIModel = 'gemini-3.1-pro-preview' | 'gemini-3-flash-preview' | 'gemini-3.1-flash-lite-preview' | 'auto';

export enum ThinkingLevel {
  HIGH = "HIGH",
  LOW = "LOW",
  MINIMAL = "MINIMAL",
}

export interface Session {
  id: string;
  name: string;
  lastAccessed: string;
}

export interface Settings {
  language: Language; // Assuming Language is imported or defined elsewhere, wait, Language is in translations.ts. Let's just use string or import it.
  voiceSettings: VoiceSettings;
  aiModel: AIModel;
  activeSessionId?: string;
}

export interface LocalFile {
  id: string;
  file: File;
  type: 'image' | 'pdf' | 'text';
  preview?: string; // Base64 for image, text snippet for text
  contentHash?: string; // SHA-256 hash for deep duplicate detection
}

export interface FileGroup {
  id: string;
  name: string;
  files: LocalFile[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  timestamp: Date;
}
