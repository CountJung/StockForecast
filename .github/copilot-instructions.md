# Copilot Instructions - StockForecast

## Project Snapshot
- Stack: Next.js App Router + TypeScript + MUI + lightweight-charts
- Core flow: `quotes 조회 -> forecast 계산 -> 요약 카드/차트 표시`
- Data source: Stooq CSV (`https://stooq.com/q/d/l/?s={ticker}&i=d`)

## Directory Guide
- `app/page.tsx`: 메인 클라이언트 UI (입력, 요청 흐름, 상태 표시)
- `app/api/quotes/route.ts`: 시세 조회 API
- `app/api/forecast/route.ts`: GBM Monte Carlo 예측 API
- `components/ForecastChart.tsx`: close 라인 + 예측 밴드 렌더링
- `lib/types.ts`: 공통 타입
- `lib/range.ts`: range 검증 및 컷오프 날짜 계산
- `Plan.md`: 진행 계획/검증 체크리스트(Living)

## API Contracts

### 1) GET `/api/quotes`
- Query:
  - `ticker` (required)
  - `range` (`1m|3m|6m|1y|5y|max`)
- Rules:
  - 영문/숫자/`.`/`-`만 허용
  - `.us` 미포함 미국 티커는 자동으로 `.us` suffix 부여 (`aapl` -> `aapl.us`)
  - 이미 `.US/.us` 포함 시 중복 suffix 추가 금지
- Success response:
```json
{
  "ticker": "aapl.us",
  "range": "6m",
  "count": 120,
  "ohlcv": [
    { "time": "2025-08-01", "open": 1, "high": 1, "low": 1, "close": 1, "volume": 1 }
  ]
}
```
- Error: `{ "error": "message" }` + 적절한 status

### 2) POST `/api/forecast`
- Body:
```json
{ "closes": [100, 101, 99.5], "horizon": 20 }
```
- Rules:
  - `closes`: 양의 유한수 배열, 최소 3개
  - `horizon`: 1~365 정수
- Model:
  - log return 기반 `mu/sigma` 추정
  - GBM Monte Carlo 2000회 시뮬레이션
  - 경로별 min/max 수집 후 `P10(min)` = `low`, `P90(max)` = `high`
  - NaN/Infinity/비정상 price 방어
- Success response:
```json
{
  "low": 95.12,
  "high": 112.34,
  "horizon": 20,
  "simulations": 2000,
  "mu": 0.0008,
  "sigma": 0.018
}
```

## UI/UX Rules
- 입력 카드: Ticker + Range 토글 + Horizon 토글 + 분석 버튼
- 실행 시: `/api/quotes` 완료 후 `/api/forecast` 순차 호출
- 로딩: `LinearProgress` + `Skeleton`
- 에러: `Alert`
- 차트: close 라인 + horizon 구간 low/high 밴드
- 반응형: 모바일(세로 스택), 데스크톱(가로 배치)

## Engineering Notes
- 간단한 변경 우선, 과도한 추상화 금지
- API 입력 검증은 route handler 내부에서 수행
- 수치 계산 코드에서는 `Number.isFinite` 방어를 기본 적용
- 변경 시 관련 타입(`lib/types.ts`) 먼저 업데이트

## Ongoing Update Checklist
변경 PR/커밋마다 아래를 갱신:
1. 어떤 파일이 변경되었는지
2. API 스키마가 바뀌었는지
3. 수동 테스트 결과(성공/실패 시나리오)
4. 남은 TODO
