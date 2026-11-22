'use client'
import { useState } from 'react'
import { Check, Copy, TicketPercent } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  code: string
  variant: 'badge' | 'box'
  amount?: string
  minValue?: number | null
}

export default function CouponCopy({ code, variant, amount, minValue }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (variant === 'badge') {
    return (
      <button
        type="button"
        onClick={copy}
        title={`Copiar cupom ${code}`}
        className={cn(
          'relative z-10 inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold transition-colors',
          copied ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-800 hover:bg-amber-200',
        )}
      >
        {copied ? <Check className="size-3" /> : <TicketPercent className="size-3" />}
        {copied ? 'Copiado!' : minValue ? `Cupom · mín. R$${minValue.toFixed(0)}` : 'Cupom'}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <TicketPercent className="size-4" /> Cupom de desconto
        {amount && <span className="font-medium text-amber-700">· {amount}</span>}
      </p>
      <button
        type="button"
        onClick={copy}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-4 py-2.5 font-mono text-base font-bold tracking-wide transition-colors',
          copied ? 'border-success/40 text-success' : 'border-amber-300 text-amber-900 hover:bg-amber-100/50',
        )}
      >
        <span className="truncate">{code}</span>
        <span className="flex shrink-0 items-center gap-1 font-sans text-xs font-semibold">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copiado' : 'Copiar'}
        </span>
      </button>
      <p className="mt-2 text-xs text-amber-800">
        {copied ? 'Código copiado! Cole no checkout da loja.' : 'Toque no código para copiar e aplique no checkout.'}
      </p>
      {minValue ? (
        <p className="mt-1 text-xs font-semibold text-amber-900">
          Válido para compras acima de R$ {minValue.toFixed(2).replace('.', ',')} no carrinho
        </p>
      ) : null}
    </div>
  )
}
