import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AssessmentConfig, AssessmentSession } from "../domain/types";
import {
  assessmentService,
  evaluationService,
  progressRepository,
  questionRepository,
} from "../infrastructure/services";
import { AppContext } from "./context";

export function AppProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(() => progressRepository.load());
  const [questions] = useState(() => questionRepository.getAll());
  const [warning, setWarning] = useState(() => progressRepository.getWarning());
  const refresh = useCallback(() => {
    setProgress(progressRepository.load());
    setWarning(progressRepository.getWarning());
  }, []);
  useEffect(() => {
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [refresh]);
  const activeId = progress.activeSession?.sessionId;
  const activeDeadline = progress.activeSession?.deadlineAt;
  useEffect(() => {
    if (!activeId || activeDeadline == null) return;
    const expire = () => {
      const current = progressRepository.load().activeSession;
      if (
        !current ||
        current.sessionId !== activeId ||
        current.deadlineAt == null ||
        Date.now() < current.deadlineAt
      )
        return;
      try {
        progressRepository.saveResult(evaluationService.evaluate(current));
        refresh();
      } catch {
        setWarning(
          "시간이 만료되었지만 자동 제출하지 못했습니다. 평가를 이어 열어 다시 제출해 주세요.",
        );
      }
    };
    const timer = window.setTimeout(
      expire,
      Math.min(Math.max(0, activeDeadline - Date.now()), 2_147_483_647),
    );
    window.addEventListener("focus", expire);
    document.addEventListener("visibilitychange", expire);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", expire);
      document.removeEventListener("visibilitychange", expire);
    };
  }, [activeId, activeDeadline, refresh]);
  const start = (config: AssessmentConfig) => {
    const latest = progressRepository.load();
    if (latest.activeSession)
      throw new Error(
        "진행 중인 평가가 있습니다. 이어 풀거나 먼저 종료해 주세요.",
      );
    const previous = [...latest.results].sort(
      (a, b) => b.submittedAt - a.submittedAt,
    )[0];
    const session = assessmentService.create({
      ...config,
      previousQuestionIds: previous?.questionIds,
    });
    progressRepository.saveActive(session);
    refresh();
    return session;
  };
  const update = (session: AssessmentSession) => {
    progressRepository.saveActive(session);
    refresh();
  };
  const submit = (session: AssessmentSession) => {
    const existing = progressRepository
      .load()
      .results.find((r) => r.sessionId === session.sessionId);
    const result = existing ?? evaluationService.evaluate(session);
    const saved = progressRepository.saveResult(result);
    refresh();
    return saved;
  };
  return (
    <AppContext.Provider
      value={{
        progress,
        questions,
        warning,
        start,
        update,
        submit,
        toggleBookmark: (id) => {
          progressRepository.toggleBookmark(id);
          refresh();
        },
        importBackup: (json) => {
          progressRepository.importData(json);
          refresh();
        },
        discard: () => {
          progressRepository.saveActive(null);
          refresh();
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
