# StockForecast 실행 플랜 (Living Document)

## 1) 목표
- `/api/quotes`: ticker + range 입력으로 Stooq CSV 조회 후 OHLCV JSON 반환
- `/api/forecast`: closes + horizon 입력으로 GBM Monte Carlo(2000회) 예측 범위 반환
- 메인 UI: MUI 입력 카드/토글/분석 버튼, 로딩/에러/요약 카드/차트 갱신
- 차트: close 라인 + horizon 구간 low/high 예측 밴드, 반응형 리사이즈
- 지속 개발을 위한 코파일럿 지침 문서화

## 2) 구현 상태
- [x] Next.js(TypeScript) 기본 앱 구조 생성
- [x] `app/api/quotes/route.ts` 구현
- [x] `app/api/forecast/route.ts` 구현
- [x] `app/page.tsx` 메인 UI 구현
- [x] `components/ForecastChart.tsx` 차트 및 예측 밴드 구현
- [x] `.github/copilot-instructions.md` 작성

## 3) 검증 항목
- [ ] `npm install`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] 수동 E2E: ticker/range/horizon 조합별 API+UI 동작 확인

## 4) 업데이트 규칙
- 기능 추가/수정 시 이 파일의 `구현 상태`, `검증 항목` 체크리스트를 최신화한다.
- 신규 API 추가 시 입력/출력 스키마를 `.github/copilot-instructions.md`에 즉시 반영한다.
