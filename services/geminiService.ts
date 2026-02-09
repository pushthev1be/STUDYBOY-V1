
import { GoogleGenAI, Type } from "@google/genai";
import { StudyMaterial, QuizQuestion, StudyDomain } from "../types";

// Domain-specific system instructions - focused on detailed learning
const DOMAIN_INSTRUCTIONS: Record<StudyDomain, string> = {
  'PA': `Create comprehensive study materials for PA students preparing for PANCE boards. Focus on clinical reasoning, differential diagnosis, evidence-based management, and high-yield concepts. Provide detailed definitions, clinical correlations, and board-style reasoning. Generate comprehensive content that tests understanding, not just memorization.`,

  'Nursing': `Create comprehensive study materials for nursing students preparing for NCLEX. Focus on patient safety, nursing judgment, assessment-diagnosis-intervention links, and clinical decision-making. Provide detailed explanations of nursing concepts, interventions with rationales, and NCLEX-style scenarios. Make content clinically practical and relevant.`,

  'Medical': `Create comprehensive study materials for medical students preparing for USMLE. Focus on pathophysiology mechanisms, diagnostic reasoning, evidence-based management, and clinical application. Provide detailed mechanistic explanations, connect concepts to patient presentations, and emphasize board-style thinking. Make every concept clinically relevant.`,

  'GenEd': `Create comprehensive, well-organized study materials suitable for any subject area. Focus on clarity, concept connections, real-world applications, and deep understanding. Provide detailed explanations, practical examples, and help students see how concepts relate. Make content engaging and meaningful.`
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
    ? `Analyze this clinical image and create a detailed study guide:

Big Picture Question: [Insightful question about the core concept]

Key Concepts & Definitions:
- Key term 1: Detailed definition
- Key term 2: Detailed definition
- Key term 3: Detailed definition

Comparison Table:
| Feature | Concept A | Concept B |
| --- | --- | --- |
| Characteristic 1 | Description | Description |
| Characteristic 2 | Description | Description |

Test Yourself:
- Practice question 1 with context?
- Practice question 2 with context?

Common Misconception: [Explain frequent student error] --> [Provide correct understanding with reasoning]

Then generate 8 board-style exam questions and 15 comprehensive flashcard pairs covering all aspects of the topic.`
    : `Create a detailed study guide for these notes:

Big Picture Question: [Frame the most important conceptual question about this topic]

Key Concepts & Definitions:
- Key term 1: Detailed definition with clinical relevance
- Key term 2: Detailed definition with clinical relevance
- Key term 3: Detailed definition with clinical relevance

Comparison Table:
| Feature | Concept A | Concept B |
| --- | --- | --- |
| Key characteristic 1 | Detailed comparison | Detailed comparison |
| Key characteristic 2 | Detailed comparison | Detailed comparison |

Test Yourself:
- Application question 1 testing understanding?
- Application question 2 testing understanding?

Common Misconception: [Explain common student misconception or error] --> [Provide correct understanding with explanation]

NOTES TO STUDY:
${content}

Generate 8 board-style exam questions with detailed explanations and create 15 comprehensive flashcard pairs that test understanding and application.`;

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
