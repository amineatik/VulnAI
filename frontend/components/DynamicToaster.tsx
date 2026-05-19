// components/DynamicToaster.tsx
'use client'

import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'

export default function DynamicToaster() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <Toaster position="top-right" richColors />
}