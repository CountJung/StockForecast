# Stock Forecast — Objectives & Plan

## 0) 프로젝트 개요
사용자가 주식 티커를 입력하면:
1. 최근 2~5년 Stooq 일봉 OHLCV를 불러와 차트로 표시
2. Block bootstrap 기반 확률 예측(5D/20D/60D)으로 시나리오(BULL/BASE/BEAR) 라벨링
3. 상승 확률(pUp), 중앙값 수익률, VaR5, p10/p90 가격 밴드를 UI/차트에 표시
4. 시스템 다크/라이트 테마 자동 감지 + 토글 + 유지

> 면책: 투자 조언 아님. 교육/프로토타입 목적. 데이터 출처: Stooq (EOD, 지연 가능)

---

## 1) 기술 스택
- Next.js 15+ (App Router) + TypeScript
- MUI v5 (Emotion) — 시스템 다크/라이트 테마 토글 + 유지
- lightweight-charts v5
- Node >=22.22.0
- 배포: Vercel Free

---

## 2) 핵심 아키텍처

### 파일 구조
```
app/
  layout.tsx          # Metadata + Providers 래핑
  providers.tsx       # MUI ThemeProvider(다크/라이트 토글 + 시스템 감지 + 유지) + CssBaseline
  page.tsx            # 메인 컨테이너: 입력 > quotes > forecast > 결과 렌더
  api/
    quotes/route.ts   # GET — Stooq CSV 파싱, ticker 매핑, range 필터
    forecast/route.ts # POST — 검증 > bootstrap 엔진 > 응답
components/
  PriceChart.tsx      # close 라인 + horizon p10/p90 밴드 + analyst 수평선 (다크모드 적응)
  ScenarioPanel.tsx   # horizon별 pUp/시나리오/지표 카드
lib/
  forecastBootstrap.ts # block bootstrap 엔진 + quantile/median
  range.ts            # range 유틸
  types.ts            # API/컴포넌트 공통 타입
types/
  mui-icons.d.ts      # @mui/icons-material v7 타입 선언
```

### API 계약 (요약)

| Endpoint | Method | 핵심 파라미터 | 주요 응답 필드 |
|---|---|---|---|
| /api/quotes | GET | ticker, range | ohlcv[] |
| /api/forecast | POST | ticker, range, horizons, closes, analyst? | horizons[], analyst? |

상세 스키마는 .github/copilot-instructions.md 4조 참고.

### 예측 엔진 규칙
- 입력 closes >= 120개
- logReturn = ln(C_t / C_{t-1}), invalid 제거 후 재검증
- Block bootstrap (blockSize=5, simulations=2000)
- 시나리오: BULL(pUp>=0.60 && medianReturn>0 && var5>-0.06) / BEAR(pUp<=0.45 || var5<=-0.10) / BASE
- analyst.ptAvg 있으면 60D에서 P(Price >= ptAvg) 서버 계산

---

## 3) UX 흐름
1. 티커 입력(trim+uppercase) + range(2y/5y) + horizons(5/20/60 다중선택)
2. "분석" 클릭(또는 Enter) > 버튼 disabled + LinearProgress + Skeleton
3. GET /api/quotes > POST /api/forecast 순차 호출
4. 성공 > ScenarioPanel + PriceChart 갱신
5. 실패 > Alert + "다시 시도" 버튼

---

## 4) 구현 상태

### 완료
- [x] 예측 엔진 (lib/forecastBootstrap.ts) — block bootstrap + quantile/median
- [x] Forecast API (app/api/forecast/route.ts) — POST 검증 + 엔진 호출
- [x] Quotes API (app/api/quotes/route.ts) — Stooq CSV fetch/parse/filter + Cache-Control
- [x] ScenarioPanel — horizon별 pUp/시나리오/지표 카드 UI
- [x] PriceChart — close 라인 + horizon 밴드 + analyst 수평선 + 다크모드 적응
- [x] Page 흐름 — 입력 > quotes > forecast > 결과 렌더 + 로딩/에러
- [x] 공통 타입 (lib/types.ts)
- [x] Analyst ptAvg 확률 계산 (서버)
- [x] 다크/라이트 테마 토글 — 시스템 감지 + localStorage 유지 + 토글 버튼
- [x] AppBar — 앱 이름 + 테마 토글 아이콘
- [x] 면책/출처 Disclosure — 페이지 하단 안내 텍스트
- [x] 레거시 ForecastChart.tsx 제거
- [x] layout.tsx 메타데이터 description 수정 (bootstrap)
- [x] 폼 Enter 키 제출 지원

### 향후 고려
- [ ] Analyst 목표가 입력 UI (선택적)
- [ ] 자동완성 티커 검색
- [ ] 멀티 마켓(KR, JP 등) 지원

---

## 5) 검증 명령
```bash
npm run typecheck
npm run build
npm run dev
```

## 6) 원칙
- 타입 변경은 lib/types.ts부터
- 수치 계산은 Number.isFinite/양수 검증 일관 적용
- 차트: 안정적 MVP 우선, 과한 인터랙션보다 데이터 정확성
- SKILL.md의 Karpathy 가이드라인 준수: 단순성 우선, 외과적 변경
