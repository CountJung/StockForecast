import type { Metadata } from 'next'
import { Providers } from '@/app/providers'

export const metadata: Metadata = {
  title: 'Stock Forecast',
  description: 'Quote fetch + GBM Monte Carlo forecast dashboard'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
