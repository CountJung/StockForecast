'use client'

import { Box, Card, CardContent, Chip, Divider, Stack, Typography, useTheme } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import type { ForecastResponse, ScenarioLabel } from '@/lib/types'

type Props = {
  data: ForecastResponse
}

function formatPercent(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(digits)}%`
}

function formatUpPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatPrice(value: number): string {
  return value.toFixed(1)
}

function scenarioColor(scenario: ScenarioLabel, theme: Theme) {
  if (scenario === 'BULL') return theme.palette.success
  if (scenario === 'BEAR') return theme.palette.error
  return theme.palette.warning
}

export function ScenarioPanel({ data }: Props) {
  const theme = useTheme()

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Scenario outlook
            </Typography>
            <Typography variant="caption" color="text.secondary">
              asOf {new Date(data.asOf).toLocaleString()}
            </Typography>
          </Box>

          <Divider />

          {data.horizons.map((item) => {
            const color = scenarioColor(item.scenario, theme)

            return (
              <Stack key={item.days} spacing={0.9} sx={{ py: 0.2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.2}>
                  <Chip label={`${item.days}D`} size="small" variant="outlined" />

                  <Typography variant="h5" fontWeight={800}>
                    {formatUpPercent(item.pUp)}
                  </Typography>

                  <Chip
                    label={item.scenario}
                    size="small"
                    sx={{
                      bgcolor: color.main,
                      color: color.contrastText,
                      fontWeight: 700
                    }}
                  />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  Median: {formatPercent(item.medianReturn)} · VaR5: {formatPercent(item.var5)} · Band(10-90%):{' '}
                  {formatPrice(item.p10Price)}-{formatPrice(item.p90Price)}
                </Typography>
              </Stack>
            )
          })}

          {data.analyst?.ptAvgProb60d !== undefined ? (
            <Typography variant="body2" color="text.secondary">
              P(Price &gt;= PT Avg, 60D): {(data.analyst.ptAvgProb60d * 100).toFixed(1)}%
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )
}
