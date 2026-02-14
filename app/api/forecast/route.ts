import { NextResponse } from 'next/server'
import type { ForecastRequest, ForecastResponse } from '@/lib/types'

const SIMULATIONS = 2000

function boxMullerRandom() {
  let u = 0
  let v = 0

  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()

  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return Number.isFinite(z) ? z : 0
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base

  const lower = sorted[base] ?? sorted[sorted.length - 1]
  const upper = sorted[base + 1] ?? lower
  const value = lower + rest * (upper - lower)

  return Number.isFinite(value) ? value : lower
}

function safeNumber(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null
  }

  if (!Number.isFinite(value)) {
    return null
  }

  return value
}

function parseInput(body: unknown): ForecastRequest {
  const payload = body as Partial<ForecastRequest>
  const closesRaw = Array.isArray(payload?.closes) ? payload.closes : null
  const horizon = safeNumber(payload?.horizon)

  if (!closesRaw || closesRaw.length < 3) {
    throw new Error('closes must be an array with at least 3 values')
  }

  if (horizon === null || !Number.isInteger(horizon) || horizon < 1 || horizon > 365) {
    throw new Error('horizon must be an integer between 1 and 365')
  }

  const closes = closesRaw
    .map((x) => safeNumber(x))
    .filter((x): x is number => x !== null && x > 0)

  if (closes.length !== closesRaw.length) {
    throw new Error('closes must contain only positive finite numbers')
  }

  return { closes, horizon }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown
    const { closes, horizon } = parseInput(body)
    const lastClose = closes[closes.length - 1]

    if (!Number.isFinite(lastClose) || lastClose <= 0) {
      throw new Error('Invalid closing price series')
    }

    const logReturns: number[] = []
    for (let i = 1; i < closes.length; i += 1) {
      const prev = closes[i - 1]
      const current = closes[i]
      const ratio = current / prev
      const ret = Math.log(ratio)

      if (Number.isFinite(ret)) {
        logReturns.push(ret)
      }
    }

    if (logReturns.length < 2) {
      throw new Error('Not enough valid log returns for forecasting')
    }

    const mu = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length

    const variance =
      logReturns.reduce((sum, r) => {
        const d = r - mu
        return sum + d * d
      }, 0) / Math.max(logReturns.length - 1, 1)

    const sigma = Math.sqrt(Math.max(variance, 0))

    if (!Number.isFinite(mu) || !Number.isFinite(sigma)) {
      throw new Error('Failed to estimate mu/sigma from closes')
    }

    const pathMins: number[] = []
    const pathMaxs: number[] = []

    for (let i = 0; i < SIMULATIONS; i += 1) {
      let price = lastClose
      let pathMin = lastClose
      let pathMax = lastClose

      for (let day = 0; day < horizon; day += 1) {
        const z = boxMullerRandom()
        const drift = mu - 0.5 * sigma * sigma
        const diffusion = sigma * z
        const nextPrice = price * Math.exp(drift + diffusion)

        if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
          continue
        }

        price = nextPrice
        if (price < pathMin) pathMin = price
        if (price > pathMax) pathMax = price
      }

      if (Number.isFinite(pathMin) && Number.isFinite(pathMax) && pathMin > 0 && pathMax > 0) {
        pathMins.push(pathMin)
        pathMaxs.push(pathMax)
      }
    }

    if (pathMins.length === 0 || pathMaxs.length === 0) {
      throw new Error('Simulation failed due to invalid numeric states')
    }

    const low = quantile(pathMins, 0.1)
    const high = quantile(pathMaxs, 0.9)

    if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0 || low > high) {
      throw new Error('Invalid forecast quantiles')
    }

    const payload: ForecastResponse = {
      low,
      high,
      horizon,
      simulations: SIMULATIONS,
      mu,
      sigma
    }

    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
