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
import { PriceChart } from '@/components/PriceChart'
import { ScenarioPanel } from '@/components/ScenarioPanel'
import type { ForecastResponse, PriceBar, QuoteItem } from '@/lib/types'

type QuotesApiResponse = {
  ticker: string
  range: string
  count: number
  ohlcv: QuoteItem[]
}

const RANGE_OPTIONS = ['2y', '5y'] as const
const HORIZON_OPTIONS = [5, 20, 60] as const

export default function HomePage() {
  const [ticker, setTicker] = useState('AAPL')
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>('2y')
  const [horizons, setHorizons] = useState<number[]>([5, 20, 60])
  const [bars, setBars] = useState<PriceBar[]>([])
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const lastClose = useMemo(() => {
    if (!bars.length) return null
    return bars[bars.length - 1].close
  }, [bars])

  const runAnalysis = async () => {
    setLoading(true)
    setError('')

    try {
      const normalizedTicker = ticker.trim().toUpperCase()
      if (!normalizedTicker) {
        throw new Error('Ticker를 입력해 주세요.')
      }

      if (!horizons.length) {
        throw new Error('최소 1개의 horizon을 선택해 주세요.')
      }

      const quoteRes = await fetch(
        `/api/quotes?ticker=${encodeURIComponent(normalizedTicker)}&range=${encodeURIComponent(range)}`
      )
      const quoteJson = (await quoteRes.json()) as QuotesApiResponse | { error: string }

      if (!quoteRes.ok || 'error' in quoteJson) {
        throw new Error('error' in quoteJson ? quoteJson.error : '시세 조회에 실패했습니다.')
      }

      const nextBars = quoteJson.ohlcv.map((item) => ({ date: item.time, close: item.close }))
      const closes = nextBars.map((item) => item.close)

      const forecastRes = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: normalizedTicker,
          range,
          horizons,
          closes
        })
      })

      const forecastJson = (await forecastRes.json()) as ForecastResponse | { error: string }
      if (!forecastRes.ok || 'error' in forecastJson) {
        throw new Error('error' in forecastJson ? forecastJson.error : '예측 계산에 실패했습니다.')
      }

      setTicker(normalizedTicker)
      setBars(nextBars)
      setForecast(forecastJson)
    } catch (e) {
      const message = e instanceof Error ? e.message : '오류가 발생했습니다.'
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
            Block bootstrap scenario engine (5D / 20D / 60D)
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
                    Horizons
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    value={horizons}
                    fullWidth
                    onChange={(_, value: number[]) => {
                      const sorted = [...value].sort((a, b) => a - b)
                      setHorizons(sorted)
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
                  onClick={runAnalysis}
                  disabled={loading}
                  sx={{ minWidth: { md: 200 }, py: 1.5 }}
                >
                  분석
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {loading ? <LinearProgress /> : null}

        {error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={runAnalysis} disabled={loading}>
                다시 시도
              </Button>
            }
          >
            {error}
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Last Close
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {lastClose !== null ? lastClose.toFixed(2) : <Skeleton width={120} />}
              </Typography>
            </CardContent>
          </Card>
        </Stack>

        {loading && !forecast ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={180} />
            <Skeleton variant="rounded" height={440} />
          </Stack>
        ) : null}

        {forecast ? <ScenarioPanel data={forecast} /> : null}

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight={700}>
                {ticker || '선택한 종목'} Price + Forecast Bands
              </Typography>
              <PriceChart bars={bars} forecast={forecast ?? undefined} analyst={forecast?.analyst} />
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  )
}
