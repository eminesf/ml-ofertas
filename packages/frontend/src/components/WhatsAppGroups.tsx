'use client'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import WhatsAppIcon from './WhatsAppIcon'
import type { WhatsAppGroupLink } from '@/lib/api'

// Botões de WhatsApp do site (header, rodapé, botão flutuante, boas-vindas) abrem este
// modal para a pessoa escolher o grupo: Tech & TCG ou Achadinhos.
const OPEN_EVENT = 'fox:whatsapp-groups'

export function openWhatsAppGroups(fallbackUrl?: string | null) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { fallbackUrl } }))
}

const ICONS: Record<string, string> = { tech: '🎮', achadinhos: '🛍️' }

export default function WhatsAppGroupsDialog({ groups }: { groups: WhatsAppGroupLink[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onOpen(e: Event) {
      const fallbackUrl = (e as CustomEvent).detail?.fallbackUrl as string | undefined
      // Só um grupo (ou nenhum carregado): vai direto, sem modal
      if (groups.length <= 1) {
        const url = groups[0]?.url || fallbackUrl
        if (url) window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [groups])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <WhatsAppIcon className="size-6 text-[#25D366]" /> Escolha seu grupo
          </DialogTitle>
          <DialogDescription>Promoções na hora, direto no seu WhatsApp. Pode entrar nos dois!</DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5">
          {groups.map(g => (
            <a
              key={g.key}
              href={g.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-[#25D366] hover:bg-[#25D366]/5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-2xl">{ICONS[g.key] || '🦊'}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{g.label}</span>
                <span className="block text-xs text-muted-foreground">{g.description}</span>
              </span>
              <span className="shrink-0 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">Entrar</span>
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
