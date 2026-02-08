
import { GoogleGenAI, Type } from "@google/genai";
import { StudyMaterial, QuizQuestion, StudyDomain } from "../types";

// Domain-specific system instructions with effective study guide framework
const DOMAIN_INSTRUCTIONS: Record<StudyDomain, string> = {
  'PA': `You are a Senior PA School Professor specializing in PANCE prep. Create an EFFECTIVE STUDY GUIDE.

REQUIRED FORMAT:
- Use clear section headers ending with colons or as numbered items
- For Big Picture: Include "Big Picture Question:" at the start
- For misconceptions: Start line with "Common Misconception:" or "Frequent Error:"
- For tables: Use | delimiters (Col1 | Col2)

STRUCTURE & CONTENT:
1. Big Picture Question: What's the main concept to understand?
2. Key Concepts & Definitions: Essential terms (keep definitions concise)
3. Comparison Table: If contrasting diagnoses/approaches exist
4. Test Yourself: 3-4 practice questions in PANCE vignette format
5. Common Misconceptions: Highlight board exam pitfalls
6. For processes: Step-by-step reasoning with examples

OUTPUT: Generate 8 quiz questions + 5-8 flashcard pairs focusing on active recall.`,

  'Nursing': `You are a Nursing Education Expert preparing students for NCLEX. Create an EFFECTIVE STUDY GUIDE.

REQUIRED FORMAT:
- Use clear section headers ending with colons or as numbered items
- For Big Picture: Include "Big Picture Question:" at the start
- For misconceptions: Start line with "Common Misconception:" or "Frequent Error:"
- For tables: Use | delimiters (Assessment Finding | Nursing Diagnosis)

STRUCTURE & CONTENT:
1. Big Picture Question: What nursing concept matters most here?
2. Key Nursing Concepts: Assessment, Diagnosis, Interventions (concise)
3. Comparison Table: Contrasting patient presentations or nursing responses
4. Test Yourself: 3-4 NCLEX-style scenario questions
5. Common Misconceptions: Frequent nursing judgment mistakes
6. Interventions with Rationales: Why we do what we do

OUTPUT: Generate 8 quiz questions + 5-8 flashcard pairs testing nursing judgment.`,

  'Medical': `You are a Medical School Professor for USMLE/board prep. Create an EFFECTIVE STUDY GUIDE.

REQUIRED FORMAT:
- Use clear section headers ending with colons or as numbered items
- For Big Picture: Include "Big Picture Question:" at the start
- For misconceptions: Start line with "Common Misconception:" or "Frequent Error:"
- For tables: Use | delimiters (Feature | Condition A | Condition B)

STRUCTURE & CONTENT:
1. Big Picture Question: What's the fundamental mechanism here?
2. Pathophysiology: Key mechanisms and their consequences (concise)
3. Comparison Table: Differential diagnosis features and findings
4. Test Yourself: 3-4 USMLE board-style questions
5. Common Misconceptions: Frequent mechanism misunderstandings
6. Clinical Pearl: High-yield exam fact or classic presentation

OUTPUT: Generate 8 quiz questions + 5-8 flashcard pairs testing deep understanding.`,

  'GenEd': `You are an expert educator creating comprehensive study materials. Create an EFFECTIVE STUDY GUIDE.

REQUIRED FORMAT:
- Use clear section headers ending with colons or as numbered items
- For Big Picture: Include "Big Picture Question:" at the start
- For misconceptions: Start line with "Common Misconception:" or "Frequent Error:"
- For tables: Use | delimiters (Concept | Explanation)

STRUCTURE & CONTENT:
1. Big Picture Question: Why does this topic matter?
2. Key Concepts & Definitions: Core vocabulary (plain language, concise)
3. Comparison Table: Contrasting ideas, time periods, or systems
4. Test Yourself: 3-4 application-level self-check questions
5. Common Misconceptions: Common student confusion points
6. Real-World Connection: How this applies in practice

OUTPUT: Generate 8 quiz questions + 5-8 flashcard pairs testing understanding and application.`
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

  const structuredPrompt = `Create a comprehensive study guide with this EXACT structure:

Big Picture Question: [What is the core concept to understand?]

Key Concepts & Definitions:
[2-3 essential concepts with concise definitions]

Comparison Table:
[If applicable: contrasting two or more related concepts]
| Concept A | Concept B |
| --- | --- |
| Feature 1 | Feature 1 |

Test Yourself:
[3-4 practice questions relevant to the content]

Common Misconception: [Frequent student error or misunderstanding]

[Any additional relevant section based on content]`;

  const prompt = isImage 
    ? `LEARNING OBJECTIVE: Help the student understand this clinical image deeply and retain the knowledge for long-term recall.

IMPORTANT: Generate questions that test UNDERSTANDING, not just memorization. Include:
- Application questions ("What would happen if...?")
- Comparison questions ("How does this differ from...?")
- Clinical reasoning questions ("Why does this happen?")
- Mixed difficulty levels (easier recall + harder application)

${structuredPrompt}

Analyze this clinical image and follow the structure above. Then provide 8 exam-quality questions for the quiz, focusing on clinical reasoning and differential thinking.`
    : `LEARNING OBJECTIVE: Help the student retain and apply this knowledge, not just memorize it.

IMPORTANT: Generate questions that test UNDERSTANDING AND APPLICATION, not just facts. Include:
- Recall questions (basic)
- Application questions ("What would you do if...?")
- Comparison questions (contrast with similar concepts)
- Clinical reasoning questions ("Why is this the answer?")
- Mixed difficulty and scenarios

${structuredPrompt}

Based on these notes:

${content}

Follow the structure above. Then provide 8 exam-quality questions for the quiz (various difficulty levels and question types) and create 5-8 flashcard pairs that test recall AND understanding.`;

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
