import type { Metadata } from 'next'
import { Bebas_Neue, Inter, JetBrains_Mono, Fraunces } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-fraunces',
  display: 'swap',
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
    <html
      lang="cs"
      className={`${bebasNeue.variable} ${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className={`${inter.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  )
}
