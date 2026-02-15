import { NextResponse } from 'next/server'
import { cutoffDate, isValidRange } from '@/lib/range'
import type { QuoteItem } from '@/lib/types'

type ParsedRow = {
  date: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

function normalizeTicker(raw: string): string {
  const cleaned = raw.trim()
  if (!cleaned) {
    throw new Error('ticker is required')
  }

  if (!/^[a-zA-Z0-9.-]+$/.test(cleaned)) {
    throw new Error('ticker format is invalid')
  }

  if (/\.us$/i.test(cleaned)) {
    return cleaned
  }

  if (cleaned.includes('.')) {
    return cleaned
  }

  return `${cleaned.toLowerCase()}.us`
}

function parseCsv(csv: string): QuoteItem[] {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error('No quote data from provider')
  }

  const rows = lines.slice(1)
  const items: QuoteItem[] = []

  for (const line of rows) {
    const [date, open, high, low, close, volume] = line.split(',')
    const row: ParsedRow = { date, open, high, low, close, volume }

    if (!row.date || !row.open || !row.high || !row.low || !row.close || !row.volume) {
      continue
    }

    const parsed: QuoteItem = {
      time: row.date,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume)
    }

    const values = [parsed.open, parsed.high, parsed.low, parsed.close, parsed.volume]
    if (values.some((v) => !Number.isFinite(v))) {
      continue
    }

    if (parsed.open <= 0 || parsed.high <= 0 || parsed.low <= 0 || parsed.close <= 0 || parsed.volume < 0) {
      continue
    }

    items.push(parsed)
  }

  if (items.length === 0) {
    throw new Error('Unable to parse quote rows')
  }

  return items
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tickerParam = searchParams.get('ticker') ?? ''
    const rangeParam = (searchParams.get('range') ?? '6m').toLowerCase()

    if (!isValidRange(rangeParam)) {
      return NextResponse.json({ error: 'range must be one of 1m,3m,6m,1y,2y,5y,max' }, { status: 400 })
    }

    const mappedTicker = normalizeTicker(tickerParam)
    const endpoint = `https://stooq.com/q/d/l/?s=${encodeURIComponent(mappedTicker)}&i=d`

    const response = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store'
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch quotes from Stooq' }, { status: 502 })
    }

    const csv = await response.text()
    const parsed = parseCsv(csv)
    const cutoff = cutoffDate(rangeParam)

    const filtered = cutoff
      ? parsed.filter((item) => {
          const time = new Date(`${item.time}T00:00:00.000Z`)
          return Number.isFinite(time.getTime()) && time >= cutoff
        })
      : parsed

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'No data for selected range' }, { status: 404 })
    }

    return NextResponse.json({
      ticker: mappedTicker,
      range: rangeParam,
      count: filtered.length,
      ohlcv: filtered
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
