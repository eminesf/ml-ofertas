// Consentimento de cookies (LGPD): o pixel da Meta só carrega depois de "Aceitar".
// Fica no navegador da pessoa; 'ok' = aceitou, 'no' = recusou, null = ainda não respondeu.

export type Consent = 'ok' | 'no' | null

const KEY = 'fox_cookies'
export const CONSENT_EVENT = 'fox:consent'

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'ok' || v === 'no' ? v : null
  } catch {
    return null
  }
}

export function setConsent(v: 'ok' | 'no') {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    // navegação anônima/bloqueada: vale só para esta página
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: v }))
}
