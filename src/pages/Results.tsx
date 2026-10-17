import { formatDate, formatDuration } from "../lib/format";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  RotateCcw,
  Target,
  Trophy,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { useApp } from "../app/context";
import { CATEGORY_LABELS } from "../domain/types";
import { EmptyState, PageHeading } from "../components/ui";
import { QuestionExplanation } from "../features/review/QuestionExplanation";

export function Results() {
  const { sessionId } = useParams();
  const { progress, start, toggleBookmark } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const result = progress.results.find((r) => r.sessionId === sessionId);
  if (!result)
    return (
      <EmptyState
        title="저장된 결과를 찾을 수 없어요"
        action={
          <Link className="button primary" to="/history">
            학습 기록 보기
          </Link>
        }
      >
        다른 브라우저의 기록은 백업 파일을 가져와 복원할 수 있습니다.
      </EmptyState>
    );
  function retry(onlyWrong: boolean) {
    if (!result) return;
    try {
      const session = start({
        mode: onlyWrong ? "learning" : result.mode,
        count: onlyWrong
          ? result.wrongQuestionIds.length
          : result.totalQuestions,
        questionIds: onlyWrong ? result.wrongQuestionIds : undefined,
        timeLimitSeconds: onlyWrong ? null : undefined,
      });
      navigate(`/assessment/${session.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "평가를 시작할 수 없습니다.");
    }
  }
  return (
    <>
      <Link className="back-link" to="/history">
        <ArrowLeft size={16} />
        학습 기록
      </Link>
      <PageHeading eyebrow="YOUR LEARNING REPORT" title="평가 결과">
        <p>
          AI 지식평가 · {result.mode === "learning" ? "학습 모드" : "모의평가"}{" "}
          · {formatDate(result.submittedAt)}
        </p>
      </PageHeading>
      <section className="result-overview panel">
        <div className="score-circle">
          <Trophy size={23} />
          <strong>
            {result.score}
            <small>점</small>
          </strong>
          <span>총점 / 100</span>
        </div>
        <div className="result-message">
          <span className="eyebrow">ONE STEP FORWARD</span>
          <h2>
            {result.score >= 80
              ? "탄탄한 AI 역량을 쌓고 있어요!"
              : result.score >= 50
                ? "배움이 실력이 되고 있어요."
                : "오늘의 발견이 내일의 실력이 됩니다."}
          </h2>
          <p>
            점수보다 중요한 것은 이해하고 다시 도전하는 과정이에요.
            <br />
            해설을 확인하며 다음 한 걸음을 준비해 보세요.
          </p>
          <div className="result-counts">
            <span>
              <i className="status-correct" />
              정답 <strong>{result.correctCount}문항</strong>
            </span>
            <span>
              <i className="status-wrong" />
              오답 <strong>{result.incorrectCount}문항</strong>
            </span>
            <span>
              <i className="status-unanswered" />
              미응답 <strong>{result.unansweredCount}문항</strong>
            </span>
          </div>
        </div>
        <div className="result-facts">
          <span>
            정답률 <strong>{result.accuracy}%</strong>
          </span>
          <span>
            소요 시간 <strong>{formatDuration(result.durationSeconds)}</strong>
          </span>
          <span>
            전체 문항 <strong>{result.totalQuestions}문항</strong>
          </span>
        </div>
      </section>
      <p className="score-formula">
        총점 = 정답 수 ÷ 전체 문항 수 × 100 (100점 만점) · 정답률은 같은 비율을
        %로 표시합니다. 미응답은 0점(오답)으로 처리되며, 전체 문항 수와 오답
        복습에 포함됩니다.
      </p>
      <div className="result-actions">
        <button
          className="button primary"
          disabled={!result.wrongQuestionIds.length || !!progress.activeSession}
          onClick={() => retry(true)}
        >
          <RotateCcw size={17} />
          오답 복습 시작
        </button>
        <button
          className="button secondary"
          disabled={!!progress.activeSession}
          onClick={() => retry(false)}
        >
          <ArrowRight size={17} />
          다시 응시하기
        </button>
        <Link className="text-link" to="/">
          대시보드로
        </Link>
      </div>
      {progress.activeSession && (
        <p className="notice-inline">
          진행 중인 평가를 마치면 새 평가를 시작할 수 있어요.{" "}
          <Link to={`/assessment/${progress.activeSession.sessionId}`}>
            이어서 풀기
          </Link>
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="panel area-panel">
        <div className="panel-heading">
          <h2>
            <Target size={20} /> 영역별 정답률
          </h2>
          <span className="muted tiny">이번 평가의 진단 결과</span>
        </div>
        <div className="area-grid">
          {result.categoryResults.map((c) => (
            <div className="area-item" key={c.category}>
              <div>
                <strong>{CATEGORY_LABELS[c.category]}</strong>
                <span>
                  {c.correct}/{c.total}문항 · {c.accuracy}%
                </span>
              </div>
              <progress
                value={c.correct}
                max={c.total}
                aria-label={`${CATEGORY_LABELS[c.category]} 정답률`}
              />
            </div>
          ))}
        </div>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>문항별 해설</h2>
            <p>틀린 이유를 이해하면 다음에는 더 잘 풀 수 있어요.</p>
          </div>
          <span className="section-label">제출 완료 · 수정 불가</span>
        </div>
        <div className="review-question-list">
          {result.questions.map((q, i) => {
            const selected = result.answers[q.id];
            const correct = selected === q.correctOptionId;
            return (
              <details className="panel result-question" key={q.id}>
                <summary>
                  <span
                    className={`answer-status ${correct ? "correct" : selected ? "wrong" : "unanswered"}`}
                  >
                    {correct ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <span>{selected ? "×" : "−"}</span>
                    )}
                    {correct ? "정답" : selected ? "오답" : "미응답"}
                  </span>
                  <span>
                    <small>
                      {i + 1}. {CATEGORY_LABELS[q.category]}
                    </small>
                    <strong>{q.stem}</strong>
                  </span>
                  <span className="expand-indicator">+</span>
                </summary>
                <div className="result-question-body">
                  <div className="your-answer">
                    내 답안:{" "}
                    {q.options.find((o) => o.id === selected)?.text ??
                      "답안을 선택하지 않았습니다."}
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
                        size={19}
                        fill={
                          progress.bookmarks.includes(q.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                  </div>
                  <QuestionExplanation question={q} selected={selected} />
                  <p className="tiny muted">
                    문항 {q.id} · v{q.version} · 응시 당시 버전
                  </p>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </>
  );
}
