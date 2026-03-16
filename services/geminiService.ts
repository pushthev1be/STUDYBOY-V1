
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
          explanation: { type: Type.STRING },
          subtopic: { type: Type.STRING, description: "Short subtopic heading for grouping (e.g. Pathophysiology, Pharmacology)" }
        },
        required: ["question", "options", "correctAnswer", "explanation", "subtopic"]
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
      explanation: { type: Type.STRING },
      subtopic: { type: Type.STRING, description: "Short subtopic heading for grouping" }
    },
    required: ["question", "options", "correctAnswer", "explanation", "subtopic"]
  }
};

// Default system instruction (PA focused)
const DEFAULT_SYSTEM_INSTRUCTION = DOMAIN_INSTRUCTIONS['PA'];

function getQuizSubtopicExamples(domain: StudyDomain): string {
  switch (domain) {
    case 'Nursing':
      return 'Assessment, Priorities, Intervention, Patient Education';
    case 'Medical':
      return 'Mechanism, Diagnosis, Management, Interpretation';
    case 'GenEd':
      return 'Core Idea, Application, Evidence, Interpretation';
    case 'PA':
    default:
      return 'Pathophysiology, Pharmacology, Diagnosis, Management';
  }
}

function getExtendQuizPrompt(currentTopic: string, domain: StudyDomain): string {
  const subtopics = getQuizSubtopicExamples(domain);

  switch (domain) {
    case 'Nursing':
      return `Generate 5 new NCLEX-style practice questions about "${currentTopic}". Each must include a "subtopic" field (e.g. "${subtopics}"). Vary difficulty and care settings. Use realistic patient-care scenarios, plausible distractors, and concise explanations focused on nursing judgment and safety.

IMPORTANT: For each question, "correctAnswer" MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`;
    case 'Medical':
      return `Generate 5 new medical school practice questions about "${currentTopic}". Each must include a "subtopic" field (e.g. "${subtopics}"). Vary difficulty and reasoning style. Use mechanism-driven patient scenarios where appropriate, plausible distractors, and concise explanations.

IMPORTANT: For each question, "correctAnswer" MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`;
    case 'GenEd':
      return `Generate 5 new practice questions about "${currentTopic}" for a general education learner. Each must include a "subtopic" field (e.g. "${subtopics}"). Vary difficulty and question format. Favor real-world, everyday, historical, literary, scientific, or conceptual examples that match the topic. Keep the tone accessible and engaging. Do NOT use clinical, diagnostic, board-exam, or patient-case framing unless the topic itself is explicitly about health care.

IMPORTANT: For each question, "correctAnswer" MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`;
    case 'PA':
    default:
      return `Generate 5 new board-style questions about "${currentTopic}". Each must include a "subtopic" field (e.g. "${subtopics}"). Vary difficulty and scenarios. Include clinical vignettes, plausible distractors, and concise explanations.

IMPORTANT: For each question, "correctAnswer" MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`;
  }
}

function getRemediationPrompt(currentTopic: string, domain: StudyDomain): string {
  const subtopics = getQuizSubtopicExamples(domain);

  switch (domain) {
    case 'Nursing':
      return `A student got a question wrong about "${currentTopic}". Generate 2 targeted remediation questions that revisit the concept from different nursing perspectives. Include a "subtopic" field (e.g. "${subtopics}"), realistic care scenarios, and explanations that clarify the misconception.

IMPORTANT: For each question, "correctAnswer" MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`;
    case 'Medical':
      return `A student got a question wrong about "${currentTopic}". Generate 2 targeted remediation questions that approach the concept from different mechanistic angles. Include a "subtopic" field (e.g. "${subtopics}"), realistic scenarios where appropriate, and explanations that clarify the misconception.

IMPORTANT: For each question, "correctAnswer" MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`;
    case 'GenEd':
      return `A student got a question wrong about "${currentTopic}". Generate 2 targeted remediation questions that revisit the concept from different angles. Include a "subtopic" field (e.g. "${subtopics}") and explanations that clearly address the misconception. Use accessible, non-clinical framing unless the topic itself is explicitly medical or health-related.

IMPORTANT: For each question, "correctAnswer" MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`;
    case 'PA':
    default:
      return `Student got a question wrong about "${currentTopic}". Generate 2 targeted remediation questions that approach the concept from different angles. Include a "subtopic" field, clinical vignettes, and explanations that clarify the misconception.

IMPORTANT: For each question, "correctAnswer" MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`;
  }
}

function getFreshQuizPrompt(material: StudyMaterial, domain: StudyDomain): string {
  const subtopics = getQuizSubtopicExamples(domain);

  switch (domain) {
    case 'Nursing':
      return `Generate fresh study materials based on this existing material:

Title: "${material.title}"

Summary: "${material.summary}"

Create entirely new content covering the key concepts. Generate:
1. 20 new NCLEX-style practice questions with realistic care scenarios
2. 30 new flashcard pairs covering different aspects

Each quiz question should include:
- A realistic patient-care scenario or prioritization setup
- 4 plausible options with common misconceptions as distractors
- A clear, educational explanation
- A "subtopic" field for organization (e.g. ${subtopics})

IMPORTANT: The "correctAnswer" field for quiz questions MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.

Return as JSON with "quiz" array and "flashcards" array.`;
    case 'Medical':
      return `Generate fresh study materials based on this existing material:

Title: "${material.title}"

Summary: "${material.summary}"

Create entirely new content covering the key concepts. Generate:
1. 20 new medical school practice questions
2. 30 new flashcard pairs covering different aspects

Each quiz question should include:
- A mechanism-focused prompt or realistic scenario when helpful
- 4 plausible options with common misconceptions as distractors
- A clear, educational explanation
- A "subtopic" field for organization (e.g. ${subtopics})

IMPORTANT: The "correctAnswer" field for quiz questions MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.

Return as JSON with "quiz" array and "flashcards" array.`;
    case 'GenEd':
      return `Generate fresh study materials based on this existing material:

Title: "${material.title}"

Summary: "${material.summary}"

Create entirely new content covering the key concepts. Generate:
1. 20 new engaging practice questions for a general education learner
2. 30 new flashcard pairs covering different aspects

Each quiz question should include:
- A clear conceptual or real-world setup that fits the topic
- 4 plausible options with common misconceptions as distractors
- A clear, educational explanation
- A "subtopic" field for organization (e.g. ${subtopics})

Do NOT use clinical, diagnostic, board-exam, or patient-case framing unless the topic itself is explicitly about health care.

IMPORTANT: The "correctAnswer" field for quiz questions MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.

Return as JSON with "quiz" array and "flashcards" array.`;
    case 'PA':
    default:
      return `Generate fresh study materials based on this existing material:

Title: "${material.title}"

Summary: "${material.summary}"

Create entirely new content (different from any seen before) covering the key concepts. Generate:
1. 20 new, challenging board-style quiz questions with clinical scenarios
2. 30 new flashcard pairs covering different aspects

Each quiz question should include:
- A realistic clinical vignette or scenario
- 4 plausible options with common misconceptions as distractors
- A clear, educational explanation
- A "subtopic" field for organization (e.g. ${subtopics})

IMPORTANT: The "correctAnswer" field for quiz questions MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.

Return as JSON with "quiz" array and "flashcards" array.`;
  }
}

// Helper to fix truncated JSON responses
function fixTruncatedJson(text: string): string {
  let fixed = text.trim();
  
  // Remove any trailing incomplete strings (end with unclosed quote)
  const lastQuote = fixed.lastIndexOf('"');
  const lastComma = fixed.lastIndexOf(',');
  const lastColon = fixed.lastIndexOf(':');
  
  // If the last significant char is a colon or comma, we're mid-value
  if (lastColon > lastQuote || (lastComma > lastQuote && lastComma === fixed.length - 1)) {
    // Truncate to last complete value
    fixed = fixed.substring(0, Math.max(lastQuote + 1, 0));
  }
  
  // Count open brackets and braces
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/]/g) || []).length;
  
  // Remove trailing comma if present
  fixed = fixed.replace(/,\s*$/, '');
  
  // Add missing closing characters
  fixed += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
  fixed += '}'.repeat(Math.max(0, openBraces - closeBraces));
  
  return fixed;
}

// Safe JSON parse with truncation fix AND validation
function safeJsonParse<T>(text: string | undefined, fallback: T): T {
  if (!text || text.trim().length === 0) {
    return fallback;
  }
  
  try {
    const parsed = JSON.parse(text) as T;
    return parsed;
  } catch {
    console.warn("JSON parse failed, attempting to fix truncated response");
    try {
      return JSON.parse(fixTruncatedJson(text)) as T;
    } catch (e) {
      console.error("Could not fix truncated JSON:", e);
      return fallback;
    }
  }
}

// Validate and fix quiz questions
function validateAndFixQuestions(questions: any[]): QuizQuestion[] {
  return questions.map(q => {
    // Ensure correctAnswer is a valid 0-based index
    let correctAnswer = q.correctAnswer;
    
    // Handle string indices (AI sometimes returns "0" instead of 0)
    if (typeof correctAnswer === 'string') {
      correctAnswer = parseInt(correctAnswer, 10);
    }
    
    // Handle 1-based indexing (AI sometimes uses 1, 2, 3, 4)
    if (correctAnswer >= 1 && correctAnswer > q.options.length / 2) {
      correctAnswer = correctAnswer - 1;
    }
    
    // Ensure it's within valid range
    if (correctAnswer < 0 || correctAnswer >= q.options.length) {
      console.warn(`Invalid correctAnswer index ${q.correctAnswer} for question with ${q.options.length} options. Defaulting to 0.`);
      correctAnswer = 0;
    }
    
    return {
      ...q,
      correctAnswer,
      explanation: q.explanation || "Review this concept carefully.",
      subtopic: q.subtopic || "General"
    };
  });
}

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
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });
  const model = 'gemini-2.5-flash';
  const systemInstruction = DOMAIN_INSTRUCTIONS[domain];

  const prompt = isImage 
    ? `Analyze this clinical image. Generate a structured study guide. Format the summary with NEWLINES between each section and between each item:

Big Picture Question:
[question text]

Key Concepts & Definitions:
Term1 | Definition1
Term2 | Definition2

Comparison Table:
Feature | Option A | Option B
Row1 data

Test Yourself:
1. Question 1
2. Question 2

Common Misconception:
[misconception text]

Also generate 20 quiz questions (each with a "subtopic" field like "Pathophysiology") and 30 flashcard pairs.

IMPORTANT FOR QUIZ QUESTIONS: The "correctAnswer" field MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`
    : `Analyze these notes and generate a structured study guide. Format the summary with NEWLINES between each section and between each item:

Big Picture Question:
[question text]

Key Concepts & Definitions:
Term1 | Definition1
Term2 | Definition2
(each term on its own line)

Comparison Table:
Feature | Option A | Option B
Row1 data
(each row on its own line)

Test Yourself:
1. Question 1
2. Question 2

Common Misconception:
[misconception text]

NOTES:
${content}

Generate 20 quiz questions (each with a "subtopic" field like "Pathophysiology", "Pharmacology", "Diagnosis") and 30 flashcard pairs.

IMPORTANT FOR QUIZ QUESTIONS: The "correctAnswer" field MUST be a 0-based integer index (0, 1, 2, or 3) that corresponds to the position of the correct answer in the "options" array.`;

  try {
    return await retryWithBackoff(async () => {
      if (isImage) {
        // Image processing temporarily disabled due to SDK compatibility issue
        // TODO: Re-enable when SDK fixes inlineData serialization
        throw new Error("Image processing is temporarily unavailable. Please upload a text or PDF file instead.");
      }
      
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: STUDY_MATERIAL_SCHEMA,
          maxOutputTokens: 16000
        },
      });

      const responseText = response.text;
      console.log("Gemini response length:", responseText?.length || 0);
      
      const result = safeJsonParse<StudyMaterial>(responseText, FALLBACK_STUDY_MATERIAL);
      
      if (!result.title || !result.summary) throw new Error("Invalid response structure");
      
      // Validate and fix quiz questions
      result.quiz = validateAndFixQuestions(result.quiz);
      
      return result;
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return FALLBACK_STUDY_MATERIAL;
  }
}

export async function extendQuiz(currentTopic: string, existingCount: number, domain: StudyDomain = 'PA'): Promise<QuizQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });
  const model = 'gemini-2.5-flash';
  const prompt = getExtendQuizPrompt(currentTopic, domain);

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DOMAIN_INSTRUCTIONS[domain],
          responseMimeType: "application/json",
          responseSchema: ADDITIONAL_QUESTIONS_SCHEMA,
          maxOutputTokens: 8000
        },
      });

      const questions = safeJsonParse<QuizQuestion[]>(response.text, FALLBACK_QUIZ);
      return validateAndFixQuestions(questions);
    });
  } catch (error) {
    console.error("Gemini Extension Error:", error);
    return validateAndFixQuestions(FALLBACK_QUIZ);
  }
}

export async function generateQuestionForFailure(currentTopic: string, domain: StudyDomain = 'PA'): Promise<QuizQuestion[]> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });
  const model = 'gemini-2.5-flash';
  const prompt = getRemediationPrompt(currentTopic, domain);

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DOMAIN_INSTRUCTIONS[domain],
          responseMimeType: "application/json",
          responseSchema: ADDITIONAL_QUESTIONS_SCHEMA,
          maxOutputTokens: 4000
        },
      });

      const questions = safeJsonParse<QuizQuestion[]>(response.text, FALLBACK_QUIZ.slice(0, 2));
      return validateAndFixQuestions(questions);
    });
  } catch (error) {
    console.error("Generate Question for Failure Error:", error);
    return validateAndFixQuestions(FALLBACK_QUIZ.slice(0, 2));
  }
}

export async function generateAdditionalFlashcards(topic: string): Promise<any[]> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });
  const model = 'gemini-2.5-flash';

  const prompt = `Generate 10 flashcard pairs about: "${topic}". Cover different aspects and difficulty levels. Be concise. Return as JSON array with {question, answer} objects.`;

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          maxOutputTokens: 8000
        },
      });

      const result = safeJsonParse<any[]>(response.text, []);
      return Array.isArray(result) ? result : [];
    });
  } catch (error) {
    console.error("Generate Additional Flashcards Error:", error);
    return [];
  }
}

export async function generateWrongAnswerFeedback(
  question: string,
  selectedAnswer: string,
  correctAnswer: string,
  allOptions: string[],
  explanation: string,
  domain: StudyDomain = 'PA'
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });
  const model = 'gemini-2.5-flash';

  const prompt = `A student answered the following question incorrectly:

Question: ${question}

Options:
${allOptions.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n')}

Student selected: "${selectedAnswer}"
Correct answer: "${correctAnswer}"

Original explanation: "${explanation}"

Provide a brief, focused explanation of:
1. Why the student's answer ("${selectedAnswer}") is incorrect
2. Why the correct answer ("${correctAnswer}") is right

Keep it concise (2-3 sentences) and address the specific misconception the student likely had. Format as plain text, not as a list.`;

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DOMAIN_INSTRUCTIONS[domain],
          maxOutputTokens: 500
        },
      });

      return response.text || explanation;
    });
  } catch (error) {
    console.error("Generate Wrong Answer Feedback Error:", error);
    return explanation;
  }
}

export async function generateFreshQuiz(material: StudyMaterial, domain: StudyDomain = 'PA'): Promise<StudyMaterial> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });
  const model = 'gemini-2.5-flash';
  const systemInstruction = DOMAIN_INSTRUCTIONS[domain];

  const prompt = getFreshQuizPrompt(material, domain);

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: STUDY_MATERIAL_SCHEMA,
          maxOutputTokens: 16000
        },
      });

      const result = safeJsonParse<StudyMaterial>(response.text, FALLBACK_STUDY_MATERIAL);
      
      // Validate and fix quiz questions
      if (result.quiz) {
        result.quiz = validateAndFixQuestions(result.quiz);
      }
      
      return {
        ...result,
        title: material.title,
        summary: material.summary
      };
    });
  } catch (error) {
    console.error("Generate Fresh Quiz Error:", error);
    return FALLBACK_STUDY_MATERIAL;
  }
}
