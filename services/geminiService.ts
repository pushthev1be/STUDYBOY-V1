
import { GoogleGenAI, Type } from "@google/genai";
import { StudyMaterial, QuizQuestion } from "../types";

const STUDY_MATERIAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A concise title" },
    summary: { type: Type.STRING, description: "Pedagogical summary of high-yield medical concepts" },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING }
        },
        required: ["question", "answer"]
      }
    },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          correctAnswer: { type: Type.INTEGER },
          explanation: { type: Type.STRING }
        },
        required: ["question", "options", "correctAnswer", "explanation"]
      }
    }
  },
  required: ["title", "summary", "flashcards", "quiz"]
};

const ADDITIONAL_QUESTIONS_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      correctAnswer: { type: Type.INTEGER },
      explanation: { type: Type.STRING }
    },
    required: ["question", "options", "correctAnswer", "explanation"]
  }
};

const SYSTEM_INSTRUCTION = `You are a Senior PA School Professor.
1. SPEED & ACCURACY: Provide concise but high-yield medical content.
2. PANCE FORMAT: Every question is a clinical vignette (Age, Gender, Presentation).
3. KEY FOCUS: Diagnosis, Initial Test, Gold Standard, or First-line Management.
4. CLINICAL PEARLS: Brief, high-yield takeaways only.`;

export async function processStudyContent(content: string, isImage: boolean = false): Promise<StudyMaterial> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  // Using gemini-3-flash-preview for maximum speed and responsiveness
  const model = 'gemini-3-flash-preview';

  const prompt = isImage 
    ? `Analyze this clinical image. Create a PANCE-style study kit with 8 high-yield clinical vignette questions.`
    : `Based on these notes: \n\n${content}\n\nGenerate a PANCE-style study kit. 8 Clinical vignettes, summary, and flashcards. Focus on board-relevant info.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: isImage 
        ? [{ parts: [{ inlineData: { data: content, mimeType: 'image/png' } }, { text: prompt }] }]
        : [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: STUDY_MATERIAL_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for pure speed
      },
    });

    return JSON.parse(response.text || '{}') as StudyMaterial;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to process medical notes. Please ensure the content is clear.");
  }
}

export async function extendQuiz(currentTopic: string, existingCount: number): Promise<QuizQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';

  const prompt = `The student is reviewing "${currentTopic}". 
  Generate 3 NEW high-yield clinical vignettes. 
  Focus on the most common board-style complications or classic physical exam findings.
  Return only the JSON array of questions.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ADDITIONAL_QUESTIONS_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    return JSON.parse(response.text || '[]') as QuizQuestion[];
  } catch (error) {
    console.error("Gemini Extension Error:", error);
    return [];
  }
}
