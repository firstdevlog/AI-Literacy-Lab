import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  ListChecks,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../app/context";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  type Category,
  type Difficulty,
  type Mode,
} from "../domain/types";
import { Dialog } from "../components/Dialog";

export function StageIntro() {
  const { progress, questions, start, discard } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("learning");
  const [count, setCount] = useState(10);
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [timed, setTimed] = useState(true);
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const available = questions.filter(
    (q) =>
      q.status === "published" &&
      (!category || category === q.category) &&
      (!difficulty || difficulty === q.difficulty),
  );
  function begin() {
    try {
      const session = start({
        mode,
        count,
        categories: category ? [category as Category] : undefined,
        difficulty: difficulty ? (difficulty as Difficulty) : undefined,
        timeLimitSeconds: mode === "assessment" && timed ? 25 * 60 : null,
      });
      navigate(`/assessment/${session.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "평가를 시작할 수 없습니다.");
    }
  }
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={16} /> 대시보드
      </Link>
      <div className="intro-layout">
        <section className="intro-copy">
          <span className="label-chip">STAGE 1 · KNOWLEDGE</span>
          <h1>AI 지식평가</h1>
          <p className="intro-lead">
            AI 기본 개념부터 활용 원칙까지.
            <br />
            처음이라면 여기서 시작하세요.
          </p>
          <p className="muted">
            개념 이해와 실무 판단을 함께 연습하며,
            <br />
            지금 나의 AI 활용 역량과 다음 학습 목표를 발견하세요.
          </p>
          <div className="intro-facts">
            <div>
              <ListChecks size={20} />
              <strong>10 / 20문항</strong>
              <span>학습 / 모의평가 기본값</span>
            </div>
            <div>
              <Clock3 size={20} />
              <strong>자율 / 25분</strong>
              <span>시간 제한 선택 가능</span>
            </div>
            <div>
              <BookOpen size={20} />
              <strong>초급 → 고급</strong>
              <span>난이도별 맞춤 학습</span>
            </div>
          </div>
          <h2 className="small-heading">이런 내용을 함께 배워요</h2>
          <div className="category-chips">
            {CATEGORIES.map((c) => (
              <span key={c}>
                <CheckCircle2 size={14} />
                {CATEGORY_LABELS[c]}
              </span>
            ))}
          </div>
          <div className="notice">
            <ShieldCheck size={19} />
            <p>
              개인 학습을 위한 평가입니다. 정답 데이터는 브라우저에서 처리되며,
              공식 인증 시험이나 부정행위 방지 시험이 아닙니다.
            </p>
          </div>
        </section>
        <section className="panel setup-panel" aria-label="평가 설정">
          <div className="panel-heading">
            <h2>어떻게 학습할까요?</h2>
            <span className="muted tiny">나에게 맞는 방식으로</span>
          </div>
          <fieldset className="mode-picker">
            <legend className="sr-only">평가 모드</legend>
            {(["learning", "assessment"] as const).map((m) => (
              <label
                className={`mode-option ${mode === m ? "selected" : ""}`}
                key={m}
              >
                <input
                  type="radio"
                  aria-label={m === "learning" ? "학습 모드" : "모의평가 모드"}
                  name="mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => {
                    setMode(m);
                    setCount(m === "learning" ? 10 : 20);
                  }}
                />
                {m === "learning" ? (
                  <BookOpen size={20} />
                ) : (
                  <Timer size={20} />
                )}
                <strong>
                  {m === "learning" ? "학습 모드" : "모의평가 모드"}
                </strong>
                <small>
                  {m === "learning"
                    ? "내 속도대로, 해설과 함께"
                    : "시간 안에 실력 진단"}
                </small>
              </label>
            ))}
          </fieldset>
          <p className="mode-description">
            {mode === "learning"
              ? "문제별로 정답과 해설을 바로 확인할 수 있어요. 시간 제한 없이 개념을 익혀보세요."
              : "제출 전에는 해설이 보이지 않아요. 제한시간이 끝나면 현재 답안으로 자동 제출됩니다."}
          </p>
          <div className="form-fields">
            <label>
              출제 영역
              <select
                aria-label="출제 영역"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">전체 영역 · 균형 출제</option>
                {CATEGORIES.map((c) => (
                  <option value={c} key={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                난이도
                <select
                  aria-label="난이도"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="">모든 난이도</option>
                  {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                문항 수
                <select
                  aria-label="문항 수"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {[5, 10, 20, 40, 64].map((n) => (
                    <option value={n} key={n}>
                      {n}문항
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {mode === "assessment" && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  aria-label="시간 제한 사용"
                  checked={timed}
                  onChange={(e) => setTimed(e.target.checked)}
                />
                시간 제한 사용 <span>25분 · 자체 평가 기준</span>
              </label>
            )}
          </div>
          <div className="availability">
            <CheckCircle2 size={16} />
            <span>
              선택 조건에서{" "}
              <strong>{Math.min(count, available.length)}문항</strong>을
              출제합니다.
              {count > available.length &&
                ` (가능한 문제 ${available.length}개)`}
            </span>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {progress.activeSession ? (
            <div className="active-session-box">
              <p>진행 중인 평가가 자동 저장되어 있어요.</p>
              <Link
                className="button primary full-width"
                to={`/assessment/${progress.activeSession.sessionId}`}
              >
                이어서 풀기 <ArrowRight size={17} />
              </Link>
              <button
                className="text-link"
                onClick={() => setConfirmDiscard(true)}
              >
                진행 중인 평가를 지우고 새로 시작
              </button>
            </div>
          ) : (
            <button
              className="button primary full-width start-button"
              disabled={!available.length}
              onClick={begin}
            >
              {mode === "learning" ? "학습 시작하기" : "모의평가 시작하기"}
              <ArrowRight size={18} />
            </button>
          )}
          <p className="setup-footnote">
            답안은 자동 저장되며 새로고침 후에도 이어 풀 수 있습니다.
          </p>
        </section>
      </div>
      {confirmDiscard && (
        <Dialog
          title="진행 중인 평가를 지울까요?"
          confirm="평가 지우기"
          destructive
          onClose={() => setConfirmDiscard(false)}
          onConfirm={() => {
            discard();
            setConfirmDiscard(false);
          }}
        >
          <p>
            현재 평가의 저장된 답안이 삭제됩니다. 제출 완료한 학습 기록은
            유지됩니다.
          </p>
        </Dialog>
      )}
    </>
  );
}
