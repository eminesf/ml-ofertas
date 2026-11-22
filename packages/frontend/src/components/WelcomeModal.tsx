'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import TelegramIcon, { TELEGRAM_URL } from './TelegramIcon'
import WhatsAppIcon, { WHATSAPP_GREEN } from './WhatsAppIcon'

const STORAGE_KEY = 'fox_welcomed'
const DURATION = 6000

export default function WelcomeModal({ whatsappUrl }: { whatsappUrl?: string | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (pathname.startsWith('/admin')) return
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      return
    }
    setOpen(true)
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.max(0, 100 - (elapsed / DURATION) * 100))
      if (elapsed >= DURATION) {
        clearInterval(tick)
        setOpen(false)
      }
    }, 50)
    return () => clearInterval(tick)
  }, [pathname])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-5 overflow-hidden p-0 sm:max-w-sm">
        <div className="flex justify-center bg-brand pt-6 pb-4">
          <img src="/logo_png.png" alt="Fox Promoções" className="h-20" />
        </div>
        <div className="space-y-5 px-6 pb-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">Bem-vindo ao Fox Promoções!</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Entre no nosso grupo e receba as melhores promoções direto no celular, antes de todo mundo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {whatsappUrl && (
              <Button asChild size="lg" className={`w-full rounded-xl font-semibold ${WHATSAPP_GREEN}`}>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                  <WhatsAppIcon className="size-5" /> Entrar no grupo do WhatsApp
                </a>
              </Button>
            )}
            <Button
              asChild
              size={whatsappUrl ? 'sm' : 'lg'}
              variant={whatsappUrl ? 'ghost' : 'default'}
              className={whatsappUrl ? 'w-full text-muted-foreground' : 'w-full rounded-xl bg-[#229ED9] text-white hover:bg-[#1c8cc2]'}
            >
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                <TelegramIcon className={whatsappUrl ? 'size-4 text-[#229ED9]' : 'size-5'} /> {whatsappUrl ? 'Prefiro o Telegram' : 'Seguir canal no Telegram'}
              </a>
            </Button>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${whatsappUrl ? 'bg-[#25D366]' : 'bg-[#229ED9]'} transition-[width] duration-75`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
