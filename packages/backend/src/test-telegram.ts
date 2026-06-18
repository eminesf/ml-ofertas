import './env'
import { sendMessage, sendPhoto } from './channels/telegram'

async function main() {
  console.log('Bot token:', process.env.TELEGRAM_BOT_TOKEN?.slice(0, 20) + '...')
  console.log('Channel ID:', process.env.TELEGRAM_CHANNEL_ID)

  // Teste 1: mensagem de texto
  const ok1 = await sendMessage(
    `🔥 <b>Teste do FuchsOfertas Bot</b>\n\n✅ Bot funcionando corretamente!\n⚡ Canal configurado com sucesso.`
  )
  console.log(ok1 ? '✅ Mensagem de texto enviada!' : '❌ Falha na mensagem de texto')

  // Teste 2: foto com legenda
  const caption = [
    '🔥 <b>Monitor LG Ultragear 27"</b>',
    '',
    '💰 De: <s>R$ 1.098,00</s> → <b>R$ 797,00</b> (-27%)',
    '⭐ Avaliação: 4.9',
    '',
    '👉 <a href="https://www.mercadolivre.com.br/p/MLB64311324?matt_tool=28042140&matt_word=fuchsecommerce">Comprar agora</a>',
    '',
    '📌 Oferta real com desconto verificado',
  ].join('\n')

  const ok2 = await sendPhoto(
    'https://http2.mlstatic.com/D_Q_NP_2X_629075-MLA104879398469_012026-AB.webp',
    caption
  )
  console.log(ok2 ? '✅ Foto com legenda enviada!' : '❌ Falha na foto')
}

main().catch(console.error)

