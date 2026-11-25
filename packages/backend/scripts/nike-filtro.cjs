// Filtro do snapshot NIKE40: camisetas básicas Nike/Jordan + tênis consagrados, cores neutras, adulto.
// Uso (na raiz): node packages/backend/scripts/nike-filtro.cjs data/nike/nike40-2026-11-25.json → gera .selecao.json
const fs = require('fs')
const file = process.argv[2] || 'data/nike/nike40-2026-11-25.json'
const { products, couponPct = 40 } = JSON.parse(fs.readFileSync(file, 'utf8'))

const NEUTRAS = /^(preto|preta|branco|branca|cinza|bege|marrom)$/i
const CLUBES = /corinthians|brasil|psg|paris|barcelona|inter|liverpool|chelsea|tottenham|atl[eé]tico|sele[cç][aã]o|portugal|fran[cç]a|holanda|inglaterra|eua|jogo|torcedor|pr[eé]-jogo|treino|nba|lakers|celtics|warriors|bulls/i
const CAMISETA_BASICA = /sportswear club|swoosh|essential|futura|icon|jumpman|jordan (brand|essentials|flight|air)|dri-fit (seasonal|primary|legend|uv|park|academy)|camiseta nike dri-fit masculina|camiseta nike masculina|camiseta jordan/i
const TENIS = /air force 1|dunk|air max (90|95|97|1|sc|plus|dn|excee|systm|nuaxis)|air jordan (1|4|11)|jordan (1|4|11)|court vision|cortez|blazer|vomero|pegasus|p-6000|v2k|killshot|shox|initiator|ebernon|full force/i

const final = p => +(p.price * (1 - couponPct / 100)).toFixed(2)
const total = p => Math.round((1 - final(p) / (p.oldPrice || p.price)) * 100)

const ok = products.filter(p => p.stock !== false && p.age === 'Adulto' && NEUTRAS.test(p.color || ''))
const camisetas = ok.filter(p => p.sub === 'Camisetas' && !CLUBES.test(p.name) && CAMISETA_BASICA.test(p.name))
const tenis = ok.filter(p => p.sub === 'Tênis' && TENIS.test(p.name) && !/infantil/i.test(p.name))

// 1 por modelo+cor (a mais barata) e no máx. 2 cores por modelo
function pick(list) {
  const byKey = new Map()
  for (const p of list) {
    const k = p.name + '|' + p.color.toLowerCase().replace(/a$/, 'o')
    if (!byKey.has(k) || byKey.get(k).price > p.price) byKey.set(k, p)
  }
  const perModel = {}
  return [...byKey.values()]
    .sort((a, b) => total(b) - total(a))
    .filter(p => (perModel[p.name] = (perModel[p.name] || 0) + 1) <= 2)
}

const out = { camisetas: pick(camisetas), tenis: pick(tenis) }
for (const [k, list] of Object.entries(out)) {
  console.log(`\n== ${k}: ${list.length}`)
  for (const p of list) console.log(`${total(p)}% | ${p.name} (${p.color}) | ${p.oldPrice} → ${final(p)} | ${p.id}`)
}
fs.writeFileSync(file.replace(/\.json$/, '.selecao.json'), JSON.stringify([...out.tenis, ...out.camisetas].map(p => ({ ...p, final: final(p), totalPct: total(p) })), null, 1))
