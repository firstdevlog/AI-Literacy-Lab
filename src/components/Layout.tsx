import {
  FlaskConical,
  LayoutDashboard,
  ChartNoAxesCombined,
  Bookmark,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { useApp } from "../app/context";

export function Layout() {
  const { warning } = useApp();
  return (
    <div className="app-shell">
      <a
        href="#main"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView({ block: "start" });
        }}
      >
        본문으로 건너뛰기
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="AI Literacy Lab 홈">
            <span className="brand-mark">
              <FlaskConical size={23} />
            </span>
            <span>
              AI Literacy<span className="brand-light"> Lab</span>
              <small>배움이 실력이 되는 곳</small>
            </span>
          </Link>
          <nav aria-label="주요 메뉴">
            <NavLink to="/" end>
              <LayoutDashboard size={17} />
              <span>대시보드</span>
            </NavLink>
            <NavLink to="/history">
              <ChartNoAxesCombined size={17} />
              <span>학습 기록</span>
            </NavLink>
            <NavLink to="/review">
              <Bookmark size={17} />
              <span>복습 노트</span>
            </NavLink>
          </nav>
          <span className="local-badge">
            <span />
            나만의 학습 공간
          </span>
        </div>
      </header>
      {warning && (
        <div className="storage-warning" role="status">
          {warning}
        </div>
      )}
      <main id="main" className="main-container" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div>
          <Link to="/" className="footer-brand">
            <FlaskConical size={17} /> AI Literacy Lab
          </Link>
          <p>AI를 이해하고, 더 나은 가능성을 만듭니다.</p>
        </div>
        <p>
          <ShieldCheck size={15} /> 학습 기록은 이 브라우저에만 저장됩니다.
          <br />
          <Link to="/history">
            기록 백업 및 저장 안내 <ArrowUpRight size={13} />
          </Link>
        </p>
        <span>© {new Date().getFullYear()} AI Literacy Lab</span>
      </footer>
    </div>
  );
}
