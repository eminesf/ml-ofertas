'use client'
import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// "Temperatura" da oferta: clicar esquenta (+1), clicar de novo desfaz.
export default function VoteButton({
  offerId,
  initialVotes,
  size = 'sm',
  className,
}: {
  offerId: string
  initialVotes: number
  size?: 'sm' | 'lg'
  className?: string
}) {
  const [votes, setVotes] = useState(initialVotes)
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      setVoted(localStorage.getItem(`vote_${offerId}`) === '1')
    } catch {}
  }, [offerId])

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const endpoint = voted ? 'downvote' : 'vote'
      const res = await fetch(`${API}/api/offers/${offerId}/${endpoint}`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      setVotes(data.upvotes)
      const next = !voted
      setVoted(next)
      try {
        if (next) localStorage.setItem(`vote_${offerId}`, '1')
        else localStorage.removeItem(`vote_${offerId}`)
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  const hot = votes > 10
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={voted}
      title={voted ? 'Remover voto' : 'Essa oferta está quente!'}
      className={cn(
        'relative z-10 inline-flex items-center gap-1 rounded-full border font-semibold tabular-nums transition-colors disabled:opacity-60',
        size === 'lg' ? 'h-10 px-4 text-sm' : 'h-7 px-2.5 text-xs',
        voted
          ? 'border-orange-200 bg-orange-50 text-orange-600'
          : 'bg-card text-muted-foreground hover:border-orange-200 hover:text-orange-600',
        hot && !voted && 'text-orange-600',
        className,
      )}
    >
      <Flame className={cn(size === 'lg' ? 'size-4' : 'size-3.5', voted && 'fill-orange-500 text-orange-500')} />
      {votes}°
    </button>
  )
}
