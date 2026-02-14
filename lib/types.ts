export type QuoteItem = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type ForecastRequest = {
  closes: number[]
  horizon: number
}

export type ForecastResponse = {
  low: number
  high: number
  horizon: number
  simulations: number
  mu: number
  sigma: number
}
