
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { StudyMaterial, QuizQuestion, StudyDomain, SavedUpload, ContentPart } from '../types';

// Domain-specific system instructions with effective study guide framework
const DOMAIN_INSTRUCTIONS: Record<StudyDomain, string> = {
  'PA': `You are a Senior PA School Professor. YOUR ROLE: Generate COMPREHENSIVE and highly descriptive structured study guides.
  
MANDATORY FORMATTING RULES:
1. ALWAYS start with "Big Picture Question:" followed by a clear question
2. ALWAYS include "Key Concepts & Definitions:" section with term | definition format
3. ALWAYS include a "Comparison Table:" using | delimiters when contrasting concepts
4. ALWAYS include "Test Yourself:" section with 2-3 practice questions
5. ALWAYS include "Common Misconception:" section identifying frequent errors
6. Use section headers EXACTLY as written above - these enable student app parsing

CONTENT PRINCIPLES:
- Be extremely detailed and descriptive in your explanations
- Focus on PANCE board-style reasoning
- Emphasize differential diagnosis and clinical decision-making
- Connect pathophysiology to patient presentation
- Highlight high-yield, commonly tested concepts`,

  'Nursing': `You are a Nursing Education Expert. YOUR ROLE: Generate COMPREHENSIVE and highly descriptive structured study guides.

MANDATORY FORMATTING RULES:
1. ALWAYS start with "Big Picture Question:" followed by a clear question about nursing care
2. ALWAYS include "Key Concepts & Definitions:" with term | definition format
3. ALWAYS include a "Comparison Table:" using | delimiters (Assessment | Nursing Diagnosis or similar)
4. ALWAYS include "Test Yourself:" section with 2-3 NCLEX-style scenarios
5. ALWAYS include "Common Misconception:" section addressing nursing judgment errors
6. Use section headers EXACTLY as written - these enable student app parsing

CONTENT PRINCIPLES:
- Be extremely detailed in your nursing judgment explanations
- Focus on patient safety and priority assessment findings
- Connect clinical findings to nursing diagnoses
- Organize by ADPIE framework where applicable`,

  'Medical': `You are a Medical School Professor. YOUR ROLE: Generate COMPREHENSIVE and highly descriptive structured study guides.

MANDATORY FORMATTING RULES:
1. ALWAYS start with "Big Picture Question:" followed by a mechanistic question
2. ALWAYS include "Key Concepts & Definitions:" with term | definition format
3. ALWAYS include a "Comparison Table:" using | delimiters (Feature | Condition A | Condition B)
4. ALWAYS include "Test Yourself:" section with 2-3 USMLE-style questions
5. ALWAYS include "Common Misconception:" section addressing mechanism misunderstandings
6. Use section headers EXACTLY as written - these enable student app parsing

CONTENT PRINCIPLES:
- Focus on deep, detailed pathophysiologic understanding
- Emphasize mechanism over memorization
- Connect all concepts to real patient scenarios
- Highlight commonly tested board concepts`,

  'GenEd': `You are an expert educator. YOUR ROLE: Generate COMPREHENSIVE and highly descriptive structured study guides.

MANDATORY FORMATTING RULES:
1. ALWAYS start with "Big Picture Question:" followed by a framing question
2. ALWAYS include "Key Concepts & Definitions:" with term | definition format
3. ALWAYS include a "Comparison Table:" using | delimiters contrasting related concepts
4. ALWAYS include "Test Yourself:" section with 2-3 concept-check questions
5. ALWAYS include "Common Misconception:" section addressing typical student errors
6. Use section headers EXACTLY as written - these enable student app parsing

CONTENT PRINCIPLES:
- Provide rich, detailed context for all topics
- Use analogies and clear examples to explain complex ideas
- Connect concepts to real-world applications
- Encourage deep understanding and application`
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
    summary: {
      type: Type.STRING,
      description: "A COMPREHENSIVE study guide string. MUST include 'Big Picture Question:', 'Key Concepts & Definitions:', 'Comparison Table:', and 'Common Misconception:' sections. Be extremely detailed."
    },
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
          type: { type: Type.STRING, enum: ['multiple-choice', 'labeling', 'matching'], description: "The mode of interaction" },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactly 4 options for multiple-choice"
          },
          correctAnswer: {
            type: Type.INTEGER,
            description: "Index of correct answer (0-3). MUST randomize the correct index; DO NOT always use 0 or 1."
          },
          imageLabels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING, description: "The correct term to place" },
                x: { type: Type.NUMBER, description: "Horizontal position (0-100)" },
                y: { type: Type.NUMBER, description: "Vertical position (0-100)" }
              },
              required: ["id", "label", "x", "y"]
            },
            description: "Used for labeling questions"
          },
          matchingPairs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                left: { type: Type.STRING },
                right: { type: Type.STRING }
              },
              required: ["id", "left", "right"]
            },
            description: "Used for matching questions"
          },
          explanation: { type: Type.STRING },
          subtopic: { type: Type.STRING, description: "Short subtopic heading for grouping (e.g. Pathophysiology, Pharmacology)" }
        },
        required: ["question", "type", "explanation", "subtopic"]
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
      question: { type: Type.STRING, description: "Board-style clinical vignette. NO study guide headers like 'Big Picture Question'." },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Exactly 4 plausible options."
      },
      correctAnswer: {
        type: Type.INTEGER,
        description: "Index of correct answer (0-3). MANDATORY: Randomize the correct answer index across questions."
      },
      explanation: { type: Type.STRING, description: "Concise clinical reasoning." },
      subtopic: { type: Type.STRING, description: "Short subtopic heading (e.g. Pathophysiology)" }
    },
    required: ["question", "options", "correctAnswer", "explanation", "subtopic"]
  }
};

const FLASHCARDS_LIST_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      answer: { type: Type.STRING }
    },
    required: ["question", "answer"]
  }
};

// Default system instruction (PA focused)
const DEFAULT_SYSTEM_INSTRUCTION = DOMAIN_INSTRUCTIONS['PA'];

// Multi-Key Management
class ApiKeyManager {
  private keys: string[];
  private currentIndex: number = 0;

  constructor() {
    // In Vite, we use import.meta.env and variables must be prefixed with VITE_ to be exposed to the client
    this.keys = Object.keys(import.meta.env)
      .filter(key => key.startsWith('VITE_GEMINI_API_KEY'))
      .map(key => import.meta.env[key] || '')
      .filter(val => val && val !== 'PLACEHOLDER_API_KEY');

    // Fallback if no specific keys found
    if (this.keys.length === 0 && import.meta.env.VITE_GEMINI_API_KEY) {
      this.keys.push(import.meta.env.VITE_GEMINI_API_KEY);
    }

    console.log(`Initialized ApiKeyManager with ${this.keys.length} keys`);
  }

  getNextKey(): string {
    if (this.keys.length === 0) return '';
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  get keyCount(): number {
    return this.keys.length;
  }
}

const keyManager = new ApiKeyManager();

// Retry logic with exponential backoff and key rotation
async function retryWithBackoff<T>(
  fn: (apiKey: string) => Promise<T>,
  maxRetries: number = 5,
  initialDelayMs: number = 2000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = keyManager.getNextKey();
    try {
      return await fn(apiKey);
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable (503, 429, or network errors)
      const isRetryable =
        error?.status === 503 ||
        error?.status === 429 ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('UNAVAILABLE') ||
        error?.message?.includes('fetch failed');

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff with jitter: (2s, 4s, 8s, 16s, 32s) + jitter
      const baseDelay = initialDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delayMs = baseDelay + jitter;

      console.log(`Attempt ${attempt + 1} failed with key ${apiKey.substring(0, 5)}... Retrying in ${Math.round(delayMs)}ms with next key...`);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// ContentPart interface moved to types.ts

export async function processStudyContent(parts: ContentPart[], domain: StudyDomain = 'PA'): Promise<StudyMaterial> {
  const systemInstruction = DOMAIN_INSTRUCTIONS[domain];
  const modelName = 'gemini-2.0-flash';

  const prompt = `Analyze the provided study materials and generate a COHESIVE, COMPREHENSIVE, and HIGHLY DESCRIPTIVE structured study guide.
The materials may consist of multiple text documents and/or images. Synthesize information across all parts to create a unified resource.

MANDATORY STRUCTURE:
1. Big Picture Question: Start immediately with this. No introduction.
2. Key Concepts & Definitions: (term | definition)
3. Comparison Table: (| delimiters)
4. Test Yourself: (3-5 high-yield questions)
5. Common Misconception:

CRITICAL: 
- If multiple documents cover different aspects of the same topic, merge them logically.
- Generate 15-20 quiz questions (MIX multiple-choice and matching).
- RANDOMIZATION: Distribute correctAnswer index evenly between 0-3.
- Generate 15-20 flashcard pairs.
- Ensure the guide provides deep pedagogical value.

Materials are provided below as a series of parts.`;

  try {
    return await retryWithBackoff(async (apiKey) => {
      const ai = new GoogleGenAI({ apiKey });

      const contents = [{
        parts: [
          { text: prompt },
          ...parts.map(p => {
            if (p.type === 'image') {
              return { inlineData: { data: p.data, mimeType: p.mimeType || 'image/png' } };
            }
            return { text: `PART [${p.fileName || 'Untitled'}]:\n${p.data}` };
          })
        ]
      }];

      const response = await (ai as any).models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: STUDY_MATERIAL_SCHEMA,
          maxOutputTokens: 8000
        },
      });

      const text = response.text || '{}';
      try {
        const result = JSON.parse(text) as StudyMaterial;
        if (!result.title || !result.summary) throw new Error("Invalid response structure");
        return result;
      } catch (e) {
        // Auto-repair for JSON arrays or objects
        if (text.trim().startsWith('{') && !text.trim().endsWith('}')) {
          return JSON.parse(text.trim() + '}') as StudyMaterial;
        }
        throw e;
      }
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return FALLBACK_STUDY_MATERIAL;
  }
}

export async function extendQuiz(parts: ContentPart[], domain: StudyDomain = 'PA'): Promise<QuizQuestion[]> {
  const systemInstruction = DOMAIN_INSTRUCTIONS[domain];
  const modelName = 'gemini-2.0-flash';

  const prompt = `Generate 5 NEW and UNIQUE high-yield clinical board questions based on the provided materials.
  
  MANDATORY QUALITY STANDARDS:
  - DO NOT repeat the style or content of previous questions.
  - VARY QUESTION TYPES: Use clinical vignettes, direct recall, pathophysiological mechanisms, and matching.
  - IMAGE LABELING: If images are provided in the parts, you MAY generate labeling questions IF AND ONLY IF you can identify a clear anatomical structure or diagram. 
    - If you generate a labeling question, you MUST provide accurate "imageLabels" with (x,y) coordinates relative to the image part.
    - If NO images are provided or they are not suitable for labeling, FORBIDDEN: Do not generate labeling questions.
  - DEPTH: Questions must be PANCE/USMLE level (highly descriptive and clinically relevant).
  - PLOT: Use complex distractors that test fine differentiation between similar diagnoses.
  - RANDOMIZATION: Distribute "correctAnswer" index (0-3) evenly.
  
  Materials are provided below.`;

  try {
    return await retryWithBackoff(async (apiKey) => {
      const ai = new GoogleGenAI({ apiKey });

      const contents = [{
        parts: [
          { text: prompt },
          ...parts.map(p => {
            if (p.type === 'image') {
              return { inlineData: { data: p.data, mimeType: p.mimeType || 'image/png' } };
            }
            return { text: `PART [${p.fileName || 'Untitled'}]:\n${p.data}` };
          })
        ]
      }];

      const response = await (ai as any).models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: ADDITIONAL_QUESTIONS_SCHEMA,
          maxOutputTokens: 4000
        },
      });

      const text = response.text || '[]';
      try {
        return JSON.parse(text) as QuizQuestion[];
      } catch (e) {
        if (text.trim().startsWith('[') && !text.trim().endsWith(']')) {
          return JSON.parse(text.trim() + ']') as QuizQuestion[];
        }
        throw e;
      }
    });
  } catch (error) {
    console.error("Gemini Extension Error:", error);
    return FALLBACK_QUIZ;
  }
}

export async function generateQuestionForFailure(parts: ContentPart[], failedConcept: string, domain: StudyDomain = 'PA'): Promise<QuizQuestion[]> {
  const systemInstruction = DOMAIN_INSTRUCTIONS[domain];
  const modelName = 'gemini-2.0-flash';

  const prompt = `A student struggled with the concept of "${failedConcept}". 
  Generate 2 TARGETED REMEDIATION questions from the provided materials that approach this specific concept from different clinical angles. 
  
  MANDATORY: 
  - Each must include a "subtopic" field and a detailed clinical vignette.
  - Focus on fine differentiation (e.g., if they confused Condition A with B, test the specific difference).
  - RANDOMIZATION: Randomly select the "correctAnswer" index (0-3).
  
  Materials are provided below.`;

  try {
    return await retryWithBackoff(async (apiKey) => {
      const ai = new GoogleGenAI({ apiKey });

      const contents = [{
        parts: [
          { text: prompt },
          ...parts.map(p => {
            if (p.type === 'image') {
              return { inlineData: { data: p.data, mimeType: p.mimeType || 'image/png' } };
            }
            return { text: `PART [${p.fileName || 'Untitled'}]:\n${p.data}` };
          })
        ]
      }];

      const response = await (ai as any).models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: ADDITIONAL_QUESTIONS_SCHEMA,
          maxOutputTokens: 2000
        },
      });

      const text = response.text || '[]';
      try {
        return JSON.parse(text) as QuizQuestion[];
      } catch (e) {
        if (text.trim().startsWith('[') && !text.trim().endsWith(']')) {
          return JSON.parse(text.trim() + ']') as QuizQuestion[];
        }
        throw e;
      }
    });
  } catch (error) {
    console.error("Gemini Remediation Error:", error);
    return FALLBACK_QUIZ;
  }
}

export async function generateAdditionalFlashcards(topic: string): Promise<any[]> {
  const modelName = 'gemini-2.0-flash';
  const prompt = `Generate EXACTLY 15 new, unique flashcard pairs about: "${topic}". 
  Ensure they cover different aspects and vary in difficulty. 
  DO NOT repeat common knowledge already covered in basic sets.
  Focus on high-yield clinical facts and mechanisms.`;

  try {
    return await retryWithBackoff(async (apiKey) => {
      const ai = new GoogleGenAI({ apiKey });
      const response = await (ai as any).models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: FLASHCARDS_LIST_SCHEMA,
          maxOutputTokens: 4000
        },
      });

      const text = response.text || '[]';
      try {
        const result = JSON.parse(text);
        return Array.isArray(result) ? result : [];
      } catch (e) {
        if (text.trim().startsWith('[') && !text.trim().endsWith(']')) {
          const result = JSON.parse(text.trim() + ']');
          return Array.isArray(result) ? result : [];
        }
        throw e;
      }
    });
  } catch (error) {
    console.error("Generate Additional Flashcards Error:", error);
    return [];
  }
}
