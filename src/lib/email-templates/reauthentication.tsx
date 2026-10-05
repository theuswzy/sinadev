import * as React from 'react'
import { Body, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { EmailFrame, code, heading, main, text } from './shared'

interface ReauthenticationEmailProps { token: string }

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação do SINA</Preview>
    <Body style={main}>
      <EmailFrame>
        <Heading style={heading}>Confirme sua identidade</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={code}>{token}</Text>
        <Text style={{ ...text, fontSize: '12px', margin: '0' }}>
          O código expira em breve. Se você não fez esta solicitação, ignore esta mensagem.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default ReauthenticationEmail