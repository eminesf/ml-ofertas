'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import TelegramIcon, { TELEGRAM_URL } from './TelegramIcon'

const STORAGE_KEY = 'fox_welcomed'
const DURATION = 6000

export default function WelcomeModal() {
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
          <img src="/logo_png.png" alt="Fox Ofertas" className="h-20" />
        </div>
        <div className="space-y-5 px-6 pb-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">Bem-vindo ao Fox Ofertas!</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Siga nosso canal no Telegram e receba as melhores promoções no celular, antes de todo mundo.
            </DialogDescription>
          </DialogHeader>
          <Button asChild size="lg" className="w-full rounded-xl bg-[#229ED9] text-white hover:bg-[#1c8cc2]">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              <TelegramIcon className="size-5" /> Seguir canal no Telegram
            </a>
          </Button>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[#229ED9] transition-[width] duration-75" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
