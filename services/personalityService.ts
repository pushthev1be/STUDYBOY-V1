
import { GoogleGenAI } from "@google/genai";
import { PersonalityStyle } from "../types";

export async function extractPersonality(conversationText: string): Promise<PersonalityStyle> {
  console.log('[personality] extractPersonality called, input length:', conversationText.length);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY_1 || '';
  console.log('[personality] API key present:', !!apiKey);

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Analyze the following chat conversation and extract the personality, communication style, and speech patterns of the person labeled as "Person A" (or the first speaker if unlabeled). Focus on how they actually talk — their vocabulary, humor, reactions, energy.

CONVERSATION:
${conversationText.slice(0, 12000)}`;

  const systemInstruction = `You are a personality analyst. Extract communication style traits from a chat conversation.
RESPOND WITH ONLY RAW JSON — no markdown, no code fences.
Format: {"rawDescription":"string","phrases":["string"],"emojiUsage":"none|rare|moderate|frequent","humor":"string","encouragement":"string","corrections":"string"}
Start with { and end with }. Nothing else.`;

  console.log('[personality] calling generateContentStream...');
  let stream;
  try {
    stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { systemInstruction, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
    });
  } catch (e) {
    console.error('[personality] generateContentStream threw:', e);
    throw e;
  }

  let text = '';
  try {
    for await (const chunk of stream) {
      const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof part === 'string') text += part;
    }
  } catch (e) {
    console.error('[personality] error reading stream:', e);
    throw e;
  }

  console.log('[personality] streamed len:', text.length, '| preview:', text.slice(0, 100));
  if (!text.trim()) throw new Error("Empty response from Gemini");

  try {
    const clean = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
    const parsed = JSON.parse(clean) as PersonalityStyle;
    console.log('[personality] parsed OK');
    return parsed;
  } catch (e) {
    console.error('[personality] JSON.parse failed, raw:', text.slice(0, 300));
    throw new Error('Failed to parse personality response: ' + (e as Error).message);
  }
}

export function buildPersonalityInstruction(name: string, style: PersonalityStyle): string {
  return `You are ${name}. You are quizzing your girlfriend on her study material. Speak exactly like ${name} does — stay in character the entire time.

WHO YOU ARE:
${style.rawDescription}

YOUR PHRASES (use these naturally):
${style.phrases.join(', ')}

YOUR HUMOR: ${style.humor}
HOW YOU REACT WHEN SHE'S RIGHT: ${style.encouragement}
HOW YOU REACT WHEN SHE'S WRONG: ${style.corrections}
EMOJI USAGE: ${style.emojiUsage}

RULES:
- One question per turn. Always.
- React to her answer first, then ask the next question.
- Sound like yourself — casual, natural, exactly how you'd text her.
- Keep questions short. Under 15 words.
- Stay warm. This is your girlfriend, not a stranger.`;
}
