'use client'

import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import { ForecastChart } from '@/components/ForecastChart'
import type { QuoteItem } from '@/lib/types'

type QuotesApiResponse = {
  ticker: string
  range: string
  count: number
  ohlcv: QuoteItem[]
}

type ForecastApiResponse = {
  low: number
  high: number
  horizon: number
  simulations: number
  mu: number
  sigma: number
}

const RANGE_OPTIONS = ['1m', '3m', '6m', '1y', '5y', 'max'] as const
const HORIZON_OPTIONS = [5, 10, 20, 30, 60] as const

export default function HomePage() {
  const [ticker, setTicker] = useState('AAPL')
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>('6m')
  const [horizon, setHorizon] = useState<(typeof HORIZON_OPTIONS)[number]>(20)
  const [quotes, setQuotes] = useState<QuoteItem[]>([])
  const [mappedTicker, setMappedTicker] = useState('')
  const [forecast, setForecast] = useState<ForecastApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const summary = useMemo(() => {
    if (!quotes.length || !forecast) return null

    const lastClose = quotes[quotes.length - 1].close
    const lowDelta = ((forecast.low - lastClose) / lastClose) * 100
    const highDelta = ((forecast.high - lastClose) / lastClose) * 100

    return {
      lastClose,
      lowDelta,
      highDelta
    }
  }, [quotes, forecast])

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const quotesResponse = await fetch(`/api/quotes?ticker=${encodeURIComponent(ticker)}&range=${range}`)
      const quotesData = (await quotesResponse.json()) as QuotesApiResponse | { error: string }

      if (!quotesResponse.ok || 'error' in quotesData) {
        throw new Error('error' in quotesData ? quotesData.error : 'Failed to load quotes')
      }

      const closes = quotesData.ohlcv.map((item) => item.close)

      const forecastResponse = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closes, horizon })
      })

      const forecastData = (await forecastResponse.json()) as ForecastApiResponse | { error: string }
      if (!forecastResponse.ok || 'error' in forecastData) {
        throw new Error('error' in forecastData ? forecastData.error : 'Failed to forecast')
      }

      setQuotes(quotesData.ohlcv)
      setMappedTicker(quotesData.ticker)
      setForecast(forecastData)
    } catch (err) {
      const message = err instanceof Error ? err.message : '요청 처리 중 알 수 없는 오류가 발생했습니다.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Stock Forecast Dashboard
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Stooq OHLCV + GBM Monte Carlo (2000 paths, 10-90% quantile)
          </Typography>
        </Box>

        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Ticker
                  </Typography>
                  <TextField
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    placeholder="AAPL"
                    fullWidth
                    size="small"
                  />
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Range
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    value={range}
                    exclusive
                    fullWidth
                    onChange={(_, value: (typeof RANGE_OPTIONS)[number] | null) => {
                      if (value) setRange(value)
                    }}
                  >
                    {RANGE_OPTIONS.map((option) => (
                      <ToggleButton key={option} value={option}>
                        {option}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Horizon (days)
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    value={horizon}
                    exclusive
                    fullWidth
                    onChange={(_, value: (typeof HORIZON_OPTIONS)[number] | null) => {
                      if (value) setHorizon(value)
                    }}
                  >
                    {HORIZON_OPTIONS.map((option) => (
                      <ToggleButton key={option} value={option}>
                        {option}D
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSubmit}
                  disabled={loading}
                  sx={{ minWidth: { md: 200 }, py: 1.5 }}
                >
                  분석 실행
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {loading ? <LinearProgress /> : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Last Close
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {summary ? summary.lastClose.toFixed(2) : <Skeleton width={120} />}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Forecast Low (P10)
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {forecast ? forecast.low.toFixed(2) : <Skeleton width={120} />}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary ? `${summary.lowDelta.toFixed(2)}% vs close` : ' '} 
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Forecast High (P90)
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {forecast ? forecast.high.toFixed(2) : <Skeleton width={120} />}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary ? `${summary.highDelta.toFixed(2)}% vs close` : ' '} 
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight={700}>
                {mappedTicker || '선택한 종목'} Close + Forecast Band
              </Typography>
              {!quotes.length && loading ? (
                <Skeleton variant="rounded" height={420} />
              ) : (
                <ForecastChart
                  ohlcv={quotes}
                  forecast={
                    forecast
                      ? {
                          low: forecast.low,
                          high: forecast.high,
                          horizon: forecast.horizon
                        }
                      : null
                  }
                />
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  )
}
