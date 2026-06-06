export type Category = 'general' | 'english' | 'math' | 'history' | 'geography' | 'physics' | 'chemistry' | 'biology' | 'literature';

export const CATEGORIES: { key: Category; icon: string }[] = [
  { key: 'general', icon: '📚' },
  { key: 'english', icon: '🇬🇧' },
  { key: 'math', icon: '🔢' },
  { key: 'history', icon: '🏛️' },
  { key: 'geography', icon: '🌍' },
  { key: 'physics', icon: '⚛️' },
  { key: 'chemistry', icon: '🧪' },
  { key: 'biology', icon: '🧬' },
  { key: 'literature', icon: '📖' },
];

export interface Question {
  id: string;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface QuestionSet {
  id: string;
  name: string;
  category: Category;
  createdAt: string;
  questions: Question[];
  examTimeLimit: number; // minutes, 0 = no limit
  shuffleAnswers: boolean;
}

export interface ParsedQuestion {
  questionText: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: string | null;
  explanation: string | null;
}

export interface UserAnswer {
  questionId: string;
  selectedAnswer: 'A' | 'B' | 'C' | 'D' | null;
  isRevealed: boolean;
}

export interface QuizSession {
  questionSet: QuestionSet;
  answers: Record<string, UserAnswer>;
  currentIndex: number;
  isFinished: boolean;
}

export interface QuestionResult {
  questionId: string;
  questionText: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface QuizResult {
  id: string;
  setId: string;
  setName: string;
  date: string;
  score: { correct: number; total: number };
  questionResults: QuestionResult[];
  mode: 'exam' | 'study';
  timeSpent?: number; // seconds
}

export type Language = 'vi' | 'en';
export type Theme = 'light' | 'dark';
export type QuizMode = 'exam' | 'study';

export interface AppSettings {
  language: Language;
  theme: Theme;
}

export interface SRSData {
  interval: number;      // days until next review
  easeFactor: number;    // >= 1.3, starts at 2.5
  repetitions: number;   // consecutive correct answers
  nextReview: string;    // ISO date string
  lastReview?: string;   // ISO date string
}

export interface VocabItem {
  id: string;
  word: string;
  meaning: string;
  vietnamese?: string; // Vietnamese translation
  wordType?: string; // noun, verb, adjective, etc.
  example?: string;
  phonetic?: string;
  srs?: SRSData;
}

export type StudyMode = 'normal' | 'reverse' | 'contextual' | 'srs';

export type SRSRating = 'again' | 'hard' | 'good' | 'easy';

export interface StudySession {
  setId: string;
  mode: StudyMode;
  cardsStudied: number;
  cardsCorrect: number;
  startedAt: string;
}

export interface VocabSet {
  id: string;
  name: string;
  category: Category;
  createdAt: string;
  items: VocabItem[];
}
