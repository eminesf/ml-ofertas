// Produtos "hype": console, jogo do momento e peça de PC. Atraem clique e busca no
// Google mesmo com ticket alto e desconto pequeno (PS5 quase nunca cai 20%).

const HYPE_RE = new RegExp(
  [
    'ps5', 'playstation\\s*5', 'playstation\\s*portal', 'dualsense',
    'gta\\s*(6|vi)\\b', 'grand theft auto',
    'xbox\\s*series', 'nintendo\\s*switch', 'steam\\s*deck', 'rog\\s*ally', 'legion\\s*go',
    'placa\\s*de\\s*v[íi]deo', 'geforce', 'rtx\\s*\\d{4}', 'radeon', '\\brx\\s*\\d{4}',
    'processador\\s*(amd|intel)', 'processador.{0,15}(ryzen|core)', 'ryzen\\s*\\d', 'core\\s*(i[3579]|ultra)',
    'ssd\\s*(m\\.?2|nvme)', 'nvme', 'mem[óo]ria\\s*(ram\\s*)?ddr[45]', '\\bddr[45]\\b','placa[-\\s]*m[ãa]e',
    'water\\s*cooler', 'fonte\\s*\\d{3,4}\\s*w',
  ].join('|'),
  'i'
)

// Acessório genérico que só cita o produto ("capa para PS5", "suporte para controle")
const ACCESSORY_RE = /\b(capa|case|película|suporte|adesivo|skin|grip|cabo|carregador|base|protetor)\b.{0,25}\b(para|p\/|compat[íi]vel)/i

// Notebook/PC montado cita processador e placa no título, mas não é "peça"
const EXCLUDE_RE = /\b(notebook|laptop|macbook|chromebook|computador|pc\s+(gamer|completo)|all[-\s]in[-\s]one|tablet)\b/i

export function isHype(title: string): boolean {
  return HYPE_RE.test(title) && !ACCESSORY_RE.test(title) && !EXCLUDE_RE.test(title)
}

export const HYPE_MIN_DISCOUNT = 8
export const HYPE_PRIORITY_BONUS = 3

// Termos para a busca dedicada na Amazon (scrape:hype)
export const HYPE_SEARCH_TERMS = (process.env.HYPE_SEARCH_TERMS ||
  'console playstation 5,gta 6,nintendo switch 2,xbox series,placa de video rtx,processador ryzen,ssd nvme 1tb,memoria ram ddr5,controle dualsense'
).split(',').map(s => s.trim()).filter(Boolean)
