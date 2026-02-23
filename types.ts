
export interface User {
  id: string;
  username: string;
  email: string;
  joinedAt: string;
}

export interface Flashcard {
  question: string;
  answer: string;
  interval?: number; // Days until next review
  easeFactor?: number; // Difficulty multiplier (default 2.5)
  nextReview?: number; // Unix timestamp for next review
}

export type QuestionType = 'multiple-choice' | 'labeling' | 'matching';

export interface ImageLabel {
  id: string;
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  subtopic?: string;
  type?: QuestionType;
  imageLabels?: ImageLabel[];
  matchingPairs?: MatchingPair[];
}

export interface StudyMaterial {
  title: string;
  summary: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  unprocessedContent?: string;
  contentCoveragePercent?: number;
}

export interface QuestionStatus {
  id: number;
  isAnswered: boolean;
  isCorrect: boolean | null;
  selectedOption: number | null;
  isFlagged: boolean;
  showExplanation: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: 'Zap' | 'Star' | 'Award' | 'BookOpen' | 'Cpu' | 'Moon' | 'Flame' | 'Target' | 'Heart' | 'Stethoscope';
  rarity: 'bronze' | 'silver' | 'gold';
  unlocked: boolean;
  requirement: number;
  currentValue: number;
}

export interface StudyGoal {
  id: string;
  label: string;
  target: number;
  current: number;
}

export interface UserStats {
  totalUploads: number;
  totalQuizzesCompleted: number;
  totalFlashcardsViewed: number;
  perfectQuizzes: number;
  streakDays: number;
  lastActive: string;
  usedDomains: string[];
  dailyStudyCount: number;
  currentPerfectStreak: number;
}

export enum AppState {
  AUTH = 'AUTH',
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  VIEWING = 'VIEWING',
  ERROR = 'ERROR'
}

export type StudyDomain = 'PA' | 'Nursing' | 'Medical' | 'GenEd';

export type ViewMode = 'summary' | 'flashcards' | 'quiz' | 'stats';

export interface QuizSession {
  id: string;
  topic: string;
  score: number;
  total: number;
  date: string;
  questions: QuizQuestion[];
  questionStates: QuestionStatus[];
  uploadId?: string;
}

export interface ProcessingState {
  totalContent: string;
  processedContent: string;
  unprocessedContent: string;
  fileName: string;
}

export interface UploadSource {
  fileName: string;
  sourceType: 'text' | 'pdf' | 'image';
  sourceText?: string;
  sourceDataUrl?: string;
  sourceMimeType?: string;
}

export interface SavedUpload {
  id: string;
  fileName: string; // Primary file or batch name
  title: string;
  domain: StudyDomain;
  createdAt: string;
  material: StudyMaterial;
  sources: UploadSource[];
}

export interface ContentPart {
  type: 'text' | 'image';
  data: string;
  fileName?: string;
  mimeType?: string;
}
