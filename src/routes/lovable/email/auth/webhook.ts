import * as React from 'react'
import { createAuthEmailHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "SINA"
const SENDER_DOMAIN = "notify.sinna.cloud"
const ROOT_DOMAIN = "sinna.cloud"
const FROM_DOMAIN = "sinna.cloud"
const SITE_URL = `https://${ROOT_DOMAIN}`

function protectAuthActionUrl(rawUrl: string): string {
  try {
    const target = new URL(rawUrl)
    if (target.protocol !== 'https:' || target.hostname !== ROOT_DOMAIN) {
      return rawUrl
    }

    const wrapper = new URL('/auth-continue', SITE_URL)
    wrapper.searchParams.set('url', target.toString())
    return wrapper.toString()
  } catch {
    return rawUrl
  }
}

// The SDK handler owns verification, dispatch, and retry semantics; this file
// owns only the email decisions: subjects, templates, and per-type props.
export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const handler = createAuthEmailHandler({
          apiKey: process.env['LOVABLE_API_KEY']!,
          from: { name: SITE_NAME, address: `noreply@${FROM_DOMAIN}` },
          senderDomain: SENDER_DOMAIN,
          sendUrl: process.env['LOVABLE_SEND_URL'],
          emails: {
            signup: {
              subject: 'Confirme seu e-mail — SINA',
              render: (data) =>
                React.createElement(SignupEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  recipient: data.email,
                  confirmationUrl: protectAuthActionUrl(data.url),
                }),
            },
            invite: {
              subject: 'Você recebeu um convite — SINA',
              render: (data) =>
                React.createElement(InviteEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  confirmationUrl: protectAuthActionUrl(data.url),
                }),
            },
            magiclink: {
              subject: 'Seu link de acesso — SINA',
              render: (data) =>
                React.createElement(MagicLinkEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl: protectAuthActionUrl(data.url),
                }),
            },
            recovery: {
              subject: 'Redefina sua senha — SINA',
              render: (data) =>
                React.createElement(RecoveryEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl: protectAuthActionUrl(data.url),
                }),
            },
            email_change: {
              subject: 'Confirme seu novo e-mail — SINA',
              render: (data) =>
                React.createElement(EmailChangeEmail, {
                  siteName: SITE_NAME,
                  oldEmail: data.old_email ?? '',
                  email: data.email,
                  newEmail: data.new_email ?? '',
                  confirmationUrl: protectAuthActionUrl(data.url),
                }),
            },
            reauthentication: {
              subject: 'Seu código de verificação — SINA',
              render: (data) =>
                React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
            },
          },
        })
        return handler(request)
      },
    },
  },
})
