import { NextResponse } from 'next/server'
import { runBootstrapForecast } from '@/lib/forecastBootstrap'
import type { AnalystTargets, ForecastRequestBody, ForecastResponse } from '@/lib/types'

const ALLOWED_HORIZONS = [5, 20, 60] as const
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' }

class ValidationError extends Error {}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function sanitizeAnalyst(analyst: unknown): AnalystTargets | undefined {
  if (!analyst || typeof analyst !== 'object') {
    return undefined
  }

  const raw = analyst as Record<string, unknown>
  const out: AnalystTargets = {}

  if (raw.ptLow !== undefined) {
    if (!isFinitePositive(raw.ptLow)) throw new ValidationError('analyst.ptLow must be a positive finite number')
    out.ptLow = raw.ptLow
  }

  if (raw.ptAvg !== undefined) {
    if (!isFinitePositive(raw.ptAvg)) throw new ValidationError('analyst.ptAvg must be a positive finite number')
    out.ptAvg = raw.ptAvg
  }

  if (raw.ptHigh !== undefined) {
    if (!isFinitePositive(raw.ptHigh)) throw new ValidationError('analyst.ptHigh must be a positive finite number')
    out.ptHigh = raw.ptHigh
  }

  return Object.keys(out).length ? out : undefined
}

function parseBody(body: unknown): ForecastRequestBody {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('body must be a JSON object')
  }

  const payload = body as Partial<ForecastRequestBody>
  const ticker = typeof payload.ticker === 'string' ? payload.ticker.trim().toUpperCase() : ''

  if (!ticker) {
    throw new ValidationError('ticker is required')
  }

  if (payload.range !== '2y' && payload.range !== '5y') {
    throw new ValidationError('range must be one of 2y or 5y')
  }

  if (!Array.isArray(payload.horizons) || payload.horizons.length < 1 || payload.horizons.length > 3) {
    throw new ValidationError('horizons must be an array of 1 to 3 items')
  }

  const uniqueHorizons = [...new Set(payload.horizons)]
  if (uniqueHorizons.length !== payload.horizons.length) {
    throw new ValidationError('horizons must not contain duplicates')
  }

  if (uniqueHorizons.some((h) => !Number.isInteger(h) || !ALLOWED_HORIZONS.includes(h as (typeof ALLOWED_HORIZONS)[number]))) {
    throw new ValidationError('horizons must be selected from [5, 20, 60]')
  }

  if (!Array.isArray(payload.closes) || payload.closes.length < 120) {
    throw new ValidationError('closes must be an array with at least 120 values')
  }

  const closes = payload.closes.map((v) => Number(v))
  if (closes.some((v) => !isFinitePositive(v))) {
    throw new ValidationError('closes must contain only positive finite numbers')
  }

  if (payload.dates !== undefined) {
    if (!Array.isArray(payload.dates) || payload.dates.some((d) => typeof d !== 'string')) {
      throw new ValidationError('dates must be an array of strings when provided')
    }
  }

  const analyst = sanitizeAnalyst(payload.analyst)

  return {
    ticker,
    range: payload.range,
    horizons: uniqueHorizons,
    closes,
    dates: payload.dates,
    analyst
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown
    const parsed = parseBody(body)

    const targetPriceByHorizon =
      parsed.analyst?.ptAvg !== undefined && parsed.horizons.includes(60)
        ? { 60: parsed.analyst.ptAvg }
        : undefined

    const result = runBootstrapForecast({
      closes: parsed.closes,
      horizons: parsed.horizons,
      simulations: 2000,
      blockSize: 5,
      targetPriceByHorizon
    })

    const h60 = result.horizons.find((h) => h.days === 60)
    const analyst = parsed.analyst
      ? {
          ...parsed.analyst,
          ...(h60?.probAboveTarget !== undefined ? { ptAvgProb60d: h60.probAboveTarget } : {})
        }
      : undefined

    const response: ForecastResponse = {
      ticker: parsed.ticker,
      asOf: new Date().toISOString(),
      lastClose: result.lastClose,
      method: 'bootstrap_block',
      simulations: result.simulations,
      horizons: result.horizons.map(({ probAboveTarget, ...h }) => h),
      ...(analyst ? { analyst } : {})
    }

    return NextResponse.json(response, {
      status: 200,
      headers: NO_STORE_HEADERS
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE_HEADERS })
    }

    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405, headers: NO_STORE_HEADERS })
}
