import type { ForecastHorizonResult, ScenarioLabel } from '@/lib/types'

export type BootstrapInput = {
  closes: number[]
  horizons: number[]
  simulations?: number
  blockSize?: number
  targetPriceByHorizon?: Partial<Record<number, number>>
}

export type BootstrapHorizonOutput = ForecastHorizonResult & {
  probAboveTarget?: number
}

export type BootstrapOutput = {
  lastClose: number
  simulations: number
  blockSize: number
  horizons: BootstrapHorizonOutput[]
}

const MIN_CLOSES = 120
const DEFAULT_SIMULATIONS = 2000
const DEFAULT_BLOCK_SIZE = 5

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const clampedQ = Math.min(1, Math.max(0, q))
  const pos = (sorted.length - 1) * clampedQ
  const base = Math.floor(pos)
  const rest = pos - base
  const lower = sorted[base] ?? sorted[sorted.length - 1]
  const upper = sorted[base + 1] ?? lower
  const out = lower + rest * (upper - lower)

  return Number.isFinite(out) ? out : lower
}

export function median(values: number[]): number {
  return quantile(values, 0.5)
}

function toScenario(pUp: number, medianReturn: number, var5: number): ScenarioLabel {
  if (pUp >= 0.6 && medianReturn > 0 && var5 > -0.06) {
    return 'BULL'
  }

  if (pUp <= 0.45 || var5 <= -0.1) {
    return 'BEAR'
  }

  return 'BASE'
}

function logReturnsFromCloses(closes: number[]): number[] {
  const returns: number[] = []

  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1]
    const cur = closes[i]
    if (!isFinitePositive(prev) || !isFinitePositive(cur)) {
      continue
    }

    const r = Math.log(cur / prev)
    if (Number.isFinite(r)) {
      returns.push(r)
    }
  }

  return returns
}

function sampleBootstrapSum(logReturns: number[], horizon: number, blockSize: number): number {
  let sum = 0
  let filled = 0
  const n = logReturns.length

  while (filled < horizon) {
    const start = Math.floor(Math.random() * n)
    for (let offset = 0; offset < blockSize && filled < horizon; offset += 1) {
      const idx = (start + offset) % n
      const r = logReturns[idx]
      if (Number.isFinite(r)) {
        sum += r
        filled += 1
      }
    }
  }

  return sum
}

export function runBootstrapForecast({
  closes,
  horizons,
  simulations = DEFAULT_SIMULATIONS,
  blockSize = DEFAULT_BLOCK_SIZE,
  targetPriceByHorizon
}: BootstrapInput): BootstrapOutput {
  if (closes.length < MIN_CLOSES) {
    throw new Error(`Insufficient close data: require at least ${MIN_CLOSES}`)
  }

  if (!Number.isInteger(simulations) || simulations < 100) {
    throw new Error('simulations must be an integer >= 100')
  }

  if (!Number.isInteger(blockSize) || blockSize < 1) {
    throw new Error('blockSize must be an integer >= 1')
  }

  if (!Array.isArray(horizons) || horizons.length === 0) {
    throw new Error('horizons must be a non-empty number array')
  }

  const uniqueHorizons = [...new Set(horizons)]
  if (uniqueHorizons.some((h) => !Number.isInteger(h) || h < 1)) {
    throw new Error('horizons must contain positive integers')
  }

  const logReturns = logReturnsFromCloses(closes)
  if (logReturns.length < MIN_CLOSES - 1) {
    throw new Error('Insufficient valid log returns after filtering invalid values')
  }

  const lastClose = closes[closes.length - 1]
  if (!isFinitePositive(lastClose)) {
    throw new Error('Invalid last close value')
  }

  const horizonOutputs: BootstrapHorizonOutput[] = uniqueHorizons
    .sort((a, b) => a - b)
    .map((days) => {
      const finalPrices: number[] = []
      let upCount = 0
      let targetHitCount = 0
      const targetPrice = targetPriceByHorizon?.[days]

      for (let i = 0; i < simulations; i += 1) {
        const sumR = sampleBootstrapSum(logReturns, days, blockSize)
        const st = lastClose * Math.exp(sumR)

        if (!isFinitePositive(st)) {
          continue
        }

        finalPrices.push(st)
        if (st > lastClose) upCount += 1
        if (isFinitePositive(targetPrice) && st >= targetPrice) {
          targetHitCount += 1
        }
      }

      if (finalPrices.length === 0) {
        throw new Error(`No valid simulations for horizon ${days}`)
      }

      const returns = finalPrices.map((p) => p / lastClose - 1)
      const pUp = upCount / finalPrices.length
      const medianReturn = median(returns)
      const var5 = quantile(returns, 0.05)
      const p10Price = quantile(finalPrices, 0.1)
      const p90Price = quantile(finalPrices, 0.9)
      const scenario = toScenario(pUp, medianReturn, var5)

      const output: BootstrapHorizonOutput = {
        days,
        pUp,
        medianReturn,
        var5,
        p10Price,
        p90Price,
        scenario
      }

      if (isFinitePositive(targetPrice)) {
        output.probAboveTarget = targetHitCount / finalPrices.length
      }

      return output
    })

  return {
    lastClose,
    simulations,
    blockSize,
    horizons: horizonOutputs
  }
}
