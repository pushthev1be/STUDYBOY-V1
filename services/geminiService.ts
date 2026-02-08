
import { GoogleGenAI, Type } from "@google/genai";
import { StudyMaterial, QuizQuestion, StudyDomain } from "../types";

// Domain-specific system instructions with effective study guide framework
const DOMAIN_INSTRUCTIONS: Record<StudyDomain, string> = {
  'PA': `You are a Senior PA School Professor specializing in PANCE prep. Create an EFFECTIVE STUDY GUIDE following these principles:

STRUCTURE & FORMAT:
- Start with a "Big Picture Question" that frames the entire topic
- Use clear hierarchy: main concepts > sub-concepts > details
- Present key terms with definitions in an easily scannable format
- Create comparison tables when contrasting concepts exist

CONTENT GENERATION:
- List Key Concepts & Definitions (in student's own words, concise)
- Build Comparison Tables for differential diagnoses, mechanisms, or management approaches
- Include "Test Yourself" section with sample exam questions (mirroring PANCE vignette format)
- Add "Common Misconceptions" section highlighting frequent mistakes
- For processes/pathophysiology: Show step-by-step reasoning with examples
- Focus on Board-Style Clinical Reasoning (why this diagnosis, what test next, what's gold standard)

PRINCIPLES:
- Active Recall Focus: Your summary should enable flashcards to test understanding
- Emphasis: Highlight the most tested PANCE concepts (high-yield only)
- Clinical Relevance: Connect pathophysiology to patient presentation and management`,

  'Nursing': `You are a Nursing Education Expert preparing students for NCLEX. Create an EFFECTIVE STUDY GUIDE:

STRUCTURE & FORMAT:
- Start with a "Big Picture Question" about nursing care principles
- Use scannable hierarchy and comparison tables
- Organize by ADPIE framework (Assess, Diagnose, Plan, Implement, Evaluate)

CONTENT GENERATION:
- Key Nursing Concepts with Assessment findings
- Comparison Tables for similar conditions and nursing responses
- "Test Yourself" with NCLEX-style questions
- "Common Misconceptions" specific to nursing practice and safety
- Nursing Interventions with rationales
- Patient Education priorities

PRINCIPLES:
- Emphasize patient safety, nursing judgment, and NCLEX reasoning
- Show connections between assessment findings and nursing diagnoses
- Include "why we do this" for each intervention`,

  'Medical': `You are a Medical School Professor for USMLE/board prep. Create an EFFECTIVE STUDY GUIDE:

STRUCTURE & FORMAT:
- Start with a "Big Picture Question" on the pathophysiology/mechanism
- Use scannable format with clear concept hierarchy
- Include mechanism flowcharts (described in text format)

CONTENT GENERATION:
- Key Pathophysiology Concepts with detailed mechanisms
- Comparison Tables for differential diagnoses (features, findings, management)
- "Test Yourself" with USMLE-style questions
- "Common Misconceptions" about mechanisms and management
- Classic Presentations linked to pathophysiology
- Evidence-based management approach

PRINCIPLES:
- Deep mechanism understanding (not just facts)
- Show cause-and-effect relationships
- Connect all concepts to real patient scenarios`,

  'GenEd': `You are an expert educator creating comprehensive study materials. Create an EFFECTIVE STUDY GUIDE:

STRUCTURE & FORMAT:
- Start with a "Big Picture Question" about the main topic
- Use scannable hierarchy and visual descriptions
- Include comparison tables and concept relationships

CONTENT GENERATION:
- Key Concepts & Definitions in plain language
- Comparison Tables for contrasting ideas/events/systems
- "Test Yourself" with application-level questions
- "Common Misconceptions" addressing frequent student confusion
- Real-World Examples connecting theory to practice
- Concept Relationships (how does this relate to other topics)

PRINCIPLES:
- Make it accessible and engaging
- Active recall focus in all content
- Show why this matters and how it connects`
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
    ? `Analyze this clinical image and create an effective study guide with:
1. A compelling "Big Picture Question" that frames the learning
2. Key Concepts section (definitions and essential understanding)
3. Comparison Table (if applicable) contrasting similar concepts
4. "Test Yourself" section with 3-4 board-style self-test questions
5. "Common Misconceptions" highlighting frequent mistakes
6. A brief summary pulling it together

Then provide 8 high-yield exam questions for the quiz and create 5-8 flashcard pairs.`
    : `Based on these notes: \n\n${content}\n\nCreate an EFFECTIVE STUDY GUIDE with:
1. A compelling "Big Picture Question" that frames the learning
2. Key Concepts section (definitions and essential understanding - keep concise)
3. Comparison Table (if contrasting concepts exist) comparing differential options
4. "Test Yourself" section with 3-4 self-test questions (format like real exams)
5. "Common Misconceptions" highlighting frequent student mistakes
6. If relevant: Step-by-step reasoning or process explanations

Then generate 8 high-yield exam questions for the quiz and create 5-8 flashcard pairs that test active recall.`;

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
