import * as React from 'react'
import { Body, Button, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { EmailFrame, button, darkModeCss, heading, link, main, text } from './shared'

interface InviteEmailProps { siteName: string; siteUrl: string; confirmationUrl: string }

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head><style>{darkModeCss}</style></Head>
    <Preview>Você recebeu um convite para o {siteName}</Preview>
    <Body style={main}>
      <EmailFrame>
        <Heading style={heading}>Você recebeu um convite</Heading>
        <Text style={text}>
          Uma instituição convidou você para acessar o <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
        </Text>
        <Text style={text}>Aceite o convite para criar sua conta e acessar seu ambiente acadêmico.</Text>
        <Button className="sina-action" style={button} href={confirmationUrl}>Aceitar convite</Button>
        <Text style={{ ...text, fontSize: '12px', margin: '26px 0 0' }}>
          Se você não esperava este convite, ignore esta mensagem.
        </Text>
      </EmailFrame>
    </Body>
  </Html>
)

export default InviteEmail