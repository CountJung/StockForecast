'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTheme } from '@mui/material/styles'
import {
  BaselineSeries,
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time
} from 'lightweight-charts'
import type { AnalystTargets, ForecastResponse, PriceBar } from '@/lib/types'

type Props = {
  bars: PriceBar[]
  forecast?: ForecastResponse
  analyst?: AnalystTargets
}

function toDateString(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateString(date)
}

const HORIZON_COLORS: Record<number, { line: string; fill1: string; fill2: string }> = {
  5: { line: 'rgba(14, 116, 144, 0.7)', fill1: 'rgba(14,116,144,0.16)', fill2: 'rgba(14,116,144,0.08)' },
  20: { line: 'rgba(37, 99, 235, 0.7)', fill1: 'rgba(37,99,235,0.16)', fill2: 'rgba(37,99,235,0.08)' },
  60: { line: 'rgba(124, 58, 237, 0.7)', fill1: 'rgba(124,58,237,0.16)', fill2: 'rgba(124,58,237,0.08)' }
}

export function PriceChart({ bars, forecast, analyst }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const closeSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const overlaySeriesRef = useRef<Array<ISeriesApi<'Line'> | ISeriesApi<'Baseline'>>>([])
  const muiTheme = useTheme()
  const isDark = muiTheme.palette.mode === 'dark'

  const bgColor = isDark ? '#1e1e1e' : '#ffffff'
  const textColor = isDark ? '#e0e0e0' : '#1f2937'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.2)'
  const legendBg = isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.9)'
  const legendBorder = isDark ? 'rgba(80,80,80,0.6)' : 'rgba(203,213,225,0.8)'
  const legendTextColor = isDark ? '#ccc' : '#333'

  const closeData = useMemo(
    () => bars.map((item) => ({ time: item.date as Time, value: item.close })),
    [bars]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 440,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor }
      },
      timeScale: {
        rightOffset: 8,
        borderVisible: false
      },
      rightPriceScale: {
        borderVisible: false
      }
    })

    const closeSeries = chart.addSeries(LineSeries, {
      color: '#0B5FFF',
      lineWidth: 2,
      crosshairMarkerRadius: 4,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Close'
    })

    chartRef.current = chart
    closeSeriesRef.current = closeSeries

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      chart.applyOptions({ width: Math.floor(entry.contentRect.width) })
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      closeSeriesRef.current = null
    }
  }, [bgColor, textColor, gridColor])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor }
      }
    })
  }, [bgColor, textColor, gridColor])

  useEffect(() => {
    const chart = chartRef.current
    const closeSeries = closeSeriesRef.current
    if (!chart || !closeSeries) return

    for (const series of overlaySeriesRef.current) {
      chart.removeSeries(series)
    }
    overlaySeriesRef.current = []

    chart.removeSeries(closeSeries)

    const freshClose = chart.addSeries(LineSeries, {
      color: '#0B5FFF',
      lineWidth: 2,
      crosshairMarkerRadius: 4,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Close'
    })
    closeSeriesRef.current = freshClose
    freshClose.setData(closeData)

    if (!closeData.length) {
      chart.timeScale().fitContent()
      return
    }

    const lastDate = String(closeData[closeData.length - 1].time)

    if (forecast?.horizons) {
      for (const horizon of forecast.horizons) {
        const colorSet = HORIZON_COLORS[horizon.days] ?? HORIZON_COLORS[20]
        const start = addDays(lastDate, 1)
        const end = addDays(lastDate, horizon.days)

        const lowLine = chart.addSeries(LineSeries, {
          color: colorSet.line,
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          title: `${horizon.days}D p10`
        })

        const highLine = chart.addSeries(LineSeries, {
          color: colorSet.line,
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          title: `${horizon.days}D p90`
        })

        const band = chart.addSeries(BaselineSeries, {
          baseValue: { type: 'price', price: horizon.p10Price },
          topLineColor: 'rgba(0,0,0,0)',
          topFillColor1: colorSet.fill1,
          topFillColor2: colorSet.fill2,
          bottomLineColor: 'rgba(0,0,0,0)',
          bottomFillColor1: 'rgba(0,0,0,0)',
          bottomFillColor2: 'rgba(0,0,0,0)',
          priceLineVisible: false,
          lastValueVisible: false,
          title: `${horizon.days}D band`
        })

        lowLine.setData([
          { time: start as Time, value: horizon.p10Price },
          { time: end as Time, value: horizon.p10Price }
        ])

        highLine.setData([
          { time: start as Time, value: horizon.p90Price },
          { time: end as Time, value: horizon.p90Price }
        ])

        band.setData([
          { time: start as Time, value: horizon.p90Price },
          { time: end as Time, value: horizon.p90Price }
        ])

        overlaySeriesRef.current.push(lowLine, highLine, band)
      }
    }

    const analystTargets: Array<{ key: string; value?: number; color: string }> = [
      { key: 'PT Low', value: analyst?.ptLow, color: '#f97316' },
      { key: 'PT Avg', value: analyst?.ptAvg, color: '#16a34a' },
      { key: 'PT High', value: analyst?.ptHigh, color: '#dc2626' }
    ]

    for (const target of analystTargets) {
      if (!target.value || !Number.isFinite(target.value)) continue

      const line = chart.addSeries(LineSeries, {
        color: target.color,
        lineWidth: 1,
        lineStyle: 1,
        lastValueVisible: false,
        priceLineVisible: false,
        title: target.key
      })

      line.setData([
        { time: closeData[0].time, value: target.value },
        { time: addDays(lastDate, 60) as Time, value: target.value }
      ])

      overlaySeriesRef.current.push(line)
    }

    chart.timeScale().fitContent()
  }, [closeData, forecast, analyst])

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', minHeight: 440 }} />
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: legendBg,
          border: `1px solid ${legendBorder}`,
          borderRadius: 8,
          padding: '6px 8px',
          fontSize: 12,
          lineHeight: 1.35,
          color: legendTextColor
        }}
      >
        <div>Close</div>
        {(forecast?.horizons ?? []).map((h) => (
          <div key={h.days}>{h.days}D Band (p10-p90)</div>
        ))}
        {analyst?.ptLow !== undefined ? <div>PT Low</div> : null}
        {analyst?.ptAvg !== undefined ? <div>PT Avg</div> : null}
        {analyst?.ptHigh !== undefined ? <div>PT High</div> : null}
      </div>
    </div>
  )
}
