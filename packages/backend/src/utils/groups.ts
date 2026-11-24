import { isHype } from './hype'

// Dois grupos de WhatsApp com o mesmo número do bot, cada oferta vai para UM deles:
//  - tech:        "Tech & TCG" (WHATSAPP_GROUP_JID) — eletrônicos, Pokémon/TCG, hype (PS5, GPU…), games, Lego
//  - achadinhos:  "Achadinhos" (WHATSAPP_GROUP_ACHADINHOS_JID) — o resto (casa, moda, beleza…)
// O Telegram (canal único) continua recebendo tudo.
// Post.channel registra o destino: 'whatsapp' (tech, mantém o histórico) e 'whatsapp-achadinhos'.

export type GroupKey = 'tech' | 'achadinhos'

export interface WaGroup {
  key: GroupKey
  label: string
  channel: string // Post.channel
  jid: () => string | undefined
}

export const GROUPS: WaGroup[] = [
  { key: 'tech', label: 'Tech & TCG', channel: 'whatsapp', jid: () => process.env.WHATSAPP_GROUP_JID },
  { key: 'achadinhos', label: 'Achadinhos', channel: 'whatsapp-achadinhos', jid: () => process.env.WHATSAPP_GROUP_ACHADINHOS_JID },
]

export const WHATSAPP_CHANNELS = GROUPS.map(g => g.channel)

export function groupByKey(key: GroupKey): WaGroup {
  return GROUPS.find(g => g.key === key)!
}

// Eletrodoméstico/casa que cai em "eletrônicos" por palavra-chave vai para Achadinhos
const HOME_RE = /\b(aspirador|rob[oô] aspirador|air ?fryer|fritadeira|liquidificador|cafeteira|ventilador|ar[- ]condicionado|geladeira|refrigerador|micro-?ondas|lava[- ]?(lou[çc]as|roupas)|secador|chapinha|escova (alisadora|secadora)|barbeador|aparador de pelos|depilador|balan[çc]a|panela|sanduicheira|purificador|umidificador|l[aâ]mpada|tomada|interruptor)\b/i
// Tech/colecionável que não cai em "eletrônicos": games, Lego, TCG em geral, Funko
const TECH_RE = /\b(lego|funko|hot wheels|yu-?gi-?oh|magic the gathering|one piece card|digimon card|booster|tcg|jogo (para |de )?(ps[45]|xbox|switch|nintendo)|game (ps[45]|xbox)|controle (ps[45]|xbox|dualsense|sem fio)|gamer|kindle|e-?reader|tv\b|smart tv|caixa de som|soundbar)\b/i

// Lojas que vão sempre para Achadinhos, independente do título (ex.: "Tênis Nike Gamer"…)
const ACHADINHOS_PROVIDERS = new Set(['nike', 'stanley'])

export function offerGroup(o: { category?: string | null; title: string; provider?: string | null }): GroupKey {
  if (o.provider && ACHADINHOS_PROVIDERS.has(o.provider)) return 'achadinhos'
  if (o.category === 'pokemon' || isHype(o.title) || TECH_RE.test(o.title)) return 'tech'
  if (HOME_RE.test(o.title)) return 'achadinhos'
  return o.category === 'eletronicos' ? 'tech' : 'achadinhos'
}
