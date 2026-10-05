import * as React from 'react'

import { Container, Hr, Section, Text } from '@react-email/components'

export const emailColors = {
  canvas: '#ffffff',
  panel: '#f3f4f1',
  charcoal: '#1c1e20',
  graphite: '#3b4240',
  sage: '#9ab978',
  sageDark: '#506a3e',
  border: '#dfe3da',
}

export const main = {
  backgroundColor: emailColors.canvas,
  color: emailColors.charcoal,
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: '0',
  padding: '32px 12px',
}

export const container = {
  backgroundColor: emailColors.panel,
  border: `1px solid ${emailColors.border}`,
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '560px',
  overflow: 'hidden',
}

export const content = { padding: '32px' }

export const heading = {
  color: emailColors.charcoal,
  fontSize: '24px',
  fontWeight: '700' as const,
  lineHeight: '1.25',
  margin: '0 0 18px',
}

export const text = {
  color: emailColors.graphite,
  fontSize: '15px',
  lineHeight: '1.65',
  margin: '0 0 20px',
}

export const link = { color: emailColors.sageDark, textDecoration: 'underline' }

export const button = {
  backgroundColor: emailColors.charcoal,
  border: `1px solid ${emailColors.charcoal}`,
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '700' as const,
  padding: '13px 20px',
  textDecoration: 'none',
}

export const code = {
  backgroundColor: emailColors.charcoal,
  borderRadius: '6px',
  color: emailColors.sage,
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: '700' as const,
  letterSpacing: '6px',
  margin: '0 0 26px',
  padding: '18px 20px',
  textAlign: 'center' as const,
}

export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .sina-action { background-color: #9ab978 !important; border-color: #9ab978 !important; color: #1c1e20 !important; }
  }
  [data-ogsc] .sina-action { background-color: #9ab978 !important; border-color: #9ab978 !important; color: #1c1e20 !important; }
  [data-ogsb] .sina-action { background-color: #9ab978 !important; border-color: #9ab978 !important; color: #1c1e20 !important; }
`

export function EmailHeader() {
  return (
    <Section style={{ backgroundColor: emailColors.charcoal, padding: '24px 32px' }}>
      <Text style={{ color: emailColors.sage, fontSize: '24px', fontWeight: '700', margin: '0' }}>
        SINA
      </Text>
      <Text style={{ color: '#f3f4f1', fontSize: '12px', lineHeight: '1.5', margin: '6px 0 0' }}>
        Sistema Digital para Acompanhamento de Dados Acadêmicos
      </Text>
    </Section>
  )
}

export function EmailFooter() {
  return (
    <Section style={{ padding: '0 32px 28px' }}>
      <Hr style={{ borderColor: emailColors.border, margin: '0 0 18px' }} />
      <Text style={{ color: '#6c726d', fontSize: '12px', lineHeight: '1.5', margin: '0' }}>
        Esta é uma mensagem automática de segurança do SINA.
      </Text>
    </Section>
  )
}

export function EmailFrame({ children }: { children: React.ReactNode }) {
  return (
    <Container style={container}>
      <EmailHeader />
      <Section style={content}>{children}</Section>
      <EmailFooter />
    </Container>
  )
}