# Stock Hi/Lo Forecast Prototype (Next.js + MUI + Vercel Free) — PLAN.md

## 0) 프로젝트 목표 (MVP)
사용자가 주식 티커를 입력하면:
1) 최근 2~5년 일봉 데이터를 불러오고
2) 차트로 보여주며
3) 간단한 예측 모델로 향후 N거래일(5/20/60)의 "예상 저점/고점(범위)"를 제시한다.
4) 시스템 다크/라이트 설정을 자동 반영하고, 사용자가 토글로 직접 바꿀 수도 있게 한다.

주의: 투자 조언이 아닌 참고용. 예측은 통계적 범위(밴드)로 제공.

---

## 1) UX/IA 설계 (어렵지 않은 UI)
### 화면 구성
- 상단 AppBar
  - 좌측: 앱 이름 "Hi/Lo Forecast"
  - 우측: 테마 토글(라이트/다크), GitHub(선택)
- 메인 컨텐츠(1컬럼 중앙 정렬)
  1) 입력 카드
     - 티커 입력 TextField (예: AAPL)
     - 기간 선택 ToggleButtons: 2Y / 5Y
     - 예측기간 선택 ToggleButtons: 5D / 20D / 60D
     - 버튼: "분석"
  2) 결과 카드
     - 현재가/최근종가, 변동성(간단 지표), 데이터 기준일
     - 예상 범위: "예상 저점 ~ 예상 고점" (분위수 기반)
     - 신뢰도 힌트(데이터 길이, 최근 변동성 수준)
  3) 차트 카드
     - 가격 라인 + 예측 밴드(간단 표시)
  4) 하단 안내/면책 (Disclosure)
     - "투자 조언 아님" + 데이터 출처 + 지연/오류 가능성

### UX 원칙
- 입력 → 결과까지 1~2번 클릭
- 에러는 친절한 문장 + 해결 행동 안내
- 로딩 시 Skeleton + LinearProgress
- 모바일에서도 카드가 자연스럽게 쌓이도록

---

## 2) 기술 스택 / 제약
- Next.js 15+ (App Router), TypeScript
- MUI v5 (Emotion)
- 데이터: 무료 EOD(일봉) 소스 1개 사용 (프로토타입용)
  - 1차: Stooq CSV (제약이 있을 수 있어도 빠르게 MVP에 적합)
- 예측: 서버리스에서 가벼운 모델
  - "변동성 기반 밴드 + Monte Carlo(GBM)" 중 택1
  - MVP는 GBM Monte Carlo 추천 (저점/고점 범위 산출이 자연스러움)
- 배포: Vercel Free
- 비용: $0 (트래픽이 폭증하거나 데이터 소스가 막히면 변경 필요)

---

## 3) 폴더 구조 (권장)
/app
  /api
    /quotes/route.ts        # 데이터 가져오기 API
    /forecast/route.ts      # 예측 계산 API
  /layout.tsx               # MUI ThemeProvider + CSSBaseline + AppShell
  /page.tsx                 # 메인 페이지 UI
/components
  AppShell.tsx
  TickerForm.tsx
  ResultSummary.tsx
  PriceChart.tsx
  Disclosure.tsx
/lib
  dataSources.ts            # Stooq fetch + parsing
  indicators.ts             # 수익률/변동성 계산
  forecast.ts               # GBM Monte Carlo
  validate.ts               # ticker 검증
  types.ts
/theme
  createTheme.ts            # 라이트/다크 테마 정의
  colorMode.tsx             # 시스템 모드 감지 + 토글 state
/public
  favicon.ico
/README.md
/PLAN.md

---

## 4) 개발 단계별 체크리스트 (VSCode AI 작업 지시 포함)

### 단계 A — 프로젝트 생성 & MUI 세팅
#### A1. Next.js 프로젝트 생성
터미널:
- pnpm 사용 권장(없으면 npm도 OK)
1) `pnpm create next-app hi-lo-forecast --ts --eslint --app --src-dir --import-alias "@/*"`
2) `cd hi-lo-forecast`

#### A2. MUI 설치
- `pnpm add @mui/material @emotion/react @emotion/styled @mui/icons-material`
(차트 라이브러리는 1차에서 가벼운 걸 추천. 예: lightweight-charts)
- `pnpm add lightweight-charts`

#### A3. VSCode에서 AI에게 시킬 작업(프롬프트 예시)
- "MUI를 App Router에 맞게 ThemeProvider 구성하고, 시스템 다크/라이트 감지 + 토글을 지원하는 AppShell을 만들어줘."

완료 기준:
- 앱 실행 시 시스템 테마를 따라가고 토글로 변경 가능
- 새로고침해도 사용자 선택이 유지(localStorage)

---

### 단계 B — 테마/레이아웃(AppShell) 구축
#### B1. 구현 파일
- `/app/layout.tsx`
- `/components/AppShell.tsx`
- `/theme/colorMode.tsx`
- `/theme/createTheme.ts`

#### B2. 요구사항
- CssBaseline 적용
- AppBar에 ThemeToggle 아이콘 버튼
- Container maxWidth="md"
- Snackbar용 전역 알림(선택) 또는 페이지 단에서 처리

#### B3. AI 작업 지시(복붙용)
- "Next.js App Router용으로 MUI ThemeProvider, CssBaseline, AppBar, 테마 토글을 포함한 AppShell을 작성해줘. 시스템 다크/라이트를 기본값으로 사용하고, 사용자가 토글하면 localStorage에 저장해 다음 방문에도 유지되게 해줘. TypeScript로."

완료 기준:
- `pnpm dev` 실행 시 UI가 정상, 토글이 동작

---

### 단계 C — 데이터 API (/api/quotes)
#### C1. API 설계
- GET `/api/quotes?ticker=AAPL&range=2y`
- 응답:
```json
{
  "ticker":"AAPL",
  "currency":"USD",
  "source":"stooq",
  "range":"2y",
  "bars":[
    {"date":"2024-02-01","open":1,"high":1,"low":1,"close":1,"volume":123}
  ]
}

### 단계 D — 예측 API (/api/forecast)
#### D1. 예측 방식(추천: GBM Monte Carlo)

입력: close 가격 시계열
log return으로 drift(mu), volatility(sigma) 추정
N일 동안 M회 시뮬레이션
각 시뮬레이션 경로에서 (min, max) 추출
분위수(예: 10% ~ 90%)로 "예상 저점~고점 범위" 산출

#### D2. API 설계

POST /api/forecast

body:
{
  "ticker":"AAPL",
  "range":"2y",
  "horizon":20,
  "closes":[1,2,3,...],
  "dates":["2024-01-01",...]
}

response:
{
  "ticker":"AAPL",
  "horizon":20,
  "lastClose":123.45,
  "estimated": {
    "low": 115.2,
    "high": 132.8,
    "pLow": 0.10,
    "pHigh": 0.90
  },
  "sigmaDaily": 0.018,
  "simulations": 2000
}

### 단계 E — 메인 페이지 UI (입력/결과/차트)
#### E1. 메인 페이지 구성

/app/page.tsx에서 다음 컴포넌트를 조합:
<TickerForm />
<ResultSummary />
<PriceChart />
<Disclosure />

#### E2. 상태 흐름

폼 submit:
quotes fetch
forecast post

결과 렌더
로딩: Skeleton
에러: Alert + 재시도 버튼

### 단계 F — 차트(가볍게)
#### F1. 차트 요구

과거 close 라인
예측 범위(low/high)를 "수평 밴드"로 표시 (간단히)
가능하면 horizon 끝 지점에 밴드 표시

#### F2. 구현

lightweight-charts 사용 추천(가볍고 깔끔)
또는 MUI + SVG 간단 차트도 가능(하지만 구현 난이도↑)

### 단계 G — 품질/안정성/캐시
#### G1. 캐시
/api/quotes 응답에 Cache-Control 설정(짧게)
예: s-maxage=3600, stale-while-revalidate=86400
서버리스 호출 횟수 감소

#### G2. 입력 normalize
ticker trim, uppercase
.US 매핑
공백/특수문자 제거

#### G3. 기본 보안
API에서 과도한 range/horizon 제한
horizon: 5/20/60만 허용
range: 2y/5y만 허용

### 기타
README에 넣을 문구(면책/출처)

데이터 출처: Stooq (EOD, 지연 가능)

면책: "본 서비스는 교육/프로토타입 목적. 투자 조언이 아니며 결과의 정확성을 보장하지 않습니다."

개인 정보: 저장하지 않음

확장 아이디어 (2차)

자동완성(티커 검색) — 무료 소스 필요

멀티 마켓(KR, JP 등) 지원

예측 모델 옵션(밴드/ARIMA/Prophet 등)

즐겨찾기 티커 저장

결과 공유 링크(쿼리스트링)

최종 완료 정의(Definition of Done)

시스템 테마 연동 + 토글 + 유지

티커 입력 → 데이터 로드 → 예측 → 결과 요약/차트 표시

에러/로딩 UX 완성

Vercel 무료 배포 완료

면책/출처 표시

