import { formatDate, formatDuration } from "../lib/format";
import { useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, Download, FileUp, Info, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../app/context";
import {
  learningAnalyticsService,
  progressRepository,
} from "../infrastructure/services";
import { CATEGORY_LABELS } from "../domain/types";
import { Dialog } from "../components/Dialog";
import { EmptyState, PageHeading, Score, StartLink } from "../components/ui";

export function History() {
  const { progress, importBackup } = useApp();
  const analytics = learningAnalyticsService.summarize(progress.results);
  const input = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function download() {
    try {
      const blob = new Blob([progressRepository.exportData()], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-literacy-lab-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("학습 기록 백업을 내보냈습니다.");
    } catch {
      setError("백업 파일을 내보내지 못했습니다. 다시 시도해 주세요.");
    }
  }
  async function readBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    if (file.size > 20 * 1024 * 1024) {
      setError("20MB 이하의 JSON 백업 파일을 선택해 주세요.");
      return;
    }
    try {
      setPendingBackup(await file.text());
    } catch {
      setError("파일을 읽을 수 없습니다.");
    }
  }
  function restore() {
    if (pendingBackup === null) return;
    try {
      importBackup(pendingBackup);
      setMessage("백업에서 학습 기록을 복원했습니다.");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "백업을 가져올 수 없습니다.");
    }
    setPendingBackup(null);
  }
  const results = [...progress.results].sort(
    (a, b) => b.submittedAt - a.submittedAt,
  );
  return (
    <>
      <PageHeading
        eyebrow="MY LEARNING JOURNEY"
        title="학습 기록"
        action={
          <div className="heading-actions">
            <button className="button secondary" onClick={download}>
              <Download size={16} />
              내보내기
            </button>
            <button
              className="button secondary"
              onClick={() => input.current?.click()}
            >
              <FileUp size={16} />
              가져오기
            </button>
            <input
              type="file"
              accept=".json,application/json"
              ref={input}
              className="sr-only"
              aria-label="학습 기록 백업 파일"
              onChange={readBackup}
            />
          </div>
        }
      >
        <p>한 번의 도전도 놓치지 않고, 나의 성장을 돌아보세요.</p>
      </PageHeading>
      <div className="data-notice">
        <Info size={20} />
        <div>
          <strong>내 기록은 내 브라우저에.</strong>
          <p>
            회원가입이나 개인정보 수집 없이 이 브라우저에만 저장합니다. 다른
            기기와 자동 동기화되지 않으며, 브라우저 저장소를 삭제하면 사라질 수
            있습니다. JSON 백업을 내보내 안전하게 보관하세요.
          </p>
        </div>
      </div>
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="history-stats">
        <div className="panel">
          <span>누적 응시 횟수</span>
          <strong>
            {analytics.attemptCount}
            <small>회</small>
          </strong>
        </div>
        <div className="panel">
          <span>최근 점수</span>
          <strong>
            <Score value={analytics.latestScore} />
          </strong>
        </div>
        <div className="panel">
          <span>최고 점수</span>
          <strong>
            <Score value={analytics.bestScore} />
          </strong>
        </div>
        <div className="panel">
          <span>평균 점수</span>
          <strong>
            <Score value={analytics.averageScore} />
          </strong>
        </div>
      </div>
      <section className="panel area-panel">
        <div className="panel-heading">
          <h2>
            <Target size={20} /> 영역별 학습 진단
          </h2>
          <span className="muted tiny">전체 응시의 누적 정답률</span>
        </div>
        {analytics.categoryResults.length ? (
          <div className="area-grid">
            {[...analytics.categoryResults]
              .sort((a, b) => a.accuracy - b.accuracy)
              .map((c) => (
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
                    aria-label={`${CATEGORY_LABELS[c.category]} 누적 정답률`}
                  />
                  {c.accuracy < 60 && (
                    <small className="weak-label">
                      한 번 더 복습하면 좋아요
                    </small>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <EmptyState title="아직 분석할 기록이 없어요">
            첫 평가를 완료하면 영역별 강점과 취약도를 확인할 수 있어요.
          </EmptyState>
        )}
      </section>
      <section className="panel history-panel">
        <div className="panel-heading">
          <h2>
            전체 응시 이력 <span className="count-badge">{results.length}</span>
          </h2>
        </div>
        {results.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>평가</th>
                  <th>응시일</th>
                  <th>점수</th>
                  <th>정답</th>
                  <th>소요 시간</th>
                  <th>
                    <span className="sr-only">결과</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.sessionId}>
                    <td>
                      <strong>AI 지식평가</strong>
                      <small>
                        {r.mode === "learning" ? "학습 모드" : "모의평가"}
                      </small>
                    </td>
                    <td>{formatDate(r.submittedAt)}</td>
                    <td className="table-score">{r.score}점</td>
                    <td>
                      {r.correctCount}/{r.totalQuestions}
                    </td>
                    <td>{formatDuration(r.durationSeconds)}</td>
                    <td>
                      <Link
                        className="text-link"
                        to={`/results/${r.sessionId}`}
                        aria-label={`${formatDate(r.submittedAt)} 평가 결과 보기`}
                      >
                        결과 보기 <ArrowRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="아직 응시한 평가가 없어요" action={<StartLink />}>
            첫 번째 학습을 시작하고 나만의 성장 기록을 만들어보세요.
          </EmptyState>
        )}
      </section>
      {pendingBackup !== null && (
        <Dialog
          title="백업에서 기록을 복원할까요?"
          confirm="가져오기 확정"
          onClose={() => setPendingBackup(null)}
          onConfirm={restore}
        >
          <p>
            가져온 파일로 현재 응시 이력, 즐겨찾기, 진행 중인 평가를 모두
            교체합니다. 먼저 현재 기록을 내보내 두는 것을 권장합니다.
          </p>
          <p>올바르지 않은 파일은 가져오지 않으며 기존 기록을 유지합니다.</p>
        </Dialog>
      )}
    </>
  );
}
