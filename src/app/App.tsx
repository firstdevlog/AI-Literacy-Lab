import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { HashRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider } from "./AppProvider";
import { Layout } from "../components/Layout";
import { Dashboard } from "../pages/Dashboard";
import { StageIntro } from "../pages/StageIntro";
import { Assessment } from "../pages/Assessment";
import { Results } from "../pages/Results";
import { History } from "../pages/History";
import { Review } from "../pages/Review";
import { EmptyState } from "../components/ui";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("앱 초기화 실패", error.message, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <main className="fatal-error">
        <h1>앱을 불러오지 못했습니다</h1>
        <p>
          문제 데이터나 초기화 설정을 확인해 주세요. 브라우저의 학습 기록을
          지우지 않고 다시 시도할 수 있습니다.
        </p>
        <p>{this.state.error}</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          다시 불러오기
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function RouteFocus() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.getElementById("main");
    main?.focus({ preventScroll: true });
  }, [location.pathname]);
  return null;
}
export function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppProvider>
          <RouteFocus />
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="stage/1" element={<StageIntro />} />
              <Route path="assessment/:sessionId" element={<Assessment />} />
              <Route path="results/:sessionId" element={<Results />} />
              <Route path="history" element={<History />} />
              <Route path="review" element={<Review />} />
              <Route
                path="*"
                element={
                  <EmptyState
                    title="페이지를 찾을 수 없어요"
                    action={
                      <Link className="button primary" to="/">
                        대시보드로
                      </Link>
                    }
                  >
                    주소를 확인하거나 대시보드에서 다시 시작해 주세요.
                  </EmptyState>
                }
              />
            </Route>
          </Routes>
        </AppProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
