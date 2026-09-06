/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { GoogleGenAI, GenerateContentResponse, Tool, HarmCategory, HarmBlockThreshold, Content, Part, ThinkingLevel as GenAIThinkingLevel, Modality, LiveServerMessage, LiveCallbacks } from "@google/genai";
import { UrlContextMetadataItem, DiscoveredResource, ComparisonData, LocalFile, AIModel, ThinkingLevel } from '../types';
import { Language } from '../translations';

// IMPORTANT: The API key MUST be set as an environment variable `process.env.API_KEY`
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI;

const getAiInstance = (): GoogleGenAI => {
  if (!API_KEY) {
    console.error("API_KEY is not set in environment variables. Please set process.env.API_KEY.");
    throw new Error("Gemini API Key not configured. Set process.env.API_KEY.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

export const determineModel = (modelPref: AIModel, promptLength: number, urlCount: number, isComplexTask: boolean = false): string => {
    if (modelPref !== 'auto') return modelPref;
    
    // Auto routing logic
    // If many URLs or very long prompt, maybe use flash to save tokens, or use pro if deep analysis is requested.
    if (urlCount > 3 || promptLength > 1000) {
        return 'gemini-3-flash-preview'; // Save tokens on large contexts
    }
    
    if (isComplexTask) {
        return 'gemini-3.1-pro-preview'; // Deep analysis
    }

    if (promptLength < 200 && urlCount === 0) {
        return 'gemini-3.1-flash-lite-preview'; // Fast response for short queries
    }
    
    // Default for simple tasks
    return 'gemini-3-flash-preview';
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

/**
 * Wrapper function for Gemini API calls to handle 429 (Quota Exceeded) errors with exponential backoff.
 * Retries after 5, 10, and 30 seconds.
 */
const withExponentialBackoff = async <T>(operation: () => Promise<T>): Promise<T> => {
    const delays = [5000, 10000, 30000]; // 5s, 10s, 30s
    let attempt = 0;

    while (attempt <= delays.length) {
        try {
            return await operation();
        } catch (error: any) {
            const isRateLimit = error?.message?.includes('429') || error?.message?.includes('quota') || error?.status === 429;
            
            if (isRateLimit && attempt < delays.length) {
                console.warn(`Rate limit hit (429). Retrying in ${delays[attempt] / 1000} seconds... (Attempt ${attempt + 1}/${delays.length})`);
                await new Promise(resolve => setTimeout(resolve, delays[attempt]));
                attempt++;
            } else {
                throw error;
            }
        }
    }
    throw new Error('Max retries reached for rate limit.');
};

interface GeminiResponse {
  text: string;
  urlContextMetadata?: UrlContextMetadataItem[];
  discoveredResources?: DiscoveredResource[];
  comparisonData?: ComparisonData;
}

import { extractTextFromPdf } from '../utils/pdfExtractor';

/**
 * Generates a podcast-style audio overview of the selected sources.
 */
export const generateAudioOverview = async (urls: string[], files: LocalFile[], language: Language): Promise<string> => {
    const currentAi = getAiInstance();
    const langName = language === 'bn' ? 'Bengali' : 'English';

    // 1. Generate Script
    const scriptPrompt = `Generate a podcast-style conversation script between two speakers, Alex and Taylor, summarizing the key points from the provided sources. 
    The conversation should be engaging, informative, and natural. 
    Alex is the host, and Taylor is the expert.
    The script should be in ${langName}.
    Format the script exactly like this:
    Alex: [Speech]
    Taylor: [Speech]
    Alex: [Speech]
    ...
    `;

    const scriptResponse = await generateContentWithUrlContext(scriptPrompt, urls, language, files, 'gemini-3.1-pro-preview');
    const script = scriptResponse.text;

    // 2. Generate Audio using TTS
    const ttsResponse = await withExponentialBackoff(async () => {
        return await currentAi.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `TTS the following conversation between Alex and Taylor: \n\n${script}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: [
                            {
                                speaker: 'Alex',
                                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                            },
                            {
                                speaker: 'Taylor',
                                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
                            }
                        ]
                    }
                }
            }
        });
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Failed to generate audio content.");
    }

    // Convert base64 to PCM and then to WAV Blob
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    // Create WAV header for 24kHz Mono PCM
    const wavHeader = createWavHeader(bytes.length, 24000);
    const wavBytes = new Uint8Array(wavHeader.length + bytes.length);
    wavBytes.set(wavHeader);
    wavBytes.set(bytes, wavHeader.length);

    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
};

// Helper to convert File to Gemini Part
const fileToPart = async (localFile: LocalFile, prompt?: string): Promise<Part[]> => {
    const { file, type } = localFile;

    if (type === 'text') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                resolve([{
                    text: `\n\n--- Start of File: ${file.name} ---\n${text}\n--- End of File ---\n\n`
                }]);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    } else if (file.type === 'application/pdf') {
        try {
            const text = await extractTextFromPdf(file);
            // Hybrid Context Routing (The 200k Rule)
            // 1 token ≈ 4 characters. 200,000 tokens ≈ 800,000 characters.
            if (text.length <= 800000) {
                return [{
                    text: `\n\n--- Start of PDF File: ${file.name} ---\n${text}\n--- End of PDF File ---\n\n`
                }];
            } else {
                // RAG-based chunking logic (simplified for client-side)
                // If text is too large, we chunk it and retrieve the most relevant chunks based on the prompt.
                const chunkSize = 100000; // ~25k tokens per chunk
                const chunks: string[] = [];
                for (let i = 0; i < text.length; i += chunkSize) {
                    chunks.push(text.substring(i, i + chunkSize));
                }

                if (!prompt) {
                    // If no prompt provided, just return the first 800k characters
                    const truncatedText = text.substring(0, 800000);
                    return [{
                        text: `\n\n--- Start of PDF File: ${file.name} (Truncated due to size) ---\n${truncatedText}\n--- End of PDF File ---\n\n`
                    }];
                }

                // Simple keyword-based scoring for chunks
                const keywords = prompt.toLowerCase().split(/\W+/).filter(w => w.length > 3);
                const scoredChunks = chunks.map(chunk => {
                    const chunkLower = chunk.toLowerCase();
                    let score = 0;
                    keywords.forEach(kw => {
                        if (chunkLower.includes(kw)) score++;
                    });
                    return { chunk, score };
                });

                // Sort by score descending and take top chunks up to ~800k characters
                scoredChunks.sort((a, b) => b.score - a.score);
                let selectedText = '';
                for (const sc of scoredChunks) {
                    if (selectedText.length + sc.chunk.length <= 800000) {
                        selectedText += sc.chunk + '\n...\n';
                    } else {
                        break;
                    }
                }

                return [{
                    text: `\n\n--- Start of PDF File: ${file.name} (Relevant Chunks Extracted) ---\n${selectedText}\n--- End of PDF File ---\n\n`
                }];
            }
        } catch (error) {
            console.error("Error extracting text from PDF:", error);
            // Fallback to base64 if text extraction fails
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    resolve([{
                        inlineData: {
                            data: base64String,
                            mimeType: file.type
                        }
                    }]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    } else if (file.type.startsWith('video/')) {
        // Video -> Base64 InlineData
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve([{
                    inlineData: {
                        data: base64String,
                        mimeType: file.type
                    }
                }]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    } else {
        // Image -> Base64 InlineData
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve([{
                    inlineData: {
                        data: base64String,
                        mimeType: file.type
                    }
                }]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
};

export const generateSpeech = async (text: string, voiceName: string = 'Zephyr'): Promise<string | null> => {
  const currentAi = getAiInstance();
  try {
    const response = await withExponentialBackoff(() => currentAi.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
        },
      },
    }));

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    }
    return null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
};

export const generateContentWithUrlContext = async (
  prompt: string,
  urls: string[],
  language: Language,
  files: LocalFile[] = [],
  modelPref: AIModel = 'auto',
  thinkingLevel?: ThinkingLevel,
  useMaps: boolean = false
): Promise<GeminiResponse> => {
  const currentAi = getAiInstance();
  
  let fullPrompt = prompt;
  
  // Add language instruction
  if (language === 'bn') {
      fullPrompt += "\n\n(IMPORTANT: Please answer the user's question entirely in Bengali/Bangla language. Use Markdown for formatting.)";
  } else {
      fullPrompt += "\n\n(Please answer in English.)";
  }

  // Handle URLs via prompt augmentation (if grounding tool is not exclusive usage)
  // Note: We use the `urlContext` tool below for strict grounding, but we also list them in prompt for clarity if needed.
  if (urls.length > 0) {
    const urlList = urls.join('\n');
    fullPrompt = `${fullPrompt}\n\nRelevant URLs for context:\n${urlList}`;
  }

  if (files.length > 0) {
      fullPrompt += `\n\nI have attached ${files.length} file(s) for context. Please analyze them to answer the question.`;
  }

  // Prepare parts: Prompt + Files
  const parts: Part[] = [{ text: fullPrompt }];
  
  // Process files concurrently
  if (files.length > 0) {
      const fileParts = await Promise.all(files.map(f => fileToPart(f, prompt)));
      parts.push(...fileParts.flat());
  }

  const tools: Tool[] = [];
  // Only add urlContext tool if URLs are present. 
  // Note: Gemini sometimes conflicts if tools are present but not relevant to the specific prompt parts.
  if (urls.length > 0) {
      tools.push({ urlContext: {} });
  }

  // Add Google Search grounding by default for general queries if no specific URLs provided
  if (urls.length === 0) {
      tools.push({ googleSearch: {} });
  }

  // Add Google Maps grounding if requested
  if (useMaps) {
      tools.push({ googleMaps: {} });
  }

  const contents: Content[] = [{ role: "user", parts: parts }];
  
  const selectedModel = determineModel(modelPref, fullPrompt.length, urls.length, thinkingLevel === ThinkingLevel.HIGH || files.some(f => f.type === 'image' || f.type.startsWith('video/')));

  const config: any = { 
    tools: tools,
    safetySettings: safetySettings,
  };

  if (thinkingLevel) {
      config.thinkingConfig = {
          thinkingLevel: thinkingLevel as unknown as GenAIThinkingLevel
      };
  }

  try {
    const response: GenerateContentResponse = await withExponentialBackoff(() => currentAi.models.generateContent({
      model: selectedModel,
      contents: contents,
      config: config,
    }));

    const text = response.text || "";
    const candidate = response.candidates?.[0];
    let extractedUrlContextMetadata: UrlContextMetadataItem[] | undefined = undefined;

    if (candidate && candidate.urlContextMetadata && candidate.urlContextMetadata.urlMetadata) {
      extractedUrlContextMetadata = candidate.urlContextMetadata.urlMetadata as UrlContextMetadataItem[];
    }
    
    // Extract grounding chunks for search/maps
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks;
    const discoveredResources: DiscoveredResource[] = [];
    if (groundingChunks) {
        groundingChunks.forEach(chunk => {
            if (chunk.web) {
                discoveredResources.push({
                    url: chunk.web.uri || '',
                    title: chunk.web.title || chunk.web.uri || 'Resource',
                });
            } else if (chunk.maps) {
                discoveredResources.push({
                    url: chunk.maps.uri || '',
                    title: chunk.maps.title || 'Map Location',
                });
            }
        });
    }
    
    return { text, urlContextMetadata: extractedUrlContextMetadata, discoveredResources };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      const googleError = error as any; 
      if (googleError.message && googleError.message.includes("API key not valid")) {
         throw new Error("Invalid API Key. Please check your API_KEY environment variable.");
      }
      if (googleError.message && googleError.message.includes("quota")) {
        throw new Error("API quota exceeded. Please check your Gemini API quota.");
      }
      throw new Error(`Failed to get response from AI: ${error.message}`);
    }
    throw new Error("Failed to get response from AI due to an unknown error.");
  }
};

// This function now aims to get a JSON array of string suggestions.
export const getInitialSuggestions = async (urls: string[], language: Language, modelPref: AIModel = 'auto'): Promise<GeminiResponse> => {
  if (urls.length === 0) {
    return { text: JSON.stringify({ suggestions: ["Add some URLs to get topic suggestions."] }) };
  }
  const currentAi = getAiInstance();
  const urlList = urls.join('\n');
  
  const langName = language === 'bn' ? 'Bengali (Bangla)' : 'English';

  // Prompt updated to request JSON output of short questions in target language
  // STERN INSTRUCTION: Only ask things present in the text.
  const promptText = `Analyze the content of the following documentation URLs.
  Generate 4 concise, interesting questions that a user can ask about these specific documents.
  
  STRICT RULES:
  1. The questions MUST be answerable solely from the provided documentation context.
  2. Do NOT generate generic questions (e.g. "What is this?"). Be specific to the content (e.g. "How does X feature work?").
  3. If the content is minimal, generate fewer questions.
  4. The questions MUST be in ${langName} language.
  
  OUTPUT FORMAT:
  Return ONLY a raw JSON object (no markdown formatting, no code fences if possible, just the json) with a key "suggestions" containing an array of these question strings.
Relevant URLs:
${urlList}`;

  const contents: Content[] = [{ role: "user", parts: [{ text: promptText }] }];
  const tools: Tool[] = [{ urlContext: {} }];
  
  const selectedModel = determineModel(modelPref, promptText.length, urls.length, false);

  try {
    const response: GenerateContentResponse = await withExponentialBackoff(() => currentAi.models.generateContent({
      model: selectedModel,
      contents: contents,
      config: {
        tools: tools,
        safetySettings: safetySettings,
        // responseMimeType: "application/json", // REMOVED: Incompatible with tools
      },
    }));

    return { text: response.text || "" }; 

  } catch (error) {
    console.error("Error calling Gemini API for initial suggestions:", error);
    return { text: JSON.stringify({ suggestions: [] }) };
  }
};

export const getFollowUpSuggestions = async (lastUserQuery: string, lastModelResponse: string, language: Language, modelPref: AIModel = 'auto'): Promise<string[]> => {
  const currentAi = getAiInstance();
  const langName = language === 'bn' ? 'Bengali (Bangla)' : 'English';
  
  // Prompt to get 5 follow-up actions
  // STERN INSTRUCTION: Grounding.
  const promptText = `You are a helpful AI assistant. 
  User asked: "${lastUserQuery}"
  AI answered: "${lastModelResponse.substring(0, 2000)}..."
  
  Provide exactly 4-5 short, relevant follow-up questions the user might want to ask next.
  
  STRICT RULES:
  1. Questions MUST be based on the information provided in the AI's answer or the visible context.
  2. If the AI answer states that information is unavailable/missing, do NOT ask follow-up questions about that specific missing info.
  3. If the answer is "I don't know", suggest the user to try a different search term or add more context.
  4. The questions MUST be in ${langName} language.
  
  Return ONLY a JSON object with a key "actions" containing an array of strings.`;

  const contents: Content[] = [{ role: "user", parts: [{ text: promptText }] }];
  
  const selectedModel = determineModel(modelPref, promptText.length, 0, false);

  try {
    const response: GenerateContentResponse = await withExponentialBackoff(() => currentAi.models.generateContent({
      model: selectedModel,
      contents: contents,
      config: {
        safetySettings: safetySettings,
        responseMimeType: "application/json", // OK here because no tools are used
      },
    }));

    if (response.text) {
        try {
            const parsed = JSON.parse(response.text);
            if (parsed && Array.isArray(parsed.actions)) {
                return (parsed.actions as unknown[])
                  .filter((item: unknown): item is string => typeof item === 'string')
                  .slice(0, 5);
            }
        } catch (e) {
            console.warn("Failed to parse follow-up actions JSON", e);
        }
    }
    return [];
  } catch (error) {
    console.error("Error getting follow-up suggestions:", error);
    return [];
  }
};

/**
 * Helper to create a WAV header for PCM data.
 */
function createWavHeader(dataLength: number, sampleRate: number): Uint8Array {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    // file length
    view.setUint32(4, 36 + dataLength, true);
    // RIFF type
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // format chunk identifier
    view.setUint32(12, 0x666d7420, false); // "fmt "
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw PCM)
    view.setUint16(20, 1, true);
    // channel count (mono)
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, false); // "data"
    // data chunk length
    view.setUint32(40, dataLength, true);

    return new Uint8Array(header);
}

/**
 * Performs deep research to find resources using Google Search tool.
 */
export const discoverResources = async (topic: string, language: Language, modelPref: AIModel = 'auto'): Promise<GeminiResponse> => {
  const currentAi = getAiInstance();
  
  const langName = language === 'bn' ? 'Bengali' : 'English';
  const prompt = `Research and find the best official documentation, guides, or high-quality articles about: "${topic}".
  
  Focus on finding exact URLs that are useful for learning or technical reference.
  Provide a brief summary of what you found in ${langName}.`;

  const contents: Content[] = [{ role: "user", parts: [{ text: prompt }] }];
  const tools: Tool[] = [{ googleSearch: {} }];
  
  const selectedModel = determineModel(modelPref, prompt.length, 0, false);

  try {
    const response: GenerateContentResponse = await withExponentialBackoff(() => currentAi.models.generateContent({
      model: selectedModel,
      contents: contents,
      config: {
        tools: tools,
        safetySettings: safetySettings,
      },
    }));

    const text = response.text || "";
    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks;
    
    const discoveredResources: DiscoveredResource[] = [];

    if (groundingChunks) {
      groundingChunks.forEach(chunk => {
        if (chunk.web) {
          discoveredResources.push({
            url: chunk.web.uri || '',
            title: chunk.web.title || chunk.web.uri || 'Resource',
          });
        }
      });
    }

    // Filter duplicates and empty URLs
    const uniqueResources = discoveredResources
      .filter(r => r.url && r.url.startsWith('http'))
      .filter((r, index, self) => 
        index === self.findIndex((t) => (
          t.url === r.url
        ))
      );

    return { text, discoveredResources: uniqueResources };

  } catch (error) {
    console.error("Error discovering resources:", error);
     if (error instanceof Error) {
        throw new Error(`Discovery failed: ${error.message}`);
     }
     throw new Error("Discovery failed due to unknown error.");
  }
};

/**
 * Connects to Gemini Live API for real-time voice conversations.
 */
export const connectToLiveAPI = async (
  callbacks: LiveCallbacks,
  systemInstruction?: string
) => {
  const currentAi = getAiInstance();
  
  return currentAi.live.connect({
    model: "gemini-3.1-flash-live-preview",
    callbacks: callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      systemInstruction: systemInstruction || "You are a helpful assistant.",
    },
  });
};

/**
 * Transcribes audio from microphone input.
 */
export const transcribeAudio = async (audioData: string, mimeType: string = 'audio/wav'): Promise<string | null> => {
    const currentAi = getAiInstance();
    try {
        const response = await withExponentialBackoff(() => currentAi.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
                parts: [
                    { text: "Transcribe the following audio precisely. Return only the transcription text." },
                    { inlineData: { data: audioData, mimeType: mimeType } }
                ]
            }],
        }));
        return response.text || null;
    } catch (error) {
        console.error("Error transcribing audio:", error);
        return null;
    }
};
export const generateComparison = async (topic: string, urls: string[], language: Language, files: LocalFile[] = [], modelPref: AIModel = 'auto'): Promise<GeminiResponse> => {
    const currentAi = getAiInstance();
    const langName = language === 'bn' ? 'Bengali' : 'English';
    const urlList = urls.join('\n');

    let fullPrompt = `You are an expert technical analyst. The user wants a comparison based on the provided docs and files.
    Topic/Items to compare: "${topic}"
    
    Instruction:
    1. Identify the entities being compared (e.g., "Flash vs Pro" -> Entities: Gemini Flash, Gemini Pro).
    2. Determine the most relevant criteria for comparison (e.g., Cost, Latency, Features).
    3. Generate a structured JSON response.
    4. Provide a brief summary in ${langName} text.
    
    Response JSON Schema:
    {
      "title": "Comparison Title",
      "headers": ["Feature", "Item A", "Item B"], 
      "rows": [
        ["Speed", "Fast", "Moderate"],
        ["Cost", "Low", "High"]
      ],
      "summary": "Brief summary text in ${langName}"
    }

    OUTPUT FORMAT: Return raw JSON.

    Relevant URLs:
    ${urlList}`;

    if (files.length > 0) {
        fullPrompt += `\n\nAlso consider the attached ${files.length} file(s) for comparison data.`;
    }

    const parts: Part[] = [{ text: fullPrompt }];
    if (files.length > 0) {
        const fileParts = await Promise.all(files.map(f => fileToPart(f, topic)));
        parts.push(...fileParts.flat());
    }

    const contents: Content[] = [{ role: "user", parts: parts }];
    const tools: Tool[] = urls.length > 0 ? [{ urlContext: {} }] : [];

    const config: any = {
        tools: tools,
        safetySettings: safetySettings,
    };
    
    // Only use responseMimeType if tools are empty (JSON mode incompatible with tools)
    if (tools.length === 0) {
        config.responseMimeType = "application/json";
    }
    
    const selectedModel = determineModel(modelPref, fullPrompt.length, urls.length, true);

    try {
        const response: GenerateContentResponse = await withExponentialBackoff(() => currentAi.models.generateContent({
            model: selectedModel,
            contents: contents,
            config: config,
        }));

        const jsonText = response.text || "{}";
        let parsedData: ComparisonData | undefined;
        let textSummary = "";
        let extractedUrlContextMetadata: UrlContextMetadataItem[] | undefined = undefined;

        try {
             // Handle markdown code blocks if JSON mode wasn't used
             let cleanJson = jsonText.trim();
             const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
             const match = cleanJson.match(fenceRegex);
             if (match && match[1]) {
                 cleanJson = match[1].trim();
             }

             const parsed = JSON.parse(cleanJson);
             if (parsed.headers && parsed.rows) {
                 parsedData = {
                     title: parsed.title || "Comparison",
                     headers: parsed.headers,
                     rows: parsed.rows,
                     summary: parsed.summary || ""
                 };
                 textSummary = parsed.summary || "Here is the comparison table.";
             }
        } catch (e) {
            console.error("Failed to parse comparison JSON", e);
            textSummary = "Failed to generate structured comparison table. (Raw text output)";
            if (!parsedData && jsonText.length > 20) textSummary = jsonText; // Fallback to raw text if parsing fails
        }

        const candidate = response.candidates?.[0];
        if (candidate && candidate.urlContextMetadata && candidate.urlContextMetadata.urlMetadata) {
            extractedUrlContextMetadata = candidate.urlContextMetadata.urlMetadata as UrlContextMetadataItem[];
        }

        return { 
            text: textSummary, 
            comparisonData: parsedData,
            urlContextMetadata: extractedUrlContextMetadata
        };

    } catch (error) {
        console.error("Error generating comparison:", error);
        throw new Error("Comparison failed.");
    }
};