const RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'pokemon',
    keywords: [
      'pokémon', 'pokemon', 'pikachu', 'charizard', 'eevee', 'elite trainer box', 'treinador avançado',
    ],
  },
  {
    category: 'eletronicos',
    keywords: [
      'celular', 'smartphone', 'iphone', 'notebook', 'macbook',
      'tablet ', 'ipad',                        // 'tablet ' com espaço evita "tabletes" (suplemento)
      'smart tv', 'tv 4k', 'tv 55', 'tv 65', 'tv 43', 'tv 32', 'monitor ',
      'headphone', 'fone de ouvido', 'fone bluetooth', 'earphone', 'airpod', 'tws ',
      'câmera fotográfica', 'câmera de ação', 'câmera de segurança', 'câmera inteligente',
      'drone', 'impressora', 'roteador',
      'ssd ', 'hd externo', 'memória ram', 'placa de vídeo', 'processador', 'cooler cpu',
      'teclado gamer', 'mouse gamer',
      'caixa de som', 'soundbar', 'speaker ',
      'powerbank', 'carregador sem fio', 'hub usb', 'adaptador hdmi',
      'interruptor inteligente', 'lâmpada inteligente', 'tomada inteligente',
      'playstation', 'xbox', 'nintendo switch', 'console ',
      'projetor ', 'smart box', 'nobreak',
      'alto-falante', 'alto falante', 'smartwatch', 'smart watch', 'galaxy watch', 'apple watch',
      'headset', 'webcam', 'pendrive', 'cartão de memória', 'cabo usb', 'carregador ',
      'pen drive', 'ventoinha', 'air cooler', 'water cooler', 'placa-mãe', 'placa mãe', 'gabinete', 'fonte atx',
      'mousepad', 'mouse pad', 'deskpad', 'desk mat', 'microfone', 'cabo hdmi', 'cabo displayport', 'mesa controladora',
      'antivírus', 'kaspersky', 'echo dot', 'alexa', 'smart speaker', 'mouse ', 'teclado ',
      // títulos sem a palavra-chave clássica (iam para Achadinhos como "geral" — 25/11/2026)
      'tablet,', 'tablet.', 'matepad', 'galaxy tab', 'redmi pad', 'xiaomi pad', 'galaxy book', 'laptop', 'chromebook', 'ultrabook',
      'odyssey', 'qhd', 'ultrawide', '144hz', '165hz', '180hz', '240hz', 'g-sync', 'freesync', 'ips 27', 'ips 24',
      '80 plus', 'fonte gamer', 'fonte msi', 'fonte corsair', 'fonte xpg', 'fonte mancer', 'fonte redragon',
      'gps', 'velocímetro', 'smartband', 'smart band', 'kindle', 'e-reader', 'chromecast', 'fire tv', 'tv box',
    ],
  },
  {
    category: 'esporte',
    keywords: [
      'whey', 'proteína', 'creatina', 'pré-treino', 'pre-treino', 'suplemento',
      'bcaa', 'glutamina', 'termogênico', 'hipercalórico', 'aminoácido',
      'colágeno hidrolisado', 'omega 3', 'ômega 3', 'multivitamin',
      'halter', 'anilha', 'musculação', 'academia',
      'bicicleta ergométrica', 'corda de pular', 'luva de treino', 'luva de box',
      'caneleira', 'colete de treino', 'camiseta dry-fit', 'tênis de corrida',
      'estação de musculação',
    ],
  },
  {
    category: 'moda',
    keywords: [
      'camiseta', 'camisa ', 'calça jeans', 'calça jogger', 'calça social',
      'vestido', 'blusa ', 'moletom', 'jaqueta', 'casaco ', 'bota ',
      'tênis ', 'sandália', 'sapato', 'meia ', 'cueca', 'sutiã',
      'pijama', 'shorts ', 'bermuda', 'polo ', 'regata ', 'cinto ', 'carteira ',
      'bolsa ', 'mochila ', 'óculos de sol', 'relógio ',
      'festa junina', 'fantasia ', 'roupa infantil', 'bobojaco',
    ],
  },
  {
    category: 'beleza',
    keywords: [
      'shampoo', 'condicionador', 'mascara capilar', 'máscara capilar',
      'protetor solar', 'hidratante', 'creme para rosto', 'creme para pele',
      'sérum', 'serum', 'maquiagem', 'batom', 'base maquiagem', 'blush',
      'bronzeador', 'desodorante', 'sabonete', 'perfume ', 'colônia ',
      'secador de cabelo', 'chapinha', 'prancha de cabelo', 'babyliss',
      'escova secadora', 'escova alisadora',
      'presente dia das mães', 'kit eudora', 'kit natura',
    ],
  },
  {
    category: 'casa',
    keywords: [
      'panela', 'frigideira', 'liquidificador', 'batedeira', 'cafeteira',
      'airfryer', 'air fryer', 'fritadeira elétrica', 'micro-ondas',
      'geladeira', 'fogão', 'cooktop', 'aspirador', 'vassoura', 'esfregão',
      'prato ', 'jogo de pratos', 'colchão', 'travesseiro', 'edredom',
      'sofá', 'armário', 'guarda-roupa', 'prateleira', 'cesto ',
      'ferro de passar', 'secadora de roupa', 'máquina de lavar',
      'panificadora', 'sanduicheira', 'lençol', 'cobertor', 'manta ',
      'mesa dobrável', 'cadeira de escritório', 'escrivaninha',
      'saco a vácuo', 'sacos a vácuo', 'caixa de papelão', 'caixa organizadora',
      'kit cozinha', 'conjunto de panelas', 'jogo de panelas',
      'ventilador', 'umidificador', 'purificador de ar',
      'copo térmico', 'garrafa térmica', 'caneca térmica', 'quencher', 'tumbler', 'garrafa de água',
      'pote hermético', 'porta-temperos', 'luminária', 'cortina', 'tapete ',
    ],
  },
  {
    category: 'automotivo',
    keywords: [
      'cera automotiva', 'tapete automotivo', 'câmera de ré', 'suporte veicular',
      'central multimídia', 'kit lavagem carro', 'shampoo automotivo',
      'pneu ', 'amortecedor', 'filtro de ar automotivo',
      'para-choque', 'parachoque', 'farol ', 'lanterna traseira', 'retrovisor', 'capa de banco',
    ],
  },
  {
    category: 'ferramentas',
    keywords: [
      'furadeira', 'parafusadeira', 'serra circular', 'serra mármore',
      'chave de fenda', 'chave combinada', 'alicate', 'martelo',
      'fita métrica', 'nível a laser', 'trena ', 'lixadeira', 'esmerilhadeira',
      'kit de ferramentas', 'caixa de ferramentas',
    ],
  },
]

// Livros ficam fora do canal (não convertem). Amazon: ASIN de livro é o ISBN-10
// (só dígitos/X); produtos comuns começam com "B0".
export function isBook(title: string, externalId?: string): boolean {
  if (externalId && /^AMZN-\d{9}[\dX]$/i.test(externalId)) return true
  if (/\b(livros?|capa comum|capa dura|mangás?|hist[óo]ria em quadrinhos|box com \d+ livros|edi[çc][ãa]o de luxo|ebook|kindle unlimited|isbn|editora)\b/i.test(title)) return true
  // Shopee: "TÍTULO - SOBRENOME; SOBRENOME" (autores separados por ;)
  const authors = title.match(/\s-\s([A-ZÀ-Ú][A-ZÀ-Ú'.-]+(?:,\s?[A-ZÀ-Ú][\wÀ-ú'.]*)?(?:;\s?[A-ZÀ-Ú][A-ZÀ-Ú'.-]+(?:,\s?[A-ZÀ-Ú][\wÀ-ú'.]*)?)+)/)?.[1]
  // "PRETO; BRANCO", "P; M; G" são variações, não autores
  return !!authors && !/\b(PRET[OA]|BRANC[OA]|AZUL|VERDE|ROSA|CINZA|BEGE|VERMELH[OA]|AMAREL[OA]|ROX[OA]|MARROM|LILÁS|NUDE|PP|P|M|G|GG|XG|EXG|UNICO|ÚNICO)\b/.test(authors)
}

export function classifyCategory(title: string): string {
  const t = title.toLowerCase()
  for (const rule of RULES) {
    if (rule.keywords.some(k => t.includes(k))) return rule.category
  }
  return 'geral'
}
