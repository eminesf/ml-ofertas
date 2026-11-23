// IndexNow: avisa Bing, Yandex, Seznam, Naver etc. na hora que uma página nova
// entra no site. Chave pública em packages/frontend/public/<INDEXNOW_KEY>.txt.
// O Google não usa IndexNow — ele descobre as páginas pelo sitemap.xml.
import { SITE_URL } from './publish'

const ENDPOINT = 'https://api.indexnow.org/indexnow'
const DEBOUNCE_MS = 60_000

const queue = new Set<string>()
let timer: NodeJS.Timeout | null = null

function enabled(): boolean {
  return !!process.env.INDEXNOW_KEY && !/vercel\.app|localhost/.test(SITE_URL)
}

export async function submitIndexNow(paths: string[]): Promise<number | null> {
  if (!enabled() || paths.length === 0) return null
  const key = process.env.INDEXNOW_KEY!
  const host = new URL(SITE_URL).host
  const urlList = paths.map(p => (p.startsWith('http') ? p : `${SITE_URL}${p}`)).slice(0, 10000)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList }),
    })
    console.log(`[IndexNow] ${urlList.length} URL(s) → HTTP ${res.status}`)
    return res.status
  } catch (err) {
    console.warn('[IndexNow] falhou:', (err as Error).message)
    return null
  }
}

// Enfileira e envia em lote (1 chamada por minuto no máximo)
export function queueIndexNow(path: string): void {
  if (!enabled()) return
  queue.add(path)
  if (timer) return
  timer = setTimeout(() => {
    const batch = [...queue]
    queue.clear()
    timer = null
    void submitIndexNow(batch)
  }, DEBOUNCE_MS)
}
