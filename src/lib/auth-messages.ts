// Only curated messages reach authentication screens. Provider/RPC errors and
// callback query strings are untrusted and must never be shown verbatim.
const accountMessages = new Set([
  "Entre na sua conta para continuar.",
  "Finalize seu cadastro para acessar o SINA.",
  "Sua conta está aguardando aprovação do administrador.",
  "Sua conta está suspensa. Procure o administrador da instituição.",
  "Sua conta ainda não possui uma função acadêmica ativa.",
  "Instituição não encontrada.",
  "Selecione a instituição ativa para continuar.",
]);

export function authErrorMessage(error: unknown, context: "access" | "recovery" = "access"): string {
  const message = error instanceof Error ? error.message :
    typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message : "";
  if (accountMessages.has(message)) return message;
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (normalized.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (normalized.includes("user already registered") || normalized.includes("email_exists")) return "Este e-mail já possui uma conta. Entre ou recupere sua senha.";
  if (normalized.includes("password should be at least") || normalized.includes("weak_password")) return "Escolha uma senha forte com pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial.";
  if (normalized.includes("same password") || normalized.includes("same_password")) return "Escolha uma senha diferente da anterior.";
  if (normalized.includes("rate limit") || normalized.includes("too many requests") || normalized.includes("over_request_rate_limit")) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (normalized.includes("otp_expired") || normalized.includes("token has expired") || normalized.includes("invalid or has expired")) return "Este link de segurança expirou ou já foi usado. Solicite um novo e-mail no SINA.";
  if (normalized.includes("code verifier") || normalized.includes("pkce")) return "Este link foi aberto em outro navegador ou sessão. Solicite um novo e-mail no SINA.";
  if (normalized.includes("redirect") && normalized.includes("not allowed")) return "Não foi possível retornar ao SINA. Solicite um novo link ou contate o suporte da instituição.";
  if (normalized.includes("access_denied") || normalized.includes("cancelled") || normalized.includes("canceled")) return "O acesso com Google não foi concluído. Tente novamente ou entre com e-mail e senha.";
  if (normalized.includes("network") || normalized.includes("fetch")) return "Não foi possível conectar ao SINA. Verifique sua internet e tente novamente.";
  if (normalized.includes("invite") || normalized.includes("convite")) return "Não foi possível aceitar o convite. Confira se entrou com o e-mail convidado ou solicite um novo convite à instituição.";
  return context === "recovery"
    ? "Não foi possível atualizar sua senha. Tente novamente ou solicite um novo link no SINA."
    : "Não foi possível concluir o acesso ao SINA. Tente novamente; se o problema persistir, contate sua instituição.";
}