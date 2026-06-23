'use client'

export default function BackButton() {
  function handleBack(e: React.MouseEvent<HTMLAnchorElement>) {
    const fromSameSite = document.referrer.includes(window.location.hostname)
    if (fromSameSite && window.history.length > 1) {
      e.preventDefault()
      window.history.back()
    }
  }

  return (
    <a href="/" className="back-btn" onClick={handleBack}>
      ← Voltar às ofertas
    </a>
  )
}
