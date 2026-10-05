# SINA — configuração de confirmação de e-mail

## Objetivo

O SINA usa uma página intermediária em `/auth-continue` para impedir que scanners de segurança de e-mail consumam links de confirmação de uso único.

O fluxo recomendado é:

`e-mail → /auth-continue?token_hash=... → clique do usuário → verifyOtp (POST) → /auth`

Não use `{{ .ConfirmationURL }}` diretamente no botão de confirmação em produção.

## Supabase — Confirm signup

Em **Authentication → Email Templates → Confirm signup**, use:

**Assunto**

`Confirme seu e-mail — SINA`

**Conteúdo**

```html
<h2>Confirme seu e-mail</h2>

<p>Olá!</p>

<p>Sua conta no SINA foi criada. Para concluir o cadastro, confirme seu endereço de e-mail:</p>

<p>
  <a
    href="{{ .SiteURL }}/auth-continue?token_hash={{ .TokenHash }}&type=email"
    style="display:inline-block;padding:12px 20px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;"
  >
    Confirmar meu e-mail
  </a>
</p>

<p>Se você não criou esta conta, ignore esta mensagem.</p>

<p>Atenciosamente,<br>SINA</p>
```

Esse modelo usa `{{ .TokenHash }}` e deixa a verificação real para o navegador, após uma ação explícita do usuário.

## URL Configuration

No Supabase, confirme:

- **Site URL:** domínio oficial de produção do SINA.
- **Redirect URLs:** domínio oficial + `/auth`.
- Se houver ambiente de preview, adicione somente os previews realmente utilizados.

Não adicione curingas amplos sem necessidade.

## E-mail em produção

Para produção, configure um SMTP próprio e um domínio de envio, por exemplo:

`no-reply@seudominio.com`

Configure no provedor de e-mail:

- SPF
- DKIM
- DMARC
- domínio de envio verificado
- tracking de links desativado para e-mails de autenticação

O remetente deve ter identidade consistente com o domínio do SINA.

## Checklist de teste

1. Criar uma conta com um e-mail novo.
2. Confirmar que o e-mail chega.
3. Abrir o e-mail e verificar que o link aponta primeiro para `/auth-continue`.
4. Antes de clicar, abrir a URL em outro navegador/guia: a página deve apenas mostrar o botão.
5. Clicar em **Confirmar meu e-mail**.
6. O SINA deve confirmar a conta e voltar para `/auth`.
7. O usuário deve seguir para o onboarding correto.
8. Tentar clicar novamente no mesmo link: deve ser recusado, pois o token é de uso único.
9. Testar **Reenviar confirmação**.
10. Testar recuperação de senha separadamente.

## Importante

Não coloque `service_role`, senhas SMTP ou qualquer segredo no frontend.

A página `/auth-continue` valida o tipo e o domínio do fluxo e só chama `verifyOtp` depois do clique do usuário.
