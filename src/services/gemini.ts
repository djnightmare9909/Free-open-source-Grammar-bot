import { GoogleGenAI, Type, ThinkingLevel, type GenerateContentResponse } from "@google/genai";
import { getSetting } from "../lib/db";

let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

// Cache settings in memory to avoid repeated IndexedDB lookups
let cachedSettings: {
  apiKey?: string;
  localUrl?: string;
  localModel?: string;
  lastUpdate: number;
} = { lastUpdate: 0 };

const CACHE_TTL = 5000; // 5 seconds

async function getCachedSettings() {
  const now = Date.now();
  if (now - cachedSettings.lastUpdate > CACHE_TTL) {
    const [apiKey, localUrl, localModel] = await Promise.all([
      getSetting<string>('gemini-api-key'),
      getSetting<string>('local-ai-url'),
      getSetting<string>('local-ai-model')
    ]);
    cachedSettings = {
      apiKey: apiKey || process.env.GEMINI_API_KEY,
      localUrl,
      localModel,
      lastUpdate: now
    };
  }
  return cachedSettings;
}

export async function getAI() {
  const settings = await getCachedSettings();
  const apiKey = settings.apiKey;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please add it to your environment variables or settings.");
  }

  if (apiKey !== currentApiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentApiKey = apiKey;
  }

  return aiInstance!;
}

export function resetAI() {
  aiInstance = null;
  currentApiKey = null;
  cachedSettings.lastUpdate = 0; // Invalidate cache
}

async function generateContentLocal(params: any): Promise<GenerateContentResponse> {
  const settings = await getCachedSettings();
  const localUrl = settings.localUrl;
  const localModel = settings.localModel || 'local-model';

  if (!localUrl) throw new Error("Local AI URL is not configured.");

  const baseUrl = localUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const prompt = typeof params.contents === 'string' 
    ? params.contents 
    : params.contents.parts?.[0]?.text || JSON.stringify(params.contents);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: localModel,
      messages: [
        { role: 'system', content: 'You are a professional grammar checker. Return ONLY a JSON object with "correctedText" and "changes".' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Local AI Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;

  return {
    text: text,
    candidates: [{ content: { parts: [{ text }], role: 'model' } }],
  } as any;
}

export interface GrammarResult {
  correctedText: string;
  changes: string[];
}

export async function checkGrammar(text: string): Promise<GrammarResult> {
  const settings = await getCachedSettings();
  const isLocal = settings.localUrl && settings.localUrl.trim().length > 0;

  const prompt = `Correct the grammar, spelling, punctuation, and style of the following text. 
    Focus strictly on grammar and clarity. 
    Text: ${JSON.stringify(text)}`;

  let response: GenerateContentResponse;

  try {
    if (isLocal) {
      response = await generateContentLocal({ contents: prompt });
    } else {
      const ai = await getAI();
      const model = "gemini-3.1-flash-lite-preview";
      
      // Add a timeout to prevent hanging indefinitely
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            // Use MINIMAL for Flash Lite to ensure fastest response
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                correctedText: {
                  type: Type.STRING,
                  description: "The fully corrected version of the input text.",
                },
                changes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "A list of specific changes made to the text.",
                },
              },
              required: ["correctedText", "changes"],
            },
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const rawText = response.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('The AI returned an invalid response format. Please try again.');
    }

    const result = JSON.parse(jsonMatch[0]);
    if (!result.correctedText) {
      throw new Error('The AI failed to generate a correction. Please try again.');
    }
    
    return result as GrammarResult;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('The request timed out. Please check your connection or try a shorter text.');
    }
    console.error('Grammar check error:', err);
    throw err;
  }
}
