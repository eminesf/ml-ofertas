import type { Metadata } from 'next'
import { SITE_NAME } from '@/lib/site'
import { INSTAGRAM_URL } from '@/components/InstagramIcon'
import CookieChoice from './CookieChoice'

export const metadata: Metadata = {
  title: 'Política de Privacidade e Cookies',
  description: `Como o ${SITE_NAME} usa cookies e dados de navegação.`,
  alternates: { canonical: '/privacidade' },
}

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-black tracking-tight">Política de Privacidade e Cookies</h1>
      <p className="mt-1 text-sm text-muted-foreground">Atualizada em 25/11/2026</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground">
        <section>
          <h2>Quem somos</h2>
          <p>
            O {SITE_NAME} divulga promoções de lojas como Mercado Livre, Amazon, Shopee, KaBuM!, AliExpress, Nike e Stanley.
            Não vendemos produtos: a compra é feita no site da loja.
          </p>
        </section>

        <section>
          <h2>O que não coletamos</h2>
          <p>
            Não temos cadastro, login nem formulário. Não pedimos nome, e-mail, telefone, CPF ou dados de pagamento.
          </p>
        </section>

        <section>
          <h2>Cookies e tecnologias que usamos</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Essenciais (sempre ativos):</b> guardamos no seu navegador as suas preferências, como votos nas ofertas,
              buscas recentes e a sua escolha sobre cookies. Essas informações não saem do seu aparelho.
            </li>
            <li>
              <b>Contagem de cliques:</b> quando você clica em uma oferta, contamos o clique (oferta, loja e de onde veio, como
              WhatsApp ou Instagram), sem identificar quem clicou.
            </li>
            <li>
              <b>Pixel da Meta (só se você aceitar):</b> usado para medir visitas e mostrar anúncios do {SITE_NAME} no Facebook e no
              Instagram. A Meta pode usar cookies e dados do navegador conforme a{' '}
              <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener noreferrer" className="underline">
                política de privacidade dela
              </a>
              .
            </li>
          </ul>
        </section>

        <section>
          <h2>Links de afiliado</h2>
          <p>
            Os links das ofertas são de afiliado: podemos receber uma comissão quando você compra, sem custo extra. Ao abrir a loja,
            ela pode usar cookies próprios para registrar que a visita veio daqui. Isso segue a política de privacidade de cada loja.
          </p>
        </section>

        <section>
          <h2>Sua escolha</h2>
          <p className="mb-3">Você pode mudar sua decisão sobre o pixel da Meta quando quiser:</p>
          <CookieChoice />
        </section>

        <section>
          <h2>Contato</h2>
          <p>
            Dúvidas ou pedidos sobre seus dados (LGPD): fale com a gente pelo Instagram{' '}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              @fox_promocoes_
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  )
}
