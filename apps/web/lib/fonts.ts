import { Fraunces } from 'next/font/google'

// Warm, slightly quirky serif for the Stoke wordmark
export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-fraunces',
  display: 'swap',
})
