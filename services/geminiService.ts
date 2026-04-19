
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedTopic, CheckSession, SessionTurnResponse, KnowledgeReport, TopicStatus } from "../types";

const EXAMINER_SYSTEM_INSTRUCTION = `You are CrossCheck, a rigorous AI knowledge examiner. Your sole job is to audit whether a student truly understands their study notes — not to teach them.

RULES:
1. Ask open-ended questions that require full-sentence explanations. Never ask yes/no questions.
2. Use formats like: "Walk me through how X works.", "Explain the relationship between X and Y.", "What happens when X? Why?", "How does X differ from Y?"
3. At least 85% of questions must be explanation-type. Use multiple-choice or true/false ONLY when the concept genuinely requires it, and flag it.
4. Probe deeper when answers are vague, incomplete, or self-contradictory. Do not accept single-sentence answers for complex topics.
5. Cover all extracted topics systematically. Track which are covered and prioritize uncovered topics as time runs low.
6. Assess proficiency holistically — not by a score, but by the quality of explanations and ability to handle follow-up probes.

PROFICIENCY LEVELS:
- strong: Clear explanation, handled follow-up, made connections between concepts
- weak: Shallow answer, could not elaborate when probed, or gave inconsistent answers
- revisit: Demonstrated a specific misconception or critical gap tied to the notes

Be direct, clinical, and professional. Do not praise, encourage, or soften. You are an examiner, not a tutor.`;

const TOPIC_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A concise title for the uploaded notes" },
    topics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          concepts: { type: Type.ARRAY, items: { type: Type.STRING } },
          noteSection: { type: Type.STRING, description: "The section or heading in the notes where this topic appears" }
        },
        required: ["id", "name", "concepts"]
      }
    }
  },
  required: ["title", "topics"]
};

const SESSION_TURN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING, description: "Your next question or follow-up probe to the student" },
    isFollowUp: { type: Type.BOOLEAN, description: "True if this probes the same topic as the previous question" },
    currentTopicId: { type: Type.STRING, description: "The topic ID being addressed by this question" },
    topicUpdate: {
      type: Type.OBJECT,
      properties: {
        topicId: { type: Type.STRING },
        status: { type: Type.STRING, enum: ["strong", "weak", "revisit"] },
        evidence: { type: Type.STRING, description: "Brief reasoning for this assessment based on what the student said" }
      },
      required: ["topicId", "status", "evidence"]
    },
    sessionShouldEnd: { type: Type.BOOLEAN, description: "True if all topics have been sufficiently assessed" },
    overtimeNeeded: { type: Type.BOOLEAN, description: "True if time is up but a weak/revisit area still needs probing" }
  },
  required: ["message", "isFollowUp", "currentTopicId", "sessionShouldEnd", "overtimeNeeded"]
};

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    topics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topicId: { type: Type.STRING },
          topicName: { type: Type.STRING },
          status: { type: Type.STRING, enum: ["strong", "weak", "revisit", "untested"] },
          evidence: { type: Type.STRING, description: "What the student said (or failed to say) that led to this classification" },
          noteSection: { type: Type.STRING }
        },
        required: ["topicId", "topicName", "status", "evidence"]
      }
    },
    revisitList: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          concept: { type: Type.STRING },
          topicName: { type: Type.STRING },
          noteSection: { type: Type.STRING }
        },
        required: ["concept", "topicName"]
      }
    }
  },
  required: ["topics", "revisitList"]
};

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const retryable = err?.status === 503 || err?.status === 429 || err?.message?.includes('overloaded');
      if (!retryable || i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastError;
}

export async function extractTopicsFromNotes(noteContent: string): Promise<{ title: string; topics: ExtractedTopic[] }> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });

  const prompt = `Analyze these study notes. Extract all major topics and their key concepts. Assign each topic a short snake_case id (e.g. "cardiac_physiology"). Identify the section or heading in the notes where each topic appears if possible.

NOTES:
${noteContent}`;

  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are an expert academic analyst. Extract structured topic data from study notes.",
        responseMimeType: "application/json",
        responseSchema: TOPIC_EXTRACTION_SCHEMA,
        maxOutputTokens: 4000
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    const parsed = JSON.parse(text);
    return { title: parsed.title || "Uploaded Notes", topics: parsed.topics || [] };
  });
}

export async function runSessionTurn(
  session: CheckSession,
  userMessage: string | null,
  elapsedSeconds: number,
  isFirstTurn: boolean
): Promise<SessionTurnResponse> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });

  const totalSeconds = session.duration * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const remainingMinutes = Math.ceil(remainingSeconds / 60);

  const topicSummary = session.topics.map(t => {
    const perf = session.topicPerformances[t.id];
    const status = perf ? perf.status : 'untested';
    return `- ${t.name} (id: ${t.id}) [${status}] — concepts: ${t.concepts.slice(0, 4).join(', ')}`;
  }).join('\n');

  const conversationHistory = session.messages.slice(-20).map(m => ({
    role: m.role === 'ai' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }]
  }));

  const systemContext = `
NOTES TITLE: ${session.uploadTitle}
SESSION DURATION: ${session.duration} minutes
TIME REMAINING: ~${remainingMinutes} minute(s)
IS OVERTIME: ${session.isOvertimeActive}

TOPICS TO COVER:
${topicSummary}

NOTES CONTENT (excerpt):
${session.noteContent.slice(0, 3000)}${session.noteContent.length > 3000 ? '\n[...notes truncated...]' : ''}

${isFirstTurn ? 'This is the first turn. Open the session with a brief acknowledgment that the audit is beginning, then ask your first question.' : ''}
${session.isOvertimeActive ? 'OVERTIME ACTIVE: Focus only on weak/revisit topics. End the session once those are resolved.' : ''}
${remainingMinutes <= 3 && !session.isOvertimeActive ? 'TIME IS RUNNING LOW: Prioritize any untested or weak topics.' : ''}`;

  const contents = isFirstTurn
    ? [{ role: 'user' as const, parts: [{ text: '[Session starting. Begin the audit.]' }] }]
    : [...conversationHistory];

  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: EXAMINER_SYSTEM_INSTRUCTION + '\n\n' + systemContext,
        responseMimeType: "application/json",
        responseSchema: SESSION_TURN_SCHEMA,
        maxOutputTokens: 1000
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text) as SessionTurnResponse;
  });
}

export async function generateKnowledgeReport(session: CheckSession): Promise<KnowledgeReport> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });

  const conversationSummary = session.messages
    .map(m => `${m.role === 'ai' ? 'EXAMINER' : 'STUDENT'}: ${m.content}`)
    .join('\n\n');

  const existingAssessments = Object.values(session.topicPerformances)
    .map(p => `${p.topicName}: ${p.status} — ${p.evidence}`)
    .join('\n');

  const prompt = `Generate a final knowledge breakdown report for this audit session.

NOTES TITLE: ${session.uploadTitle}
TOPICS EXTRACTED:
${session.topics.map(t => `- ${t.name} (id: ${t.id}, section: ${t.noteSection || 'N/A'})`).join('\n')}

EXISTING TOPIC ASSESSMENTS:
${existingAssessments || 'None recorded during session.'}

FULL CONVERSATION:
${conversationSummary.slice(0, 8000)}

Classify each topic as strong/weak/revisit/untested. For any weak or revisit topics, add specific concepts to the revisitList with references to the note section where possible.`;

  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are CrossCheck. Generate an accurate, evidence-based knowledge breakdown report based on the Q&A session transcript.",
        responseMimeType: "application/json",
        responseSchema: REPORT_SCHEMA,
        maxOutputTokens: 4000
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    const parsed = JSON.parse(text);

    const actualMinutes = session.endTime
      ? Math.round((session.endTime - session.startTime) / 60000)
      : session.duration;

    return {
      sessionId: session.id,
      date: new Date().toISOString(),
      uploadTitle: session.uploadTitle,
      durationMinutes: session.duration,
      actualDurationMinutes: actualMinutes,
      topics: (parsed.topics || []).map((t: any) => ({
        ...t,
        concepts: session.topics.find(st => st.id === t.topicId)?.concepts || []
      })),
      revisitList: parsed.revisitList || [],
      overtimeUsed: session.isOvertimeActive
    } as KnowledgeReport;
  });
}
