import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'TasteBuds',
  description: 'Weekly Manhattan matching with Supabase authentication.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
