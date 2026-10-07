<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the SINA presentation as the public first screen at /, and the dashboard behind login at /painel; this follows the requested access sequence.
- Use semantic CSS tokens for SINA's charcoal/sage identity; this preserves the user's chosen visual direction while allowing theme-safe styling.
- Keep academic records in Lovable Cloud with separate user_roles and row-level access; students must only see their own record and teachers only their assigned records.
- New accounts default to student; teacher access is granted administratively, never by selecting a role in the browser, to prevent self-promotion.
- Academic roles are mutually exclusive and assigned by an administrator through a checked database function; admin roles are never editable from the role selector, preventing self-promotion.
- Include the connected Cloud project's public URL and publishable key as build-time fallbacks in Vite; deployment builds may omit VITE_* variables, and browser auth must still initialize.
- Keep Lovable auth email delivery on the scaffolded managed handler and shared SINA template frame; this preserves verified webhook behavior and consistent branding across every auth message.

- Authentication screens render only curated SINA messages through src/lib/auth-messages.ts; provider and RPC errors are untrusted and must not reach users verbatim.
- Keep managed Google OAuth with a public /auth callback and existing finishAuth; this Cloud project requires its broker for session delivery and editor compatibility.
- Read confirmation URL parameters after hydration and verify only on explicit confirmation; SSR must not access window or consume email tokens.
- Preserve the recovery page on sign-out so a successful password reset can show its confirmation before the user returns to login.
