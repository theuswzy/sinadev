import * as React from 'react'
import { Body, Button, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { EmailFrame, button, darkModeCss, heading, main, text } from './shared'

interface MagicLinkEmailProps { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head><style>{darkModeCss}</style></Head>
    <Preview>Seu link de acesso ao {siteName}</Preview>
    <Body style={main}>
      <EmailFrame>
        <Heading style={heading}>Acesse sua conta</Heading>
        <Text style={text}>Use o botão abaixo para entrar no {siteName}. Este link é temporário e expira em breve.</Text>
        <Button className="sina-action" style={button} href={confirmationUrl}>Entrar no SINA</Button>
        <Text style={{ ...text, fontSize: '12px', margin: '26px 0 0' }}>
          Se você não solicitou este acesso, ignore esta mensagem.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default MagicLinkEmail