export const CATEGORY_LABELS = {
  fundamentals: "AI 기본 개념",
  generative: "생성형 AI 및 LLM",
  prompting: "프롬프트 엔지니어링",
  verification: "AI 출력 검증",
  responsible: "Responsible AI",
  security: "정보보안과 개인정보",
  productivity: "업무 활용 및 생산성",
  systems: "AI 시스템 활용 개념",
} as const;

export type Category = keyof typeof CATEGORY_LABELS;
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
export type Difficulty = "beginner" | "intermediate" | "advanced";
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};
export type Mode = "learning" | "assessment";
export type StageId = 1 | 2 | 3;

export interface Question {
  id: string;
  stage: StageId;
  type: "single_choice";
  category: Category;
  difficulty: Difficulty;
  stem: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  optionExplanations: Record<string, string>;
  tags: string[];
  provenance: "original" | "licensed" | "user_provided";
  version: number;
  status: "published" | "review";
}

export interface AssessmentConfig {
  mode: Mode;
  count: number;
  categories?: Category[];
  difficulty?: Difficulty;
  questionIds?: string[];
  previousQuestionIds?: string[];
  timeLimitSeconds?: number | null;
}

export interface AssessmentSession {
  sessionId: string;
  assessmentId: "stage-1";
  mode: Mode;
  startedAt: number;
  deadlineAt: number | null;
  questions: Question[];
  questionIds: string[];
  displayedOptionOrder: Record<string, string[]>;
  answers: Record<string, string>;
  currentIndex: number;
  revealedQuestionIds: string[];
  questionVersion: Record<string, number>;
}

export interface CategoryResult {
  category: Category;
  total: number;
  correct: number;
  accuracy: number;
}

export interface EvaluationResult {
  sessionId: string;
  assessmentId: "stage-1";
  mode: Mode;
  startedAt: number;
  submittedAt: number;
  durationSeconds: number;
  questions: Question[];
  questionIds: string[];
  displayedOptionOrder: Record<string, string[]>;
  answers: Record<string, string>;
  questionVersion: Record<string, number>;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  score: number;
  accuracy: number;
  categoryResults: CategoryResult[];
  wrongQuestionIds: string[];
}

export interface ProgressData {
  version: 1;
  activeSession: AssessmentSession | null;
  results: EvaluationResult[];
  bookmarks: string[];
}

export interface LearningAnalytics {
  attemptCount: number;
  latestScore: number | null;
  bestScore: number | null;
  averageScore: number | null;
  categoryResults: CategoryResult[];
  repeatedMistakes: { questionId: string; count: number }[];
}

export interface QuestionRepository {
  getAll(): Question[];
  getByIds(ids: string[]): Question[];
}
export interface AssessmentService {
  create(config: AssessmentConfig, now?: number): AssessmentSession;
}
export interface EvaluationService {
  evaluate(session: AssessmentSession, now?: number): EvaluationResult;
}
export interface ProgressRepository {
  load(): ProgressData;
  saveActive(session: AssessmentSession | null): void;
  saveResult(result: EvaluationResult): EvaluationResult;
  toggleBookmark(id: string): void;
  exportData(): string;
  importData(json: string): void;
  getWarning(): string | null;
}
export interface LearningAnalyticsService {
  summarize(results: EvaluationResult[]): LearningAnalytics;
}
