
export interface User {
  username: string;
  email: string;
  joinedAt: string;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface StudyMaterial {
  title: string;
  summary: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
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
  icon: 'Zap' | 'Star' | 'Award' | 'BookOpen' | 'Cpu' | 'Moon' | 'Flame' | 'Target';
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
}

export enum AppState {
  AUTH = 'AUTH',
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  VIEWING = 'VIEWING',
  ERROR = 'ERROR'
}

export type ViewMode = 'summary' | 'flashcards' | 'quiz' | 'stats';
