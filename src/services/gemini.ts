import { GoogleGenAI, Type, type GenerateContentResponse } from "@google/genai";
import { getSetting } from "../lib/db";

let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

async function getApiKey(): Promise<string | undefined> {
  const userApiKey = await getSetting<string>('gemini-api-key');
  return userApiKey || process.env.GEMINI_API_KEY;
}

export async function getAI() {
  const apiKey = await getApiKey();

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
}

async function generateContentLocal(params: any): Promise<GenerateContentResponse> {
  const localUrl = await getSetting<string>('local-ai-url');
  const localModel = await getSetting<string>('local-ai-model') || 'local-model';

  if (!localUrl) throw new Error("Local AI URL is not configured.");

  const baseUrl = localUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  // Convert Gemini prompt to OpenAI format
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

  // Mock Gemini response structure
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
  const localUrl = await getSetting<string>('local-ai-url');
  const isLocal = localUrl && localUrl.trim().length > 0;

  const prompt = `Correct the grammar, spelling, punctuation, and style of the following text. 
    Focus strictly on grammar and clarity. 
    Text: ${JSON.stringify(text)}`;

  let response: GenerateContentResponse;

  if (isLocal) {
    response = await generateContentLocal({ contents: prompt });
  } else {
    const ai = await getAI();
    const model = "gemini-3-flash-preview";
    
    response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
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
  }

  // Extract JSON from response (handles potential markdown or extra text from local models)
  const rawText = response.text || '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const result = JSON.parse(jsonMatch[0]);
  return result as GrammarResult;
}
