# AI Literacy Lab

AI 기본 개념부터 실무 활용 원칙까지 한국어로 학습하는 개인용 AI 역량평가 플랫폼입니다. Stage 1은 문제 풀이·자동 채점·오답 복습·학습 기록을 제공하며 Stage 2·3은 준비 중입니다.

## 개발 실행

Node.js 22.12 이상과 npm을 사용합니다. 의존성 버전은 `package-lock.json`으로 고정합니다.

```bash
npm ci
npm run dev
```

터미널에 표시되는 주소의 `/AI-Literacy-Lab/` 경로로 접속합니다. 별도 API 서버, 데이터베이스, 로그인, 환경변수 또는 API 키가 필요하지 않습니다.

```bash
npm run lint
npm run questions:validate
npm run test
npm run build
npm run preview
```

브라우저 E2E 테스트는 처음 한 번 공식 Playwright 브라우저를 설치한 뒤 실행합니다. Linux에서 시스템 패키지 설치 권한이 있는 환경은 `--with-deps`를 사용합니다.

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm run build`는 TypeScript 검사와 Vite 빌드를 수행하고 `dist/`를 만듭니다. `npm run preview`는 이 산출물을 로컬에서 확인하는 서버입니다.

2026-10-17 클라우드 환경(Node.js 24.19.0)에서 `npm ci`, lint, 문항 검증, 단위·통합 테스트 **54개**, Chromium E2E **17개**, TypeScript·Vite 빌드가 통과했습니다. 375·768·1440px 화면과 키보드 답안 선택을 확인했고, 실제 빌드의 base 경로 JS·CSS 응답, 학습→제출→결과와 해시 경로 새로고침도 로컬 preview에서 확인했습니다. Axe의 7개 화면 상태 자동 검사에는 위반이 없었으며 수동 접근성 전체 인증을 의미하지 않습니다. [상세 검증 기록과 변경 파일 목록](docs/IMPLEMENTATION_PLAN.md)을 참조하세요.

## 학습 방법

- **학습 모드:** 기본 10문항, 시간 제한 없음. 영역·난이도를 선택하고 문항별 정답과 해설을 즉시 확인할 수 있습니다.
- **모의평가:** 기본 20문항, 기본 25분. 시간 제한을 해제할 수 있으며 제출 전 해설은 표시하지 않습니다. 25분은 이 서비스 자체 설정입니다.
- 문제와 선택지는 섞어서 출제하며 새로고침해도 같은 응시의 배열·답안·남은 시간이 유지됩니다. 선택 조건에 맞는 문제가 부족하면 실제 가능한 문항 수로 시작합니다.
- 결과에서 점수, 정답·오답·미응답, 영역별 정답률, 문항별 해설을 확인합니다. 오답 또는 즐겨찾기 문항으로 다시 학습할 수 있습니다.
- 학습 기록 화면에서 누적 응시, 최근·최고·평균 점수와 취약 영역을 확인하고 개인 기록을 JSON으로 내보내거나 가져올 수 있습니다.

총점은 **정답 수 ÷ 전체 문항 수 × 100**이며 소수점 한 자리로 반올림합니다. 정답률도 동일한 분모를 사용합니다. 미응답은 점수에서 0점 처리하며 화면에는 답을 선택했지만 틀린 문항과 미응답을 구분합니다. 제출 결과는 응시 당시의 문항·선택지·버전을 함께 보관합니다.

## 문제은행과 문항 추가

최초 문제은행은 독창적으로 작성한 **64문항**으로 구성합니다. 8개 영역마다 8문항이며 영역별 초급 3·중급 3·고급 2문항입니다.

| 영역 ID        | 영역                | 문항 수 |
| -------------- | ------------------- | ------: |
| `fundamentals` | AI 기본 개념        |       8 |
| `generative`   | 생성형 AI 및 LLM    |       8 |
| `prompting`    | 프롬프트 엔지니어링 |       8 |
| `verification` | AI 출력 검증        |       8 |
| `responsible`  | Responsible AI      |       8 |
| `security`     | 정보보안과 개인정보 |       8 |
| `productivity` | 업무 활용 및 생산성 |       8 |
| `systems`      | AI 시스템 활용 개념 |       8 |

허가된 JSON·JSONL·Markdown 문항을 다음과 같이 가져옵니다. 전체 스키마, 예제, 검토 기준은 [문항 작성 안내](docs/QUESTION_AUTHORING.md)를 확인하세요.

```bash
npm run questions:import -- /path/to/my-questions.json
npm run questions:validate
npm run test
npm run build
```

검증된 JSON 파일이 `src/data/questions/`에 추가되면 UI 코드를 바꾸지 않고 문제은행에 포함됩니다. `status: "review"` 문항은 검증 대상이지만 출제 대상에서는 제외됩니다. 임포트는 기존 파일 및 문항 ID를 덮어쓰지 않습니다. 문항 임포트와 브라우저의 **개인 학습 기록 가져오기**는 서로 다른 기능입니다.

## 데이터 저장과 한계

이 서비스는 GitHub Pages에서 실행되는 Static SPA입니다. 학습 이력과 진행 중 응시는 현재 브라우저의 `localStorage`에 저장됩니다. 회원가입, 개인정보 수집, 외부 추적 분석, 기기 간 자동 동기화는 제공하지 않습니다. 다른 브라우저·기기로 옮기기 전에는 학습 기록을 JSON으로 내보내세요. 브라우저 데이터 삭제 또는 저장 공간 정책으로 기록이 사라질 수 있습니다.

학습 기록 가져오기는 유효성을 검사한 뒤 **현재 기록을 가져온 내용으로 교체**합니다. 필요한 현재 기록을 먼저 내보내세요. 손상되거나 지원하지 않는 저장 형식은 경고와 빈 상태로 복구하고 가능한 경우 원본을 로컬 격리 키에 보존합니다. 저장소를 쓸 수 없으면 현재 탭의 메모리에서 계속 동작하지만 새로고침 후 보존을 보장할 수 없습니다.

같은 브라우저의 여러 탭에서 동시에 기록을 수정하면 마지막 저장이 우선할 수 있으므로 응시는 한 탭에서 진행하는 것을 권장합니다.

정답과 해설은 공개 브라우저 번들에 포함됩니다. 개인 학습용이며 공식 시험의 부정행위 방지, 성적 인증 또는 보안 채점을 보장하지 않습니다. 점수는 이 서비스에서 푼 기록만 사용하며 전체 응시자 평균·순위·백분위는 만들지 않습니다.

## GitHub Pages 배포

서비스 주소는 <https://firstdevlog.github.io/AI-Literacy-Lab/>입니다. Vite `base`는 `/AI-Literacy-Lab/`이며 `HashRouter`를 사용해 `/AI-Literacy-Lab/#/stage/1` 같은 해시 경로의 새로고침을 지원합니다.

1. 배포 작업은 기존 Pages 사이트의 Source를 **GitHub Actions**로 맞춥니다. 저장소 정책으로 이 변경이 거부되면 관리자가 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택해야 합니다.
2. 변경을 `main`에 병합하거나 **Actions → Deploy GitHub Pages → Run workflow**에서 `main`을 선택합니다.
3. 품질 검사와 Chromium E2E가 성공하면 `dist/` Pages artifact를 배포합니다.
4. Actions의 `github-pages` 환경 링크를 열어 CSS·JS 로드, Stage 1 진입, 해시 경로 새로고침, 응시·제출·기록 저장을 확인합니다.

PR와 `main` 외 브랜치에서는 CI만 실행합니다. Pages 배포 작업만 `pages: write`, `id-token: write` 권한을 사용하며 개인 토큰은 필요하지 않습니다. 조직의 Actions 정책, Pages 사용 제한 또는 보호된 환경 승인은 저장소 관리자의 설정이 필요할 수 있습니다. **워크플로 파일이 존재하는 사실만으로 실제 원격 배포가 완료된 것은 아닙니다.**

2026-10-18(한국시간), 검증된 `57652b9`를 `main`에 일반 fast-forward 방식으로 반영했고 [GitHub Pages 배포 #1](https://github.com/firstdevlog/AI-Literacy-Lab/actions/runs/39047085343)에서 빌드·Chromium E2E·Pages 게시가 모두 성공한 것을 공개 Actions 화면으로 확인했습니다. PR 생성 API는 `Forbidden`으로 차단되어 PR은 생성하지 않았습니다. 강제 전송은 사용하지 않았습니다.

현재 클라우드의 `api.github.com` 및 `firstdevlog.github.io` 직접 요청은 계속 네트워크 정책으로 차단됩니다. 따라서 실제 공개 URL에서의 CSS·JS와 브라우저 동작을 이 환경에서 직접 확인한 것으로 주장하지 않습니다. 동일 산출물의 로컬 프로덕션 검증과 GitHub의 게시 성공은 확인했습니다. 재사용 설치·시작 안내와 두 도메인 허용은 환경 초안에 저장되어 있으며, 이 초안의 적용·게시는 Pages 배포와 별개입니다.

최초 배포에서 기존 브랜치 기반 Pages 작업과 Vite 작업이 함께 실행되는 것을 발견했습니다. 이후 배포는 GitHub Actions를 Source로 선택한 뒤 `dist/`를 게시하도록 구성해 원본 HTML이 다시 배포되는 경합을 방지합니다.

## 구조와 확장

React·TypeScript strict·Vite·Tailwind CSS·React Router·Lucide React를 사용합니다. 순수 TypeScript 도메인 로직과 로컬 어댑터를 UI에서 분리하고 Vitest·Testing Library·Playwright로 검증합니다.

- [아키텍처 및 Stage 2·3 확장](docs/ARCHITECTURE.md)
- [문항 작성·검증·임포트](docs/QUESTION_AUTHORING.md)
- [샘플 접근 확인 및 벤치마크 범위](docs/BENCHMARK_NOTES.md)
- [구현 계획·완료 조건·검증 기록](docs/IMPLEMENTATION_PLAN.md)

향후 AI Assist 키는 브라우저에 넣지 않습니다. 인증·비밀키·사용량 제한·비공개 채점은 별도 서버에서 처리하도록 확장합니다.
