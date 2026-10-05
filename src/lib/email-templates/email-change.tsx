import * as React from 'react'
import { Body, Button, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { EmailFrame, button, darkModeCss, heading, link, main, text } from './shared'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head><style>{darkModeCss}</style></Head>
    <Preview>Confirme a alteração do seu e-mail no {siteName}</Preview>
    <Body style={main}>
      <EmailFrame>
        <Heading style={heading}>Confirme seu novo e-mail</Heading>
        <Text style={text}>
          Você solicitou alterar o e-mail da sua conta no {siteName} de <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link> para <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Button className="sina-action" style={button} href={confirmationUrl}>Confirmar alteração</Button>
        <Text style={{ ...text, fontSize: '12px', margin: '26px 0 0' }}>
          Se você não fez esta solicitação, proteja sua conta imediatamente.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default EmailChangeEmail