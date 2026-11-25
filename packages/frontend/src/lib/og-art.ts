// Utilidades das artes do Instagram (/story/<id> e /post/<id>), geradas com next/og.

// O gerador (satori) só lê PNG/JPEG: troca webp do ML por jpg e embute como data URL
export async function loadImage(url?: string | null): Promise<string | null> {
  if (!url) return null
  const candidates = /mlstatic\.com/.test(url) ? [url.replace(/\.webp(\?.*)?$/i, '.jpg'), url] : [url]
  for (const u of candidates) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(8000) })
      const type = res.headers.get('content-type') || ''
      if (!res.ok || !/image\/(png|jpe?g)/i.test(type)) continue
      const buf = Buffer.from(await res.arrayBuffer())
      return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`
    } catch {
      // tenta a próxima
    }
  }
  return null
}

type Font = { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }

// Nunito (fonte do site) em TTF — o gerador não lê woff2. Cache em memória.
let fontsCache: Promise<Font[]> | null = null
export function loadFonts(): Promise<Font[]> {
  fontsCache ??= (async () => {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900')).text()
    const out: Font[] = []
    for (const m of css.matchAll(/font-weight: (\d+);[\s\S]*?url\(([^)]+\.ttf)\)/g)) {
      out.push({ name: 'Nunito', weight: Number(m[1]) as 700 | 900, style: 'normal', data: await (await fetch(m[2])).arrayBuffer() })
    }
    return out
  })().catch(() => { fontsCache = null; return [] })
  return fontsCache
}

export function shortTitle(title: string, max: number): string {
  return title.length > max ? title.slice(0, max - 3).trimEnd() + '…' : title
}
