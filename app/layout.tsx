import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import './globals.css'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-barlow',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-barlow-condensed',
})

export const metadata: Metadata = {
  title: 'TrailStories — Animuj svou trasu',
  description: 'Nahraj GPX a vytvoř animované video story ze své aktivity. 4 vizuální módy, export 1080p.',
  openGraph: {
    title: 'TrailStories',
    description: 'GPX → animované story video',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className={`${barlow.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  )
}
