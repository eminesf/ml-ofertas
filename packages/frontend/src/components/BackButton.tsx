'use client'

import { ArrowLeft } from 'lucide-react'

export default function BackButton() {
  function handleBack(e: React.MouseEvent<HTMLAnchorElement>) {
    const fromSameSite = document.referrer.includes(window.location.hostname)
    if (fromSameSite && window.history.length > 1) {
      e.preventDefault()
      window.history.back()
    }
  }

  return (
    <a
      href="/"
      onClick={handleBack}
      className="mb-4 inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Voltar
    </a>
  )
}
