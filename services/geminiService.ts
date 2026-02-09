
import { GoogleGenAI, Type } from "@google/genai";
import { StudyMaterial, QuizQuestion, StudyDomain } from "../types";

// Domain-specific system instructions - concise and focused
const DOMAIN_INSTRUCTIONS: Record<StudyDomain, string> = {
  'PA': `You generate study materials for PA students preparing for PANCE. Focus on board-style clinical reasoning, differential diagnosis, and high-yield concepts. Create 8 quiz questions and 15 flashcard pairs covering key concepts.`,

  'Nursing': `You generate study materials for nursing students preparing for NCLEX. Focus on patient safety, nursing judgment, assessment findings, and clinical interventions. Create 8 quiz questions and 15 flashcard pairs.`,

  'Medical': `You generate study materials for medical students preparing for USMLE. Focus on pathophysiology mechanisms, diagnostic reasoning, and evidence-based management. Create 8 quiz questions and 15 flashcard pairs.`,

  'GenEd': `You generate comprehensive study materials for any subject. Focus on clear explanations, concept connections, and practical applications. Create 8 quiz questions and 15 flashcard pairs.`
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
    ? `Analyze this clinical image. Create a study guide with these sections:

Big Picture Question: [What is the key concept?]

Key Concepts & Definitions:
- Term: Definition
- Term: Definition

Comparison Table:
| Item | Aspect A | Aspect B |
| --- | --- | --- |
| Feature | Detail | Detail |

Test Yourself:
- Question 1?
- Question 2?

Common Misconception: [Misconception] vs [Correct Understanding]

Generate 8 exam questions and 15 flashcard pairs.`
    : `Create a study guide for these notes with these sections:

Big Picture Question: [What is the key concept?]

Key Concepts & Definitions:
- Term: Definition
- Term: Definition

Comparison Table:
| Item | Aspect A | Aspect B |
| --- | --- | --- |
| Feature | Detail | Detail |

Test Yourself:
- Question 1?
- Question 2?

Common Misconception: [Misconception] vs [Correct Understanding]

NOTES:
${content}

Generate 8 exam questions and 15 flashcard pairs.`;

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

  const prompt = `SPACED REPETITION MODE: Student is reviewing "${currentTopic}" to strengthen long-term memory.

GENERATE 3 NEW questions that:
1. Test DIFFERENT ASPECTS than previous questions (avoid repetition)
2. Use VARIED SCENARIOS: different patient ages, presentations, complications
3. Mix DIFFICULTY LEVELS: 1 easier recall, 1 intermediate, 1 advanced application
4. INTERLEAVE related concepts: require distinguishing between similar ideas
5. TARGET MISCONCEPTIONS: include edge cases and common board exam errors

Each question must have:
- A realistic clinical vignette
- Clear correct answer with strong reasoning
- Plausible distractors that test misconceptions
- Explanation that reinforces learning

Return only the JSON array of questions.`;

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
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

  const prompt = `REMEDIATION MODE: Student got a question wrong about "${currentTopic}". Generate targeted learning questions.

GENERATE 2 STRATEGIC questions that:
1. TARGET THE MISCONCEPTION: Help student understand what went wrong
2. DEEPEN UNDERSTANDING: Explain WHY the correct answer is right
3. VARY THE SCENARIO: Different patient presentations of the same concept
4. TEST APPLICATION: Apply concept in new contexts
5. COMPARE & CONTRAST: Link to similar concepts to prevent future confusion

Each question must:
- Directly address the struggling concept
- Approach from a different angle than the original
- Have detailed explanations that clarify misconceptions
- Include clinical reasoning for long-term retention

Return only the JSON array with 2 questions.`;

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
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
