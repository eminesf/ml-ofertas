// Sessão do admin: o cookie guarda um HMAC derivado do ADMIN_SECRET (nunca o
// segredo em si). Usa Web Crypto para rodar tanto no middleware (edge) quanto
// nas rotas Node.

export const ADMIN_COOKIE = 'admin_token'

export async function adminSessionToken(secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('fox-admin-session-v1'))
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('')
}

// Comparação em tempo constante (não vaza quantos caracteres batem)
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function isValidAdminCookie(value: string | undefined): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET
  if (!secret || !value) return false
  return safeEqual(value, await adminSessionToken(secret))
}
