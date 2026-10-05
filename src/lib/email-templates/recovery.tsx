import * as React from 'react'
import { Body, Button, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { EmailFrame, button, darkModeCss, heading, main, text } from './shared'

interface RecoveryEmailProps { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head><style>{darkModeCss}</style></Head>
    <Preview>Redefina sua senha do {siteName}</Preview>
    <Body style={main}>
      <EmailFrame>
        <Heading style={heading}>Redefina sua senha</Heading>
        <Text style={text}>Recebemos uma solicitação para redefinir a senha da sua conta no {siteName}.</Text>
        <Button className="sina-action" style={button} href={confirmationUrl}>Criar nova senha</Button>
        <Text style={{ ...text, fontSize: '12px', margin: '26px 0 0' }}>
          Se você não fez esta solicitação, ignore esta mensagem. Sua senha permanecerá a mesma.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default RecoveryEmail