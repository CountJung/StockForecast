export type QuoteItem = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type PriceBar = {
  date: string
  close: number
}

export type ScenarioLabel = 'BULL' | 'BASE' | 'BEAR'

export type AnalystTargets = {
  ptLow?: number
  ptAvg?: number
  ptHigh?: number
  ptAvgProb60d?: number
}

export type ForecastHorizonResult = {
  days: number
  pUp: number
  medianReturn: number
  var5: number
  p10Price: number
  p90Price: number
  scenario: ScenarioLabel
}

export type ForecastResponse = {
  ticker: string
  asOf: string
  lastClose: number
  method: 'bootstrap_block'
  simulations: number
  horizons: ForecastHorizonResult[]
  analyst?: AnalystTargets
}

export type ForecastRequestBody = {
  ticker: string
  range: '2y' | '5y'
  horizons: number[]
  closes: number[]
  dates?: string[]
  analyst?: AnalystTargets
}
