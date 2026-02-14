'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  BaselineSeries,
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time
} from 'lightweight-charts'
import type { QuoteItem } from '@/lib/types'

type Props = {
  ohlcv: QuoteItem[]
  forecast: {
    low: number
    high: number
    horizon: number
  } | null
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

export function ForecastChart({ ohlcv, forecast }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null)
  const lowRef = useRef<ISeriesApi<'Line'> | null>(null)
  const highRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bandRef = useRef<ISeriesApi<'Baseline'> | null>(null)

  const closeData = useMemo(
    () => ohlcv.map((item) => ({ time: item.time as Time, value: item.close })),
    [ohlcv]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#1f2937'
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.2)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.2)' }
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
      lastValueVisible: true
    })

    const lowSeries = chart.addSeries(LineSeries, {
      color: 'rgba(11, 95, 255, 0.55)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false
    })

    const highSeries = chart.addSeries(LineSeries, {
      color: 'rgba(11, 95, 255, 0.55)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false
    })

    const bandSeries = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      topLineColor: 'rgba(11,95,255,0)',
      topFillColor1: 'rgba(11,95,255,0.22)',
      topFillColor2: 'rgba(11,95,255,0.12)',
      bottomLineColor: 'rgba(11,95,255,0)',
      bottomFillColor1: 'rgba(11,95,255,0)',
      bottomFillColor2: 'rgba(11,95,255,0)',
      priceLineVisible: false,
      lastValueVisible: false
    })

    chartRef.current = chart
    lineRef.current = closeSeries
    lowRef.current = lowSeries
    highRef.current = highSeries
    bandRef.current = bandSeries

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
      lineRef.current = null
      lowRef.current = null
      highRef.current = null
      bandRef.current = null
    }
  }, [])

  useEffect(() => {
    const lineSeries = lineRef.current
    const lowSeries = lowRef.current
    const highSeries = highRef.current
    const bandSeries = bandRef.current
    const chart = chartRef.current

    if (!lineSeries || !lowSeries || !highSeries || !bandSeries || !chart) {
      return
    }

    lineSeries.setData(closeData)

    if (!forecast || closeData.length === 0) {
      lowSeries.setData([])
      highSeries.setData([])
      bandSeries.setData([])
      chart.timeScale().fitContent()
      return
    }

    const lastTime = String(closeData[closeData.length - 1].time)
    const start = addDays(lastTime, 1)
    const end = addDays(lastTime, forecast.horizon)

    const lowData = [
      { time: start as Time, value: forecast.low },
      { time: end as Time, value: forecast.low }
    ]

    const highData = [
      { time: start as Time, value: forecast.high },
      { time: end as Time, value: forecast.high }
    ]

    const bandData = [
      { time: start as Time, value: forecast.high },
      { time: end as Time, value: forecast.high }
    ]

    bandSeries.applyOptions({ baseValue: { type: 'price', price: forecast.low } })

    lowSeries.setData(lowData)
    highSeries.setData(highData)
    bandSeries.setData(bandData)

    chart.timeScale().fitContent()
  }, [closeData, forecast])

  return <div ref={containerRef} style={{ width: '100%', minHeight: 420 }} />
}
