import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  Flag,
  Save,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../app/context";
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from "../domain/types";
import { Dialog } from "../components/Dialog";
import { EmptyState } from "../components/ui";
import { QuestionExplanation } from "../features/review/QuestionExplanation";

export function Assessment() {
  const { sessionId } = useParams();
  const { progress, update, submit, toggleBookmark } = useApp();
  const navigate = useNavigate();
  const session =
    progress.activeSession?.sessionId === sessionId
      ? progress.activeSession
      : null;
  const submitted = progress.results.find((r) => r.sessionId === sessionId);
  const [now, setNow] = useState(Date.now());
  const [showSubmit, setShowSubmit] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (submitted)
      navigate(`/results/${submitted.sessionId}`, { replace: true });
  }, [submitted, navigate]);
  useEffect(() => {
    if (!session?.deadlineAt || now < session.deadlineAt || submitting.current)
      return;
    submitting.current = true;
    try {
      const result = submit(session);
      navigate(`/results/${result.sessionId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "자동 제출에 실패했습니다.");
      submitting.current = false;
    }
  }, [now, session, submit, navigate]);
  useEffect(() => {
    questionHeading.current?.focus({ preventScroll: true });
  }, [session?.currentIndex]);
  if (!session)
    return (
      <EmptyState
        title={
          submitted
            ? "결과로 이동하고 있습니다"
            : "진행 중인 평가를 찾을 수 없어요"
        }
        action={
          <Link className="button primary" to="/stage/1">
            평가 시작하기
          </Link>
        }
      >
        이미 제출했거나 이 브라우저에 저장되지 않은 평가입니다.
      </EmptyState>
    );
  const question = session.questions[session.currentIndex];
  const answered = Object.keys(session.answers).length;
  const total = session.questions.length;
  const selected = session.answers[question.id];
  const revealed =
    session.mode === "learning" &&
    session.revealedQuestionIds.includes(question.id);
  const remaining = session.deadlineAt
    ? Math.max(0, Math.ceil((session.deadlineAt - now) / 1000))
    : null;
  const elapsed = Math.max(0, Math.floor((now - session.startedAt) / 1000));
  const displaySeconds = remaining ?? elapsed;
  const save = (next: typeof session) => {
    try {
      if (session.deadlineAt && Date.now() >= session.deadlineAt) {
        finish();
        return;
      }
      update(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "답안을 저장할 수 없습니다.");
    }
  };
  function finish() {
    if (!session || submitting.current) return;
    submitting.current = true;
    try {
      const result = submit(session);
      navigate(`/results/${result.sessionId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출할 수 없습니다.");
      submitting.current = false;
    }
  }
  return (
    <div className="assessment-page">
      <div className="assessment-header">
        <div>
          <span className="eyebrow">
            STAGE 1 · {session.mode === "learning" ? "LEARNING" : "ASSESSMENT"}
          </span>
          <h1>
            AI 지식평가{" "}
            <span>
              {session.mode === "learning" ? "학습 모드" : "모의평가"}
            </span>
          </h1>
        </div>
        <div
          className={`timer ${remaining !== null && remaining < 60 ? "timer-urgent" : ""}`}
          aria-label={remaining === null ? "소요 시간" : "남은 시간"}
        >
          <Clock3 size={18} />
          <span>
            {remaining === null ? "소요 시간" : "남은 시간"}
            <strong>
              {`${Math.floor(displaySeconds / 60)}`.padStart(2, "0")}:
              {`${displaySeconds % 60}`.padStart(2, "0")}
            </strong>
          </span>
        </div>
      </div>
      <div className="assessment-progress">
        <div>
          <span>평가 진행률</span>
          <strong>
            {answered}
            <span> / {total}문항 응답</span>
          </strong>
        </div>
        <progress max={total} value={answered} aria-label="응답 진행률" />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="exam-layout">
        <section className="panel question-panel" aria-label="현재 문제">
          <div className="question-meta">
            <div>
              <span className="label-chip">
                {CATEGORY_LABELS[question.category]}
              </span>
              <span className="difficulty-chip">
                {DIFFICULTY_LABELS[question.difficulty]}
              </span>
            </div>
            <button
              type="button"
              className={`icon-button bookmark-button ${progress.bookmarks.includes(question.id) ? "bookmarked" : ""}`}
              aria-label={
                progress.bookmarks.includes(question.id)
                  ? "즐겨찾기 해제"
                  : "즐겨찾기 추가"
              }
              aria-pressed={progress.bookmarks.includes(question.id)}
              onClick={() => toggleBookmark(question.id)}
            >
              <Bookmark
                size={21}
                fill={
                  progress.bookmarks.includes(question.id)
                    ? "currentColor"
                    : "none"
                }
              />
            </button>
          </div>
          <p className="question-counter">
            QUESTION {String(session.currentIndex + 1).padStart(2, "0")}
            <span> / {String(total).padStart(2, "0")}</span>
          </p>
          <h2 ref={questionHeading} tabIndex={-1} className="question-stem">
            {question.stem}
          </h2>
          <fieldset className="answer-options">
            <legend className="sr-only">답안 선택</legend>
            {session.displayedOptionOrder[question.id].map((id, index) => {
              const option = question.options.find((o) => o.id === id)!;
              return (
                <label
                  key={id}
                  className={`answer-option ${selected === id ? "chosen" : ""}`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={id}
                    checked={selected === id}
                    disabled={revealed}
                    onChange={() =>
                      save({
                        ...session,
                        answers: { ...session.answers, [question.id]: id },
                      })
                    }
                  />
                  <span className="option-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option.text}</span>
                  {selected === id && (
                    <Check size={19} className="choice-check" />
                  )}
                </label>
              );
            })}
          </fieldset>
          <div className="question-save">
            <Save size={14} />
            {selected
              ? "선택한 답안이 자동 저장되었습니다."
              : "가장 적절한 답안을 하나 선택하세요."}
          </div>
          {session.mode === "learning" && !revealed && (
            <button
              className="button secondary reveal-button"
              onClick={() =>
                save({
                  ...session,
                  revealedQuestionIds: [
                    ...session.revealedQuestionIds,
                    question.id,
                  ],
                })
              }
            >
              <Eye size={17} />
              정답과 해설 보기
            </button>
          )}
          {revealed && (
            <QuestionExplanation question={question} selected={selected} />
          )}
          <div className="question-footer">
            <button
              className="button secondary"
              disabled={session.currentIndex === 0}
              onClick={() =>
                save({ ...session, currentIndex: session.currentIndex - 1 })
              }
            >
              <ArrowLeft size={16} />
              이전 문제
            </button>
            {session.currentIndex < total - 1 ? (
              <button
                className="button primary"
                onClick={() =>
                  save({ ...session, currentIndex: session.currentIndex + 1 })
                }
              >
                다음 문제
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="button primary"
                onClick={() => setShowSubmit(true)}
              >
                <Flag size={16} />
                제출하기
              </button>
            )}
          </div>
        </section>
        <aside className="exam-sidebar">
          <details className="panel question-navigator" open>
            <summary>
              문제 번호 <ChevronDown size={17} />
            </summary>
            <div className="navigator-body">
              <div className="number-grid">
                {session.questions.map((q, i) => (
                  <button
                    key={q.id}
                    aria-label={`${i + 1}번 문제, ${session.answers[q.id] ? "응답 완료" : "미응답"}`}
                    aria-current={
                      i === session.currentIndex ? "step" : undefined
                    }
                    className={`${session.answers[q.id] ? "answered" : ""} ${i === session.currentIndex ? "current" : ""}`}
                    onClick={() => save({ ...session, currentIndex: i })}
                  >
                    {i + 1}
                    {progress.bookmarks.includes(q.id) && (
                      <span className="bookmark-dot" />
                    )}
                  </button>
                ))}
              </div>
              <div className="nav-legend">
                <span>
                  <i className="legend-answered" />
                  응답 완료
                </span>
                <span>
                  <i />
                  미응답
                </span>
              </div>
            </div>
          </details>
          <div className="panel submit-panel">
            <p>
              <strong>{total - answered}문항</strong>이 아직 미응답이에요.
            </p>
            <p className="muted tiny">
              미응답 문항은 채점 시 오답으로 처리됩니다.
            </p>
            <button
              className="button primary full-width"
              onClick={() => setShowSubmit(true)}
            >
              <Flag size={17} />
              제출하기
            </button>
          </div>
          <p className="sidebar-note">
            <ShieldNotice />
            답안은 이 브라우저에 저장됩니다.
            <br />
            <Link to="/">나중에 이어 풀기</Link>
          </p>
        </aside>
      </div>
      {showSubmit && (
        <Dialog
          title="평가를 제출할까요?"
          confirm="제출 확정"
          onClose={() => setShowSubmit(false)}
          onConfirm={finish}
        >
          <p>
            전체 {total}문항 중 <strong>{answered}문항 응답</strong>,{" "}
            <strong>미응답 {total - answered}문항</strong>입니다.
          </p>
          <p>
            미응답 문항은 오답으로 처리됩니다. 제출 후에는 답안을 수정할 수
            없습니다.
          </p>
        </Dialog>
      )}
    </div>
  );
}
function ShieldNotice() {
  return <Save size={14} />;
}
