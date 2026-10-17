import { useState } from "react";
import { Bookmark, RotateCcw, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../app/context";
import { CATEGORY_LABELS } from "../domain/types";
import { EmptyState, PageHeading, StartLink } from "../components/ui";
import { QuestionExplanation } from "../features/review/QuestionExplanation";

export function Review() {
  const { questions, progress, start, toggleBookmark } = useApp();
  const [tab, setTab] = useState<"wrong" | "bookmarks">("wrong");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const mistakeCounts = new Map<string, number>();
  for (const result of progress.results) {
    for (const id of result.wrongQuestionIds)
      mistakeCounts.set(id, (mistakeCounts.get(id) ?? 0) + 1);
  }
  const wrong = [...mistakeCounts].map(([questionId, count]) => ({
    questionId,
    count,
  }));
  const wrongIds = wrong.map((w) => w.questionId);
  const ids = tab === "wrong" ? wrongIds : progress.bookmarks;
  const reviewQuestions = questions
    .filter((q) => ids.includes(q.id) && q.status === "published")
    .sort(
      (a, b) =>
        (wrong.find((w) => w.questionId === b.id)?.count ?? 0) -
        (wrong.find((w) => w.questionId === a.id)?.count ?? 0),
    );
  const unavailable = ids.filter(
    (id) => !reviewQuestions.some((q) => q.id === id),
  ).length;
  function begin() {
    try {
      const session = start({
        mode: "learning",
        count: Math.min(reviewQuestions.length, 10),
        questionIds: reviewQuestions.map((q) => q.id),
        timeLimitSeconds: null,
      });
      navigate(`/assessment/${session.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "복습을 시작할 수 없습니다.");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE IT YOUR KNOWLEDGE"
        title="복습 노트"
        action={
          <button
            className="button primary"
            disabled={!reviewQuestions.length || !!progress.activeSession}
            onClick={begin}
          >
            <RotateCcw size={17} />
            {tab === "wrong" ? "오답 복습 시작" : "즐겨찾기 학습 시작"}
          </button>
        }
      >
        <p>틀린 문제와 기억하고 싶은 개념을 모아, 나의 실력으로 만드세요.</p>
      </PageHeading>
      <div className="review-tabs" role="group" aria-label="복습 유형">
        <button
          className={tab === "wrong" ? "active" : ""}
          aria-pressed={tab === "wrong"}
          onClick={() => setTab("wrong")}
        >
          <RotateCcw size={17} />
          오답 노트 <span>{wrongIds.length}</span>
        </button>
        <button
          className={tab === "bookmarks" ? "active" : ""}
          aria-pressed={tab === "bookmarks"}
          onClick={() => setTab("bookmarks")}
        >
          <Bookmark size={17} />
          즐겨찾기 <span>{progress.bookmarks.length}</span>
        </button>
      </div>
      {progress.activeSession && (
        <p className="notice-inline">
          진행 중인 평가가 있어요.{" "}
          <Link to={`/assessment/${progress.activeSession.sessionId}`}>
            이어서 풀기 <ArrowRight size={14} />
          </Link>
        </p>
      )}
      {unavailable > 0 && (
        <p className="notice-inline">
          현재 문제은행에서 사용할 수 없는 {unavailable}문항은 출제에서
          제외됩니다. 과거 문항과 해설은 응시 결과에서 확인할 수 있습니다.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {reviewQuestions.length ? (
        <div className="review-question-list">
          {reviewQuestions.map((q) => (
            <article className="panel review-note" key={q.id}>
              <div className="question-meta">
                <div>
                  <span className="label-chip">
                    {CATEGORY_LABELS[q.category]}
                  </span>
                  {tab === "wrong" && (
                    <span className="mistake-count">
                      오답·미응답{" "}
                      {wrong.find((w) => w.questionId === q.id)?.count ?? 0}회
                    </span>
                  )}
                </div>
                <button
                  className="icon-button"
                  aria-label={
                    progress.bookmarks.includes(q.id)
                      ? "즐겨찾기 해제"
                      : "즐겨찾기 추가"
                  }
                  aria-pressed={progress.bookmarks.includes(q.id)}
                  onClick={() => toggleBookmark(q.id)}
                >
                  <Bookmark
                    size={20}
                    fill={
                      progress.bookmarks.includes(q.id)
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              </div>
              <h2>{q.stem}</h2>
              <details>
                <summary>정답과 해설 확인</summary>
                <QuestionExplanation question={q} neutral />
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title={
              tab === "wrong"
                ? "아직 복습할 오답이 없어요"
                : "즐겨찾기한 문제가 없어요"
            }
            action={<StartLink />}
          >
            {tab === "wrong"
              ? "평가를 제출하면 오답과 미응답 문항을 여기에서 복습할 수 있어요."
              : "문제 풀이 중 북마크 아이콘을 눌러 다시 보고 싶은 문제를 모아보세요."}
          </EmptyState>
        </div>
      )}
    </>
  );
}
