'use client'
import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

const DELAY_MS = 1500

export default function GoToStore({ target, coupon, store }: { target: string; coupon: string; store: string }) {
  const [copiedAgain, setCopiedAgain] = useState(false)

  useEffect(() => {
    // Garante o cupom na área de transferência também nesta aba (se o navegador deixar)
    if (coupon) navigator.clipboard?.writeText(coupon).catch(() => {})
    const t = setTimeout(() => window.location.replace(target), DELAY_MS)
    return () => clearTimeout(t)
  }, [target, coupon])

  async function copyAgain() {
    try { await navigator.clipboard.writeText(coupon) } catch {}
    setCopiedAgain(true)
  }

  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-4 py-10">
      <style>{`@keyframes fox-progress { from { width: 0 } to { width: 100% } }`}</style>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
        <img src="/logo-fox-sm.webp" alt="Fox Promoções" width={60} height={54} className="mx-auto mb-4 h-12 w-auto" />
        {coupon ? (
          <>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-8" strokeWidth={3} />
            </span>
            <p className="mt-3 text-lg font-extrabold">Cupom copiado!</p>
            <button
              type="button"
              onClick={copyAgain}
              className="mx-auto mt-3 flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2 font-mono text-lg font-bold tracking-wide text-amber-900"
              title="Copiar de novo"
            >
              {coupon} {copiedAgain ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
            <p className="mt-3 text-sm text-muted-foreground">Cole o código no carrinho para ganhar o desconto.</p>
          </>
        ) : (
          <p className="text-lg font-extrabold">Indo para a oferta</p>
        )}

        <div className="mt-6">
          <p className="text-sm font-semibold">Abrindo {store || 'a loja'}…</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ animation: `fox-progress ${DELAY_MS}ms linear forwards` }} />
          </div>
        </div>

        <a href={target} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
          Ir agora <ExternalLink className="size-3.5" />
        </a>
      </div>
    </main>
  )
}
