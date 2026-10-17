import { formatDate } from "../lib/format";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCheck,
  Clock3,
  Flag,
  Layers3,
  Play,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../app/context";
import { learningAnalyticsService } from "../infrastructure/services";
import { EmptyState, Score, StartLink } from "../components/ui";

export function Dashboard() {
  const { progress, questions } = useApp();
  const analytics = learningAnalyticsService.summarize(progress.results);
  const recent = [...progress.results]
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 3);
  return (
    <>
      <div className="dashboard-welcome">
        <span>오늘도 한 걸음, AI와 더 가까워지세요.</span>
        <span className="date-label">LEARN · PRACTICE · GROW</span>
      </div>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="hero-pill">
            <span /> YOUR AI LEARNING JOURNEY
          </span>
          <h1 id="hero-title">
            AI를 이해하는 힘,
            <br />
            <em>직접 풀며</em> 키워보세요.
          </h1>
          <p>
            개념을 아는 것에서, 제대로 활용하는 것으로.
            <br />
            단계별 평가와 맞춤 복습으로 나만의 AI 역량을 완성하세요.
          </p>
          <div className="hero-actions">
            <StartLink>내 AI 역량 알아보기</StartLink>
            <span>
              <Check size={15} /> 무료 · 가입 없이 시작
            </span>
          </div>
          <div className="hero-footnote">
            <span>
              <BookOpen size={15} />
              {questions.filter((q) => q.status === "published").length}개
              독창적 문항
            </span>
            <span>
              <Layers3 size={15} />
              8개 핵심 영역
            </span>
            <span>
              <Clock3 size={15} />내 속도에 맞춘 학습
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="visual-spark spark-one">✦</span>
          <span className="visual-spark spark-two">✧</span>
          <div className="visual-central">
            <BrainCircuit size={61} strokeWidth={1.3} />
          </div>
          <div className="floating-note note-top">
            <span className="mini-icon indigo">
              <Sparkles size={18} />
            </span>
            <div>
              <small>작은 배움이 쌓이면</small>
              <strong>가능성은 더 커집니다</strong>
            </div>
          </div>
          <div className="floating-note note-bottom">
            <span className="mini-icon green">
              <CheckCheck size={19} />
            </span>
            <div>
              <strong>Learn. Apply. Evolve.</strong>
              <small>나만의 AI 성장 루틴</small>
            </div>
          </div>
          <span className="visual-dot dot-one" />
          <span className="visual-dot dot-two" />
        </div>
      </section>
      {progress.activeSession && (
        <div className="resume-banner">
          <div>
            <Play size={20} />
            <span>
              <strong>풀고 있던 평가가 있어요.</strong> 저장된 답안부터 이어서
              시작하세요.
            </span>
          </div>
          <Link
            className="text-link"
            to={`/assessment/${progress.activeSession.sessionId}`}
          >
            이어서 풀기 <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <section className="stat-grid" aria-label="나의 학습 현황">
        <Stat
          icon={<Flag size={19} />}
          label="누적 응시"
          value={
            <>
              {analytics.attemptCount}
              <small>회</small>
            </>
          }
        />
        <Stat
          icon={<Target size={19} />}
          label="최근 점수"
          value={<Score value={analytics.latestScore} />}
        />
        <Stat
          icon={<Trophy size={19} />}
          label="최고 점수"
          value={<Score value={analytics.bestScore} />}
        />
        <Stat
          icon={<BrainCircuit size={19} />}
          label="평균 점수"
          value={<Score value={analytics.averageScore} />}
        />
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">STEP BY STEP</span>
            <h2>나에게 맞는 단계부터 시작하세요</h2>
            <p>
              기초 이해부터 전문적인 문제 해결까지, 차근차근 성장하는 3단계 여정
            </p>
          </div>
          <span className="section-label">AI 역량평가</span>
        </div>
        <div className="stage-grid">
          <article className="stage-card stage-active">
            <div className="stage-card-top">
              <span className="stage-number">01</span>
              <span className="status-pill available">
                <span /> 학습 가능
              </span>
            </div>
            <span className="stage-icon indigo">
              <BookOpen size={26} />
            </span>
            <div className="stage-label">STAGE 1 · KNOWLEDGE</div>
            <h3>AI 지식평가</h3>
            <p>
              AI 기본 개념부터 활용 원칙까지.
              <br />
              처음이라면 여기서 시작하세요.
            </p>
            <div className="stage-tags">
              <span>객관식</span>
              <span>기초 · 실무</span>
              <span>자동 채점</span>
            </div>
            <div className="stage-card-bottom">
              <span>
                {questions.filter((q) => q.status === "published").length}문항의
                문제은행
              </span>
              <Link to="/stage/1" className="stage-cta">
                학습 시작 <ArrowRight size={18} />
              </Link>
            </div>
          </article>
          <article className="stage-card">
            <div className="stage-card-top">
              <span className="stage-number">02</span>
              <span className="status-pill">Coming Soon</span>
            </div>
            <span className="stage-icon violet">
              <Sparkles size={26} />
            </span>
            <div className="stage-label">STAGE 2 · APPLICATION</div>
            <h3>AI 활용평가</h3>
            <p>
              AI Assist와 함께 실제 업무와
              <br />
              유사한 과제를 해결하는 실전형 평가
            </p>
            <div className="stage-tags">
              <span>실무 시나리오</span>
              <span>프롬프트 활용</span>
            </div>
            <div className="stage-card-bottom">
              <span>배운 개념을 실제 업무로</span>
              <button className="soon-button" disabled>
                준비 중
              </button>
            </div>
          </article>
          <article className="stage-card">
            <div className="stage-card-top">
              <span className="stage-number">03</span>
              <span className="status-pill">Coming Soon</span>
            </div>
            <span className="stage-icon amber">
              <Layers3 size={26} />
            </span>
            <div className="stage-label">STAGE 3 · EXPERTISE</div>
            <h3>AI 전문평가</h3>
            <p>
              복잡한 개발과 업무 문제를
              <br />
              서술형으로 해결하는 고난도 전문 평가
            </p>
            <div className="stage-tags">
              <span>심화 문제 해결</span>
              <span>서술형</span>
            </div>
            <div className="stage-card-bottom">
              <span>깊이 있는 사고와 설계</span>
              <button className="soon-button" disabled>
                준비 중
              </button>
            </div>
          </article>
        </div>
      </section>
      <div className="dashboard-bottom">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <h2>
              최근 학습 기록{" "}
              <span className="count-badge">{progress.results.length}</span>
            </h2>
            <Link className="text-link subtle" to="/history">
              전체 보기 <ArrowUpRight size={15} />
            </Link>
          </div>
          {recent.length ? (
            <div className="recent-list">
              {recent.map((r) => (
                <Link
                  className="recent-item"
                  key={r.sessionId}
                  to={`/results/${r.sessionId}`}
                >
                  <span className="record-icon">
                    <BookOpen size={21} />
                  </span>
                  <div>
                    <strong>
                      AI 지식평가{" "}
                      <span>
                        {r.mode === "learning" ? "학습 모드" : "모의평가"}
                      </span>
                    </strong>
                    <small>
                      {formatDate(r.submittedAt)} · {r.totalQuestions}문항
                    </small>
                  </div>
                  <b>
                    {r.score}
                    <small>점</small>
                  </b>
                  <ArrowRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="첫 번째 성장을 기록해 보세요"
              action={
                <Link className="text-link" to="/stage/1">
                  첫 학습 시작하기 <ArrowRight size={15} />
                </Link>
              }
            >
              평가를 마치면 나의 학습 여정이 이곳에 쌓여요.
            </EmptyState>
          )}
        </section>
        <aside className="review-promo">
          <span className="eyebrow">A LITTLE BETTER, EVERY DAY</span>
          <span className="review-illustration">
            <BrainCircuit size={33} />
            <span>↻</span>
          </span>
          <h2>
            틀린 문제도,
            <br />내 실력이 되는 순간.
          </h2>
          <p>
            오답 해설을 확인하고 즐겨찾기로 모아보세요.
            <br />
            반복할수록 개념이 더 단단해집니다.
          </p>
          <Link className="text-link" to="/review">
            나의 복습 노트 <ArrowRight size={17} />
          </Link>
        </aside>
      </div>
    </>
  );
}
function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <article className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
