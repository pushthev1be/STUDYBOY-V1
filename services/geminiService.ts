
import { GoogleGenAI, Type } from "@google/genai";
import { StudyMaterial, QuizQuestion, StudyDomain } from "../types";

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
    ? `GENERATE SUMMARY WITH CONTENT UNDER EACH SECTION HEADER:

Big Picture Question: [Write the question on the same line as the header, then continue with explanation on next lines]

Key Concepts & Definitions:
[List key terms with definitions, one per line. Include 2-3 concepts]

Comparison Table:
| Concept A | Concept B |
| --- | --- |
| Feature 1 | Feature 1 |

Test Yourself:
[List 2-3 practice questions here, one per line]

Common Misconception: [Explain the misconception and correct understanding here]

NOW analyze this clinical image following EXACTLY this structure with CONTENT under each header. Then generate 8 exam questions and 5-8 flashcard pairs.`
    : `GENERATE SUMMARY WITH CONTENT UNDER EACH SECTION HEADER:

Big Picture Question: [Write the question on the same line as the header, then continue with explanation on next lines]

Key Concepts & Definitions:
[List key terms with definitions, one per line. Include 2-3 concepts]

Comparison Table:
| Concept A | Concept B |
| --- | --- |
| Feature 1 | Feature 1 |

Test Yourself:
[List 2-3 practice questions here, one per line]

Common Misconception: [Explain the misconception and correct understanding here]

---

NOTES TO ANALYZE:
${content}

Follow the structure above EXACTLY. Put ACTUAL CONTENT on the lines following each section header (not empty sections). Then generate 8 exam questions and create 5-8 flashcard pairs.`;

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
