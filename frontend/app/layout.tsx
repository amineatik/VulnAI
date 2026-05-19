// app/layout.tsx
import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'VulnGuard AI',
  description: 'AI-Powered Security Analysis',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon-512.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        {/* ✅ AuthProvider enveloppe toute l'app — résout "useAuth must be used within an AuthProvider" */}
        <AuthProvider>
          {children}
        </AuthProvider>

        {/* ✅ Toaster pour les notifications sonner */}
        <Toaster position="top-right" richColors duration={4000} closeButton />
      </body>
    </html>
  )
}