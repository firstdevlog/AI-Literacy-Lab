# Stage 1 구현 계획과 검증 기록

## 범위와 완료 원칙

Stage 1을 실제 문제 풀이·자동 채점·복습·로컬 이력까지 제공하는 정적 SPA로 완성합니다. Stage 2·3은 준비 중 카드와 확장 지점만 제공합니다. 유료 인프라, 실제 AI API, 회원가입은 만들지 않습니다. 기존 체크아웃을 사용하고 기존 사용자 변경을 보존합니다.

체크 표시는 구현 상태를 뜻하며 자동화 테스트 성공이나 실제 운영 배포는 별도의 검증 기록이 있을 때만 완료로 인정합니다.

## Phase A — 현황 분석

- [x] 기존 파일·브랜치·의존성 확인: 기존 추적 파일은 `README.md`, 독립형 `index.html`; 프런트엔드 빌드·테스트 설정 없음.
- [x] 정적 GitHub Pages 제약 확인: Node 서버를 배포하지 않고 Vite `dist/` 배포, `/AI-Literacy-Lab/` base 및 해시 라우팅 사용.
- [x] 샘플 URL 접근 시도와 미확인 범위 문서화: [벤치마크 기록](BENCHMARK_NOTES.md).
- [x] 기능별 작업 분할, 도메인·어댑터 경계 및 단계별 완료 조건 기록.

완료 조건: 기존 상태와 배포 제약을 확인하고 원본을 보지 못한 사실을 명확하게 기록한다.

## Phase B — 프런트엔드 기반

- [x] React·TypeScript strict·Vite·Tailwind CSS와 npm lockfile 구성.
- [x] 해시 라우팅, 공통 네비게이션·버튼·상태·다이얼로그 구성.
- [x] 대시보드, Stage 1 소개, 준비 중 Stage 2·3 표시.
- [x] 모바일·태블릿·데스크톱 레이아웃과 키보드·포커스·레이블 구성.

완료 조건: 잘못된 경로는 복구할 수 있고 Stage 2·3에서 존재하지 않는 평가를 시작하지 않는다. 375px 화면에 가로 넘침이 없다.

## Phase C — 평가 엔진

- [x] 엄격한 문제 모델과 스키마 검증, 8영역·64문항 원본 은행 준비.
- [x] 학습 10문항·모의평가 20문항의 균형 출제, 문제·선택지 셔플 및 직전 중복 완화.
- [x] 진행 세션 고정 저장, 답안 자동 저장, 새로고침 이어 풀기.
- [x] 순수 채점 함수, 미응답 처리, 영역별 집계, 문항 버전 스냅샷.
- [x] 제한시간 25분·시간 제한 해제·만료 자동 제출·중복 제출 방지.

완료 조건: 필터 결과가 비거나 부족해도 무한 루프가 없고, 동일 응시는 새로고침 후 배열을 유지한다. 제출 결과는 이후 문항 수정에 영향받지 않는다.

## Phase D — 학습 기능

- [x] 결과·정답·오답·미응답·문항별 정답/오답 해설.
- [x] 오답 복습, 즐겨찾기 복습, 재응시.
- [x] 실제 로컬 기록의 최근·최고·평균 점수, 영역별 취약도와 반복 오답.
- [x] 진행 중 세션·제출 이력 분리, 손상/구버전 데이터 복구·저장 실패 경고.
- [x] 개인 학습 기록 JSON 내보내기·검증 후 가져오기.
- [x] 문항 JSON·JSONL·Markdown 임포트 및 통합 검증 명령.

완료 조건: 빈 기록과 저장 실패를 UI에서 설명하고 가져오기 오류는 기존 기록을 보존한다. 실제 서버가 없는 통계를 만들어 표시하지 않는다.

## Phase E — 검증과 배포 준비

- [x] 데이터·출제·채점·세션·저장소·가져오기 예외의 유닛/통합 테스트.
- [x] Chromium E2E로 대시보드→학습/모의평가→새로고침→제출→결과→복습·기록 검증.
- [x] 반응형 화면·가로 넘침·키보드 동작·포커스·레이블 점검.
- [x] PR/브랜치 CI와 main용 Pages 배포 워크플로 작성.
- [x] README·아키텍처·문항 작성·벤치마크 범위 문서 작성.
- [x] `npm ci`, lint, 문항 검증, unit/integration test, build, E2E 실제 실행 결과 기록.
- [x] 기존 HTTPS Git 인증으로 `main` 읽기 작업 성공 확인.
- [x] `feat/stage-one-platform` 기능 브랜치 원격 푸시 성공: 구현 커밋 `4739a3c`.
- [ ] 원격 PR 생성: `gh pr create`가 `api.github.com/graphql`의 `Forbidden`으로 실패, PR 미생성.
- [ ] 원격 Pages 배포 및 목표 URL 검증: `firstdevlog.github.io` 요청이 프록시 `CONNECT 403`으로 차단되어 미확인.

완료 조건: 자동화 검증 결과를 있는 그대로 기록한다. 배포가 가능한 경우 원격 URL에서 assets와 응시 흐름을 확인하고, 불가능하면 코드·워크플로 및 필요한 마지막 관리자 설정을 구체적으로 남긴다.

## 검증 실행 기록

2026-10-17 클라우드 실행 환경의 Node.js **24.19.0**에서 아래 명령을 실제 실행했습니다. 프로젝트 요구 버전은 Node.js 22.12 이상이며 CI는 Node.js 22를 사용합니다.

| 항목 | 실제 결과 | 확인 범위 |
| --- | --- | --- |
| `npm ci` | 성공, exit 0 | 커밋할 lockfile에 따른 설치 |
| `npm run questions:validate` | 성공 | 64문항, 8개 영역 각 8문항, 초급 24·중급 24·고급 16 |
| `npm run lint` | 성공, exit 0 | ESLint, 경고 허용 0 |
| `npm run test` | **54개 통과** | 도메인 35·저장 어댑터 16·React UI 통합 3 |
| `npm run build` | 성공, **3.57초** | TypeScript와 Vite, JS 489.22KB·CSS 48.44KB 산출물 |
| `npm run test:e2e` | **17개 통과, 23.8초** | Chromium 사용자 흐름 16개와 접근성 시나리오 1개 |
| 반응형·키보드 | 확인 | 375·768·1440px 대시보드/응시 화면 가로 넘침 없음, 키보드 답안 선택·포커스 |
| 프로덕션 preview | 확인 | 4273 포트의 실제 `dist/`, base 경로 JS/CSS HTTP 200 및 올바른 MIME, 5문항 학습의 선택→제출→결과, 해시 경로 새로고침, 페이지 오류 없음 |
| 워크플로·문서 | 확인 | CI/Pages YAML 파싱, 문서 로컬 링크 누락 없음 |
| GitHub 저장소 읽기 | 성공 | 기존 HTTPS Git 설정으로 원격 `main` 읽기 |
| GitHub 기능 브랜치 전송 | 성공 | 구현 커밋 `4739a3c`, `origin/feat/stage-one-platform` 생성 |
| GitHub API·PR 생성 | **차단 / 미생성** | 실제 `gh pr create` 요청이 `api.github.com/graphql`에서 `Forbidden`으로 실패 |
| Pages 실제 원격 배포 | **미실행·미확인** | 목표 주소 요청이 환경 정책의 `CONNECT 403`으로 차단됨 |

최종 화면 다듬기 후 lint, React UI 통합 3개, 빌드와 전체 Chromium 17개를 다시 실행해 모두 통과했습니다. 앞선 전체 단위·통합 54개 통과 이후의 재검증이며 별도 테스트 개수를 중복 합산하지 않습니다.

E2E에는 학습·모의평가, 고정 출제 배열과 새로고침, 제한시간 만료, 미응답 제출, 중복 제출, 뒤로 가기, 복습·즐겨찾기·재응시, 백업 실패·복원, 손상/구버전 저장 데이터 복구가 포함됩니다. 빈 문제은행·부족한 문항·잘못된 스키마·계산 정합성은 단위 및 통합 테스트에서도 다룹니다.

Axe는 대시보드·소개·해설을 연 응시·제출 다이얼로그·결과·이력·복습 **7개 화면 상태**에 WCAG A/AA 관련 자동 규칙을 적용해 위반 0건을 확인했습니다. 본문 건너뛰기가 해시 라우트를 훼손하지 않는 회귀 테스트도 통과했습니다. 자동 검사는 수동 스크린리더 평가나 WCAG 2.2 AA 전체 적합성 인증을 대신하지 않습니다.

프로덕션 preview 검증은 로컬 빌드 산출물에 대한 증거입니다. GitHub Pages의 실제 서버·배포 성공을 확인한 결과로 취급하지 않습니다. `https://firstdevlog.github.io/AI-Literacy-Lab/`는 아직 검증되지 않은 **목표 URL**입니다.

## 제약과 설계 결정

- 샘플 URL은 환경 네트워크 정책으로 접근되지 않았습니다. 제한 우회 없이 독창적인 문제은행과 일반적인 평가 UX로 진행합니다.
- 브라우저가 정답을 보유하므로 개인 학습용입니다. 시험 보안·공식 인증을 보장하지 않습니다.
- `localStorage`는 브라우저별 저장소입니다. 복원 가능한 JSON 백업을 제공하며 기기 간 자동 동기화는 제공하지 않습니다.
- 이력 가져오기는 전체 검증 후 교체합니다. 가져오기 전 현재 기록을 백업하도록 안내합니다.
- GitHub Pages의 Source 설정과 조직 보호 정책은 저장소 권한에 따라 관리자가 설정해야 할 수 있습니다. 실제 배포가 확인되기 전에는 목표 URL을 운영 확인 URL로 보고하지 않습니다.

## 남은 원격 설정과 검증

1. 재사용 `install_script`·`start_skill`과 `api.github.com`, `firstdevlog.github.io` 네트워크 추가를 환경 초안에 저장했습니다. 초안은 `requires_publish: true`이며 현재 실행 인스턴스에 적용되거나 게시되지 않았습니다. 환경 설정에서 검토·저장/게시하고 실행 인스턴스에 반영한 뒤 차단된 요청을 다시 확인합니다.
2. 기능 브랜치는 GitHub에 전송했습니다. PR API 요청은 차단되어 PR은 생성되지 않았습니다. [GitHub에서 PR 생성](https://github.com/firstdevlog/AI-Literacy-Lab/pull/new/feat/stage-one-platform) 링크로 `main` 대상 PR을 만들거나 네트워크 변경 후 다시 생성합니다. main은 변경하지 않았으며 강제 전송하지 않았습니다.
3. 저장소 **Settings → Pages → Source: GitHub Actions**를 설정하고 PR 병합 후 main 워크플로 또는 main 대상 수동 배포를 실행합니다. 조직 보호 정책이 있으면 저장소 관리자가 필요한 승인을 처리합니다.
4. 실제 배포 환경 URL에서 CSS·JS·해시 경로 새로고침·문제 풀이·제출·기록 복원을 확인합니다.

## 변경·신규 파일 목록

기존 `README.md`, `index.html`을 수정했고 아래 나머지 파일은 신규입니다. 설치 산출물 `node_modules/`, 빌드 산출물 `dist/`, 테스트 산출물은 이 목록과 커밋에서 제외합니다.

- **기존 문서·엔트리 수정:** [README.md](../README.md), [index.html](../index.html)
- **빌드·개발 설정:** [.gitignore](../.gitignore), [package.json](../package.json), [package-lock.json](../package-lock.json), [tsconfig.json](../tsconfig.json), [vite.config.ts](../vite.config.ts), [eslint.config.js](../eslint.config.js), [playwright.config.ts](../playwright.config.ts)
- **앱·라우팅·상태:** [src/main.tsx](../src/main.tsx), [src/app/App.tsx](../src/app/App.tsx), [src/app/AppProvider.tsx](../src/app/AppProvider.tsx), [src/app/context.ts](../src/app/context.ts)
- **공통 UI·스타일·형식:** [src/components/Dialog.tsx](../src/components/Dialog.tsx), [src/components/Layout.tsx](../src/components/Layout.tsx), [src/components/ui.tsx](../src/components/ui.tsx), [src/styles/index.css](../src/styles/index.css), [src/lib/format.ts](../src/lib/format.ts)
- **화면:** [src/pages/Dashboard.tsx](../src/pages/Dashboard.tsx), [src/pages/StageIntro.tsx](../src/pages/StageIntro.tsx), [src/pages/Assessment.tsx](../src/pages/Assessment.tsx), [src/pages/Results.tsx](../src/pages/Results.tsx), [src/pages/History.tsx](../src/pages/History.tsx), [src/pages/Review.tsx](../src/pages/Review.tsx), [src/features/review/QuestionExplanation.tsx](../src/features/review/QuestionExplanation.tsx)
- **도메인:** [src/domain/types.ts](../src/domain/types.ts), [src/domain/index.ts](../src/domain/index.ts), [src/domain/validation.ts](../src/domain/validation.ts), [src/domain/assessment.ts](../src/domain/assessment.ts)
- **문제은행:** [src/data/questions/core.json](../src/data/questions/core.json), [src/data/questions/applied.json](../src/data/questions/applied.json)
- **저장·서비스 어댑터:** [src/infrastructure/progressRepository.ts](../src/infrastructure/progressRepository.ts), [src/infrastructure/services.ts](../src/infrastructure/services.ts)
- **임포트·검증:** [scripts/import-questions.ts](../scripts/import-questions.ts), [scripts/question-files.ts](../scripts/question-files.ts), [scripts/validate-questions.ts](../scripts/validate-questions.ts)
- **테스트:** [src/domain/assessment.test.ts](../src/domain/assessment.test.ts), [src/infrastructure/progressRepository.test.ts](../src/infrastructure/progressRepository.test.ts), [tests/app.test.tsx](../tests/app.test.tsx), [tests/setup.ts](../tests/setup.ts), [tests/e2e/assessment.spec.ts](../tests/e2e/assessment.spec.ts), [tests/e2e/accessibility.spec.ts](../tests/e2e/accessibility.spec.ts)
- **CI·배포:** [.github/workflows/ci.yml](../.github/workflows/ci.yml), [.github/workflows/pages.yml](../.github/workflows/pages.yml)
- **문서:** [docs/IMPLEMENTATION_PLAN.md](../docs/IMPLEMENTATION_PLAN.md), [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md), [docs/QUESTION_AUTHORING.md](../docs/QUESTION_AUTHORING.md), [docs/BENCHMARK_NOTES.md](../docs/BENCHMARK_NOTES.md)
