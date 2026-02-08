
import { GoogleGenAI, Type } from "@google/genai";
import { StudyMaterial, QuizQuestion, StudyDomain } from "../types";

// Domain-specific system instructions
const DOMAIN_INSTRUCTIONS: Record<StudyDomain, string> = {
  'PA': `You are a Senior PA School Professor specializing in PANCE prep.
1. PANCE FORMAT: Every question is a clinical vignette (Age, Gender, Presentation).
2. BOARD-FOCUSED: Diagnose, Initial Test, Gold Standard, or First-line Management.
3. HIGH-YIELD: Focus on common conditions, classic presentations, board-style reasoning.`,

  'Nursing': `You are a Nursing Education Expert preparing students for NCLEX.
1. NURSING FOCUS: Assess, Diagnose, Plan, Implement, Evaluate (ADPIE framework).
2. PATIENT CARE: Emphasize nursing interventions, patient safety, and clinical judgment.
3. SCOPE: Cover pathophysiology, assessment, nursing actions, and patient education.`,

  'Medical': `You are a Medical School Professor for USMLE/board prep.
1. MEDICAL LEVEL: Detailed pathophysiology, mechanisms, and evidence-based reasoning.
2. COMPREHENSIVE: Cover etiology, pathology, presentation, diagnosis, and management.
3. CLINICAL VIGNETTES: Realistic case presentations with board-style questions.`,

  'GenEd': `You are an expert educator creating comprehensive study materials.
1. ACCESSIBLE: Clear, well-organized content for any learning level.
2. COMPREHENSIVE: Cover key concepts, relationships, and clinical applications.
3. VARIED: Mix of definitions, mechanisms, comparisons, and practical examples.`
};

// Simple fallback data when API fails
const FALLBACK_STUDY_MATERIAL: StudyMaterial = {
  title: "Study Material",
  summary: "Unable to generate AI content. Please try again or adjust your input.",
  flashcards: [
    { question: "What key concepts did you learn?", answer: "Review your notes for important topics." }
  ],
  quiz: [
    {
      question: "Which area do you need to study more?",
      options: ["Pathophysiology", "Pharmacology", "Diagnosis", "Management"],
      correctAnswer: 0,
      explanation: "Focus on weak areas first."
    }
  ]
};

const FALLBACK_QUIZ: QuizQuestion[] = [
  {
    question: "Review mode: What's the main topic you're studying?",
    options: ["Cardiology", "Pulmonology", "Gastroenterology", "Nephrology"],
    correctAnswer: 0,
    explanation: "Choose your focus area to generate new questions."
  }
];

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

// Default system instruction (PA focused)
const DEFAULT_SYSTEM_INSTRUCTION = DOMAIN_INSTRUCTIONS['PA'];

// Retry logic with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable (503, 429, or network errors)
      const isRetryable = 
        error?.status === 503 || 
        error?.status === 429 || 
        error?.message?.includes('overloaded') ||
        error?.message?.includes('UNAVAILABLE');
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed. Retrying in ${delayMs}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

export async function processStudyContent(content: string, isImage: boolean = false, domain: StudyDomain = 'PA'): Promise<StudyMaterial> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';
  const systemInstruction = DOMAIN_INSTRUCTIONS[domain];

  const prompt = isImage 
    ? `Analyze this clinical image. Create a comprehensive study kit with 8 high-yield questions relevant to this field.`
    : `Based on these notes: \n\n${content}\n\nGenerate a comprehensive study kit with 8 questions, a summary, and flashcards. Focus on the most important concepts.`;

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: isImage 
          ? [{ parts: [{ inlineData: { data: content, mimeType: 'image/png' } }, { text: prompt }] }]
          : [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: STUDY_MATERIAL_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 }
        },
      });

      const result = JSON.parse(response.text || '{}') as StudyMaterial;
      if (!result.title || !result.summary) throw new Error("Invalid response structure");
      return result;
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return fallback instead of throwing
    return FALLBACK_STUDY_MATERIAL;
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
    return await retryWithBackoff(async () => {
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
    });
  } catch (error) {
    console.error("Gemini Extension Error:", error);
    // Return fallback questions instead of empty array
    return FALLBACK_QUIZ;
  }
}

export async function generateQuestionForFailure(currentTopic: string): Promise<QuizQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';

  const prompt = `The student just got a question wrong about "${currentTopic}". 
  Generate 2 NEW high-yield clinical vignettes to reinforce this concept. 
  These should test similar pathophysiology, diagnostics, or management.
  Return only the JSON array with 2 questions.`;

  try {
    return await retryWithBackoff(async () => {
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
    });
  } catch (error) {
    console.error("Generate Question for Failure Error:", error);
    // Return fallback instead of empty array
    return FALLBACK_QUIZ.slice(0, 2);
  }
}
