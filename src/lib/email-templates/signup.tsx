import * as React from 'react'
import { Body, Button, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { EmailFrame, button, darkModeCss, heading, link, main, text } from './shared'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head><style>{darkModeCss}</style></Head>
    <Preview>Confirme seu e-mail para acessar o {siteName}</Preview>
    <Body style={main}>
      <EmailFrame>
        <Heading style={heading}>Confirme seu e-mail</Heading>
        <Text style={text}>
          Obrigado por criar sua conta no <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
        </Text>
        <Text style={text}>
          Confirme o endereço <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link> para concluir seu cadastro.
        </Text>
        <Button className="sina-action" style={button} href={confirmationUrl}>Confirmar e-mail</Button>
        <Text style={{ ...text, fontSize: '12px', margin: '26px 0 0' }}>
          Se você não criou esta conta, ignore esta mensagem.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default SignupEmail