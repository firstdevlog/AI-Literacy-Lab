import { createContext, useContext } from "react";
import type {
  AssessmentConfig,
  AssessmentSession,
  EvaluationResult,
  ProgressData,
  Question,
} from "../domain/types";

export interface AppState {
  progress: ProgressData;
  questions: Question[];
  warning: string | null;
  start: (config: AssessmentConfig) => AssessmentSession;
  update: (session: AssessmentSession) => void;
  submit: (session: AssessmentSession) => EvaluationResult;
  toggleBookmark: (id: string) => void;
  importBackup: (json: string) => void;
  discard: () => void;
}
export const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const state = useContext(AppContext);
  if (!state) throw new Error("앱이 초기화되지 않았습니다.");
  return state;
}
