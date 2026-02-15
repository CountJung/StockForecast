# Codex/Copilot Working Guide - StockForecast

## 0) Which file is the "Codex guidance"?
이 프로젝트에서 에이전트가 참고해야 할 우선 문서는 아래 순서다.
1. `AGENTS.md`: 전역 작업 원칙/스타일/제약(최상위 행동 규칙)
2. `.github/copilot-instructions.md` (이 문서): 프로젝트 구현 컨텍스트/아키텍처/API 계약
3. `Objectives.md`: 현재 스프린트 요구사항(무엇을 만들지)

새 작업 시작 시 최소 `Objectives.md` + 이 문서를 먼저 읽고 시작한다.

## 1) Current Product Concept
- 목적: Stooq 일봉 데이터 기반으로 단기/중기 시나리오 확률 예측 UI 제공
- 핵심 예측 방식: **GBM 아님**, **block bootstrap 기반 확률 예측**
- 출력 단위: horizon(5/20/60 거래일)별
  - `pUp` (상승 확률)
  - `medianReturn` (중앙값 수익률)
  - `var5` (5% 분위수 수익률)
  - `p10Price`, `p90Price` (가격 밴드)
  - `scenario` (`BULL | BASE | BEAR`)
- 애널리스트 목표가(`analyst`)는 옵션이며, `ptAvg`가 있으면 60D에서 `P(Price >= PT_avg)`를 서버 계산해 제공

## 2) Stack / Runtime
- Next.js App Router + TypeScript
- MUI
- lightweight-charts
- Node: `22.22.0` (`.nvmrc`, `.node-version`, `package.json engines` 참고)

## 3) Key Files (Current)
- `app/page.tsx`
  - 입력/상태/요청 흐름 컨테이너
  - `GET /api/quotes -> POST /api/forecast` 순차 호출
- `app/api/quotes/route.ts`
  - Stooq CSV 파싱, ticker 매핑(`aapl -> aapl.us`), range 필터
- `app/api/forecast/route.ts`
  - 예측 요청 검증, bootstrap 엔진 호출, 응답 직렬화
- `lib/forecastBootstrap.ts`
  - block bootstrap core 엔진 + `quantile`/`median` 헬퍼
- `components/ScenarioPanel.tsx`
  - horizon별 확률/시나리오 요약 UI
- `components/PriceChart.tsx`
  - close 라인 + horizon p10/p90 밴드 + analyst target 라인
- `lib/types.ts`
  - API/컴포넌트 공통 타입

참고: `components/ForecastChart.tsx`는 과거 버전 유산이며, 신규 기능은 `PriceChart` 기준으로 확장한다.

## 4) API Contracts (Do Not Drift)

### 4.1 GET `/api/quotes`
- Query
  - `ticker`: required
  - `range`: `1m|3m|6m|1y|2y|5y|max`
- Success
```json
{
  "ticker": "aapl.us",
  "range": "2y",
  "count": 500,
  "ohlcv": [
    { "time": "2025-08-01", "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1 }
  ]
}
```

### 4.2 POST `/api/forecast`
- Request
```json
{
  "ticker": "AAPL",
  "range": "2y",
  "horizons": [5, 20, 60],
  "closes": [100, 101, 99.5],
  "dates": ["2025-01-01"],
  "analyst": { "ptLow": 110, "ptAvg": 125, "ptHigh": 140 }
}
```
- Validation rules
  - `range`: `2y|5y`
  - `horizons`: `[5,20,60]` subset, 1~3개, 중복 금지
  - `closes`: 양의 finite number, 길이 120+
- Success
```json
{
  "ticker": "AAPL",
  "asOf": "2026-02-15T00:00:00.000Z",
  "lastClose": 123.4,
  "method": "bootstrap_block",
  "simulations": 2000,
  "horizons": [
    {
      "days": 20,
      "pUp": 0.62,
      "medianReturn": 0.014,
      "var5": -0.041,
      "p10Price": 117.2,
      "p90Price": 130.8,
      "scenario": "BULL"
    }
  ],
  "analyst": {
    "ptAvg": 125,
    "ptAvgProb60d": 0.57
  }
}
```
- Headers: 항상 `Cache-Control: no-store`
- Error codes
  - `400`: validation
  - `500`: forecast calculation/internal

## 5) Forecast Engine Rules
- 파일: `lib/forecastBootstrap.ts`
- 입력 `closes` 최소 120개 미만이면 실패
- `log return = ln(C_t / C_{t-1})`
- invalid return 제거 후 유효 길이 재검증
- block bootstrap
  - 기본 `blockSize = 5`
  - 랜덤 시작점 블록을 이어붙여 horizon 길이 채움
- 시나리오 판정
  - `BULL`: `pUp >= 0.60 && medianReturn > 0 && var5 > -0.06`
  - `BEAR`: `pUp <= 0.45 || var5 <= -0.10`
  - else `BASE`

## 6) UI/UX Behavior
- 메인 입력
  - ticker 입력(실행 시 trim + uppercase)
  - range 선택(`2y|5y`)
  - horizons 다중선택(기본 `[5,20,60]`)
- 분석 버튼 클릭 시
  - 버튼 disabled
  - `LinearProgress` 노출
  - 결과 영역 skeleton 노출
- 실패 시
  - `Alert` + `다시 시도` 버튼
- 성공 시
  - `ScenarioPanel`과 `PriceChart` 동시 갱신

## 7) Editing Rules for Future Work
- 타입 변경은 반드시 `lib/types.ts`부터 반영
- `/api/forecast` 스키마 변경 시 `app/page.tsx` 요청 payload도 동기화
- 차트는 “안정적인 MVP 우선”: 과한 인터랙션보다 데이터 정확성/리렌더 안정성 우선
- 수치 계산 코드는 `Number.isFinite`/양수 검증을 일관 적용

## 8) Quick Resume Checklist
새 작업 시작 시 아래 6개만 보면 맥락 복원 가능:
1. `Objectives.md`의 최신 요구사항 확인
2. `app/page.tsx` 현재 요청 플로우 확인
3. `app/api/forecast/route.ts` 입력/응답 계약 확인
4. `lib/forecastBootstrap.ts` 계산 로직 확인
5. `components/ScenarioPanel.tsx`/`components/PriceChart.tsx` 렌더 규칙 확인
6. `npm run typecheck && npm run build`로 회귀 검증

## 9) Validation Commands
```bash
npm run typecheck
npm run build
npm run dev
```
