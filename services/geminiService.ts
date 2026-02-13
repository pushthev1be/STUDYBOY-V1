
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { StudyMaterial, QuizQuestion, StudyDomain } from "../types";

declare const process: { env: { [key: string]: string | undefined } };

// Domain-specific system instructions with effective study guide framework
const DOMAIN_INSTRUCTIONS: Record<StudyDomain, string> = {
  'PA': `You are a Senior PA School Professor. YOUR ROLE: Generate structured study guides, not narrative essays.

MANDATORY FORMATTING RULES:
1. ALWAYS start with "Big Picture Question:" followed by a clear question
2. ALWAYS include "Key Concepts & Definitions:" section with term | definition format
3. ALWAYS include a "Comparison Table:" using | delimiters when contrasting concepts
4. ALWAYS include "Test Yourself:" section with 2-3 practice questions
5. ALWAYS include "Common Misconception:" section identifying frequent errors
6. Use section headers EXACTLY as written above - these enable student app parsing

CONTENT PRINCIPLES:
- Focus on PANCE board-style reasoning
- Emphasize differential diagnosis and clinical decision-making
- Connect pathophysiology to patient presentation
- Highlight high-yield, commonly tested concepts`,

  'Nursing': `You are a Nursing Education Expert. YOUR ROLE: Generate structured study guides, not narrative essays.

MANDATORY FORMATTING RULES:
1. ALWAYS start with "Big Picture Question:" followed by a clear question about nursing care
2. ALWAYS include "Key Concepts & Definitions:" with term | definition format
3. ALWAYS include a "Comparison Table:" using | delimiters (Assessment | Nursing Diagnosis or similar)
4. ALWAYS include "Test Yourself:" section with 2-3 NCLEX-style scenarios
5. ALWAYS include "Common Misconception:" section addressing nursing judgment errors
6. Use section headers EXACTLY as written - these enable student app parsing

CONTENT PRINCIPLES:
- Focus on NCLEX-style nursing judgment
- Emphasize patient safety and assessment findings
- Connect clinical findings to nursing diagnoses
- Organize by ADPIE framework where applicable`,

  'Medical': `You are a Medical School Professor. YOUR ROLE: Generate structured study guides, not narrative essays.

MANDATORY FORMATTING RULES:
1. ALWAYS start with "Big Picture Question:" followed by a mechanistic question
2. ALWAYS include "Key Concepts & Definitions:" with term | definition format
3. ALWAYS include a "Comparison Table:" using | delimiters (Feature | Condition A | Condition B)
4. ALWAYS include "Test Yourself:" section with 2-3 USMLE-style questions
5. ALWAYS include "Common Misconception:" section addressing mechanism misunderstandings
6. Use section headers EXACTLY as written - these enable student app parsing

CONTENT PRINCIPLES:
- Focus on deep pathophysiologic understanding
- Emphasize mechanism over memorization
- Connect all concepts to real patient scenarios
- Highlight commonly tested board concepts`,

  'GenEd': `You are an expert educator. YOUR ROLE: Generate structured study guides, not narrative essays.

MANDATORY FORMATTING RULES:
1. ALWAYS start with "Big Picture Question:" followed by a framing question
2. ALWAYS include "Key Concepts & Definitions:" with term | definition format
3. ALWAYS include a "Comparison Table:" using | delimiters contrasting related concepts
4. ALWAYS include "Test Yourself:" section with 2-3 application-level questions
5. ALWAYS include "Common Misconception:" section addressing student confusion points
6. Use section headers EXACTLY as written - these enable student app parsing

CONTENT PRINCIPLES:
- Make content accessible and engaging
- Show how concepts connect and relate
- Include real-world examples
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

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A concise title" },
    summary: { type: Type.STRING, description: "Pedagogical summary of high-yield medical concepts" }
  },
  required: ["title", "summary"]
};

const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
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
          explanation: { type: Type.STRING },
          subtopic: { type: Type.STRING, description: "Short subtopic heading for grouping" }
        },
        required: ["question", "options", "correctAnswer", "explanation", "subtopic"]
      }
    }
  },
  required: ["quiz"]
};

const FLASHCARDS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
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
    }
  },
  required: ["flashcards"]
};

// Backwards compatibility for other functions
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
      explanation: { type: Type.STRING },
      subtopic: { type: Type.STRING, description: "Short subtopic heading for grouping" }
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

  // Helper to generate a specific part of the material
  const generatePart = async (prompt: string, schema: any): Promise<any> => {
    return retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: isImage
          ? [{ parts: [{ inlineData: { data: content, mimeType: 'image/png' } }, { text: prompt }] }]
          : [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: 2000,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        },
      });
      return JSON.parse(response.text || '{}');
    });
  };

  try {
    // Fire all three requests in parallel
    const [summaryPart, quizPart, flashcardsPart] = await Promise.all([
      generatePart(
        `Generate a concise title and a pedagogical summary of the following content:
        
        ${isImage ? '[Analyze Clinical Image]' : 'NOTES:\n' + content}`,
        SUMMARY_SCHEMA
      ),
      generatePart(
        `Generate 15 high-yield, board-style quiz questions based on the following content. 
        Each must include a "subtopic" field (e.g. "Pathophysiology", "Pharmacology", "Diagnosis").
        
        ${isImage ? '[Analyze Clinical Image]' : 'NOTES:\n' + content}`,
        QUIZ_SCHEMA
      ),
      generatePart(
        `Generate 15 high-yield clinical flashcard pairs based on the following content.
        
        ${isImage ? '[Analyze Clinical Image]' : 'NOTES:\n' + content}`,
        FLASHCARDS_SCHEMA
      )
    ]);

    return {
      title: summaryPart.title || "Study Material",
      summary: summaryPart.summary || "Summary generation failed.",
      quiz: quizPart.quiz || [],
      flashcards: flashcardsPart.flashcards || []
    };
  } catch (error) {
    console.error("Gemini Parallel Processing Error:", error);
    return FALLBACK_STUDY_MATERIAL;
  }
}

export async function extendQuiz(currentTopic: string, existingCount: number): Promise<QuizQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';

  const prompt = `Generate 5 new board-style questions about "${currentTopic}". Each must include a "subtopic" field (e.g. "Pathophysiology", "Pharmacology"). Vary difficulty and scenarios. Include clinical vignettes, plausible distractors, and concise explanations.`;

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: ADDITIONAL_QUESTIONS_SCHEMA,
          maxOutputTokens: 4000,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        },
      });

      return JSON.parse(response.text || '[]') as QuizQuestion[];
    });
  } catch (error) {
    console.error("Gemini Extension Error:", error);
    return FALLBACK_QUIZ;
  }
}

export async function generateQuestionForFailure(currentTopic: string): Promise<QuizQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';

  const prompt = `Student got a question wrong about "${currentTopic}". Generate 2 targeted remediation questions that approach the concept from different angles. Include a "subtopic" field, clinical vignettes, and explanations that clarify the misconception.`;

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: ADDITIONAL_QUESTIONS_SCHEMA,
          maxOutputTokens: 2000,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        },
      });

      return JSON.parse(response.text || '[]') as QuizQuestion[];
    });
  } catch (error) {
    console.error("Generate Question for Failure Error:", error);
    return FALLBACK_QUIZ.slice(0, 2);
  }
}

export async function generateAdditionalFlashcards(topic: string): Promise<any[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';

  const prompt = `Generate EXACTLY 15 new, unique flashcard pairs about: "${topic}". 
  Ensure they cover different aspects and vary in difficulty. 
  DO NOT repeat common knowledge already covered in basic sets.
  Focus on high-yield clinical facts and mechanisms.`;

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: FLASHCARDS_LIST_SCHEMA,
          maxOutputTokens: 4000,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        },
      });

      const result = JSON.parse(response.text || '[]');
      return Array.isArray(result) ? result : [];
    });
  } catch (error) {
    console.error("Generate Additional Flashcards Error:", error);
    return [];
  }
}
