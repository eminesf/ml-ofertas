'use client'
import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function VoteButton({ offerId, initialVotes }: { offerId: string; initialVotes: number }) {
  const [votes, setVotes] = useState(initialVotes)
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setVoted(localStorage.getItem(`vote_${offerId}`) === '1')
  }, [offerId])

  async function toggle() {
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
      if (next) localStorage.setItem(`vote_${offerId}`, '1')
      else localStorage.removeItem(`vote_${offerId}`)
    } finally {
      setLoading(false)
    }
  }

  const color = votes > 10 ? '#ea580c' : votes > 0 ? '#f97316' : votes < 0 ? '#3b82f6' : '#bbb'

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={voted ? 'Remover voto' : 'Votar nessa oferta'}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        background: 'none', border: 'none', cursor: loading ? 'wait' : 'pointer',
        padding: '6px 4px', borderRadius: 8, transition: 'opacity 0.15s',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 20, color: voted ? '#ea580c' : '#ccc', lineHeight: 1, transition: 'color 0.15s' }}>
        ▲
      </span>
      <span style={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1 }}>
        {votes}°
      </span>
    </button>
  )
}
