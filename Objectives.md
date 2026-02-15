
우리는 Next.js(App Router) + TypeScript + MUI v5(시스템 다크/라이트 테마 토글+유지) + lightweight-charts를 사용하는 주식 프로토타입을 개발 중이다.
기존 기능: 티커 입력 → /api/quotes로 Stooq 일봉 OHLCV 수집 → 차트 표시.
추가 목표: 애널리스트 목표가는 옵션(있으면 표시)이고, 핵심은 5/20/60 거래일 구간별로 “상승 확률(pUp), 중앙값 수익률, 하방리스크(VaR5), 가격밴드(p10/p90)”를 확률적으로 계산해 시나리오(BULL/BASE/BEAR)를 라벨링하고 UI/차트에 표시한다.
예측은 GBM보다 과거 수익률 분포를 보존하는 부트스트랩(가능하면 block bootstrap) 방식으로 구현한다.
코드는 깔끔하고 타입 안전하게 작성하고, 에러 처리/입력 검증/성능(서버리스)도 고려한다.

1. 단계 요구사항
다음 요구사항으로 /lib/forecastBootstrap.ts 를 새로 작성해줘.

- 입력: closes:number[] (최신이 마지막), horizons:number[] (예: [5,20,60]), simulations:number (기본 2000)
- 전처리:
  - closes 길이 최소 120 미만이면 throw (데이터 부족)
  - 일간 log return 배열 r_t = ln(C_t/C_{t-1})
  - NaN/Infinity 제거, 유효 길이 다시 체크
- 시뮬레이션(부트스트랩):
  - block bootstrap 사용: blockSize=5를 기본으로 하고, horizon만큼 누적 수익률을 만들기 위해 블록(연속 수익률)을 랜덤 시작점에서 잘라 이어붙여 horizon 길이를 채운다.
  - 각 시뮬레이션마다 horizon일 누적 log return을 합산해 최종 가격 S_T = S0 * exp(sumR).
- 각 horizon마다 다음 지표를 계산해 반환:
  - pUp = P(S_T > S0)
  - medianReturn = median(S_T/S0 - 1)
  - var5 = 5% 분위수 수익률 (S_T/S0 - 1)
  - p10Price, p90Price = 10%/90% 분위수 가격
- 시나리오 라벨:
  - BULL: pUp>=0.60 && medianReturn>0 && var5>-0.06
  - BEAR: pUp<=0.45 || var5<=-0.10
  - BASE: 그 외
- 반환 타입(interfaces)도 함께 작성해줘.
- 랜덤은 Math.random 기반으로 하되 함수가 pure에 가깝게 유지되도록(외부 상태 없음) 구성해줘.
- 유닛테스트는 생략하되, 내부 헬퍼 함수로 분위수 계산(quantile)과 median을 구현해줘.

2. 단계 요구사항
Next.js Route Handler로 /app/api/forecast/route.ts 를 구현/수정해줘.

요구사항:
- method: POST만 허용
- body 스키마:
  {
    "ticker": "AAPL",
    "range": "2y" | "5y",
    "horizons": [5,20,60],   // 고정 허용(검증)
    "closes": number[],
    "dates": string[]        // optional로 받아도 됨
    "analyst": { "ptLow"?: number, "ptAvg"?: number, "ptHigh"?: number } // optional
  }
- 검증:
  - horizons는 [5,20,60]만 허용하고 1~3개까지 허용
  - closes는 120개 이상
  - 숫자 유효성 검사
- 처리:
  - lib/forecastBootstrap.ts 의 함수를 호출해서 horizons별 결과 산출
  - 응답 JSON은 다음 형태:
    {
      "ticker": string,
      "asOf": ISO string,
      "lastClose": number,
      "method": "bootstrap_block",
      "simulations": number,
      "horizons": [
        {
          "days": number,
          "pUp": number,
          "medianReturn": number,
          "var5": number,
          "p10Price": number,
          "p90Price": number,
          "scenario": "BULL"|"BASE"|"BEAR"
        }
      ],
      "analyst"?: { "ptLow"?: number, "ptAvg"?: number, "ptHigh"?: number }
    }
- 에러:
  - 400: validation error (메시지 포함)
  - 500: 계산 오류
- 응답에 Cache-Control은 no-store (예측은 요청마다 달라도 되니)

3. 단계 요구사항
MUI로 /components/ScenarioPanel.tsx 를 새로 만들어줘.

Props:
- data: ForecastResponse (방금 API 응답 타입)

UI 요구:
- Card로 표시
- 상단: "Scenario outlook" 타이틀, 서브: asOf 표시
- 내부에 3개(또는 horizons 개수만큼) Row를 리스트 형태로 표시:
  - 왼쪽: 기간 칩 (예: "5D", "20D", "60D")
  - 가운데: 상승확률 pUp을 %로 크게(예: 62%)
  - 오른쪽: 시나리오 Chip (BULL/BASE/BEAR) + 색상은 theme.palette 기반(직접 색상 하드코딩 최소화)
- 각 Row의 아래 작은 텍스트(secondary):
  - "Median: +1.2% · VaR5: -3.5% · Band(10–90%): 118.9–128.4"
- 모바일에서 줄바꿈/정렬이 깨지지 않게 Stack/Grid로 구성
- 숫자 포맷터 함수(퍼센트/가격)도 함께 만들어줘(국제화는 생략, USD 가정)

4. 단계 요구사항
기존 lightweight-charts 기반 PriceChart 컴포넌트를 확장해줘.

입력 Props:
- bars: {date:string, close:number}[]
- forecast?: ForecastResponse
- analyst?: {ptLow?:number, ptAvg?:number, ptHigh?:number}

표현 요구:
1) 기존 close 라인 유지
2) forecast가 있으면, 각 horizon에 대해:
   - p10Price~p90Price를 수평 밴드처럼 표시 (가장 단순한 방식으로)
   - 구현 방법: 두 개의 수평선 시리즈(상단= p90, 하단= p10) + 간단한 영역 채우기(가능하면) 혹은 최소한 두 선을 같은 구간 끝 지점에 표시
   - 각 밴드에는 라벨(5D/20D/60D)을 툴팁이나 legend에 보이게
3) analyst가 있으면:
   - ptLow/ptAvg/ptHigh를 수평선으로 표시(없으면 스킵)
4) 차트가 반응형으로 리사이즈되도록 유지

주의:
- lightweight-charts의 제약을 고려해 “정교한 영역”이 어렵다면, MVP는 수평선 2개(10/90)만으로 표시해도 된다.
- 구현이 과해지면 오히려 단순하게, 안정적으로.

5. 단계 요구사항
/app/page.tsx 또는 관련 컨테이너 컴포넌트에서 다음 흐름으로 연결해줘.

- 사용자가 티커/기간(2y/5y)/horizons(5/20/60 선택)를 선택하고 "분석" 클릭
- GET /api/quotes → bars 수신
- closes 배열(최신이 마지막) 생성
- POST /api/forecast 로 {ticker, range, horizons, closes} 전송
- 응답을 state로 저장하고:
  - ScenarioPanel에 data 전달
  - PriceChart에 bars + forecast(+analyst 옵션) 전달
- 로딩 UX:
  - 분석 버튼 disabled + LinearProgress
  - 결과 영역 Skeleton
- 에러 UX:
  - Alert로 간단한 이유 + "다시 시도" 버튼

추가:
- horizons는 기본 [5,20,60] 모두 선택 상태로 시작
- 입력 ticker는 trim/uppercase 적용

6. 단계 요구사항
(옵션) analyst.ptAvg가 있는 경우, 60D horizon 결과 분포로 "P(Price >= PT_avg)"를 계산해 UI에 한 줄로 표시하고 싶다.
현재 forecast 엔진은 최종가격 샘플 배열을 반환하지 않는다. 엔진을 크게 복잡하게 만들지 않으면서 이 확률을 계산하는 방법을 제안하고, 최소 변경으로 구현해줘.

조건:
- 응답 payload가 너무 커지지 않게(샘플 전체 반환 X)
- 계산은 서버에서 하고 결과만 number로 반환
- 구현 범위는 ptAvg만(저/고는 나중)
