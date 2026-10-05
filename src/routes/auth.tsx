import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, GraduationCap, LockKeyhole, MailCheck, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  acceptInstitutionInvitation,
  ensureAccountOnboarding,
  getAccountOnboardingState,
  getRole,
  resubmitRoleRequest,
  searchSchoolDirectory,
  ensureAccountOnboardingForSchool,
  type OnboardingState,
  type SchoolDirectoryEntry,
} from "@/lib/sina-data";

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (normalized.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (normalized.includes("user already registered")) return "Este e-mail já possui uma conta.";
  if (normalized.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (normalized.includes("email rate limit")) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (normalized.includes("network") || normalized.includes("fetch")) return "Não foi possível conectar ao serviço. Verifique sua internet e tente novamente.";
  return message || "Não foi possível concluir a operação.";
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso — SINA" },
      { name: "description", content: "Entre ou crie sua conta para acessar sua área acadêmica no SINA." },
      { property: "og:title", content: "Acesso — SINA" },
      { property: "og:description", content: "Acesso seguro às áreas acadêmicas do SINA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "login" | "signup" | "forgot" | "pending";
type RequestedRole = "student" | "teacher";
type SignupStep = 1 | 2 | 3;

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function roleLabel(role: RequestedRole | null) {
  return role === "teacher" ? "Professor" : "Aluno";
}

function roleDescription(role: RequestedRole) {
  return role === "teacher"
    ? "Acesso ao diário, turmas, avaliações e lançamentos."
    : "Acesso às notas, frequência, atividades e calendário.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestedRole | null>(null);
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<SchoolDirectoryEntry | null>(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolNetwork, setSchoolNetwork] = useState<SchoolDirectoryEntry["network_type"] | "all">("all");
  const [schoolResults, setSchoolResults] = useState<SchoolDirectoryEntry[]>([]);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [pendingState, setPendingState] = useState<OnboardingState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signupConfirmationOpen, setSignupConfirmationOpen] = useState(false);
  const [signupConfirmationEmail, setSignupConfirmationEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [needsConfirmationResend, setNeedsConfirmationResend] = useState(false);

  async function finishAuth(explicitRole?: RequestedRole, explicitSchoolId?: string) {
    const inviteToken = window.localStorage.getItem("sina-institution-invite-token");
    if (inviteToken) {
      try {
        await acceptInstitutionInvitation(inviteToken);
        window.localStorage.removeItem("sina-institution-invite-token");
        setMessage("Convite aceito. Sua conta foi vinculada à instituição.");
      } catch (error) {
        setMessage(authErrorMessage(error));
        throw error;
      }
    }

    const schoolId = explicitSchoolId || window.localStorage.getItem("sina-school-directory-id") || undefined;
    window.localStorage.removeItem("sina-school-directory-id");

    // No login normal, contas já aprovadas não precisam passar novamente pelo
    // fluxo de onboarding. Resolve a área diretamente pela função ativa.
    // O onboarding continua sendo usado no cadastro, inclusive para Google.
    if (!explicitRole) {
      const role = await getRole();
      await navigate({
        to: role === "admin" ? "/admin" : role === "teacher" ? "/professor" : "/aluno",
        replace: true,
      });
      return;
    }

    const state = schoolId
      ? await ensureAccountOnboardingForSchool(explicitRole, schoolId)
      : await ensureAccountOnboarding(explicitRole);

    if (state.status === "pending") {
      setPendingState(state);
      setMode("pending");
      return;
    }
    if (state.status === "suspended") {
      setMessage("Sua conta está suspensa. Procure o administrador da instituição.");
      setMode("login");
      return;
    }

    const role = state.role;
    if (!role) throw new Error("Sua conta ainda não possui uma função acadêmica ativa.");
    await navigate({
      to: role === "admin" ? "/admin" : role === "teacher" ? "/professor" : "/aluno",
      replace: true,
    });
  }

  useEffect(() => {
    if (mode !== "signup") return;

    let cancelled = false;
    setSchoolLoading(true);

    const timer = window.setTimeout(() => {
      void searchSchoolDirectory(schoolSearch, schoolNetwork === "all" ? undefined : schoolNetwork).then((items) => {
        if (!cancelled) setSchoolResults(items);
      }).catch(() => {
        if (!cancelled) setSchoolResults([]);
      }).finally(() => {
        if (!cancelled) setSchoolLoading(false);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, schoolSearch, schoolNetwork]);

  useEffect(() => {
    let cancelled = false;

    async function restoreAuthFromEmailConfirmation() {
      // Links de confirmação do Supabase podem chegar em dois formatos:
      // - ?code=... (PKCE)
      // - #access_token=... (implicit flow)
      // O cliente Supabase trata o hash automaticamente, mas o fluxo PKCE
      // precisa trocar explicitamente o código por uma sessão.
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        // Remove o código da barra de endereço para impedir reutilização
        // acidental do link e deixar a URL limpa.
        url.searchParams.delete("code");
        url.searchParams.delete("type");
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      }

      return supabase.auth.getSession();
    }

    // Usa a sessão persistida localmente para evitar uma chamada de rede
    // extra só para descobrir se o usuário já está autenticado.
    void restoreAuthFromEmailConfirmation().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setMessage(authErrorMessage(error));
        setCheckingSession(false);
        return;
      }

      const user = data.session?.user;
      if (!user) {
        setCheckingSession(false);
        return;
      }

      setBusy(true);
      const storedRole = window.localStorage.getItem("sina-requested-role");
      const storedSchoolId = window.localStorage.getItem("sina-school-directory-id");
      const metadataRole = user.user_metadata?.['requested_role'];
      const metadataSchoolId = user.user_metadata?.['school_directory_id'];

      try {
        await finishAuth(
          storedRole === "teacher" || storedRole === "student"
            ? storedRole
            : metadataRole === "teacher" || metadataRole === "student"
              ? metadataRole
              : undefined,
          storedSchoolId || (typeof metadataSchoolId === "string" ? metadataSchoolId : undefined),
        );
      } catch (error) {
        if (!cancelled) setMessage(authErrorMessage(error));
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
          setBusy(false);
        }
      }
    });

    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setNeedsConfirmationResend(false);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage("Se este e-mail estiver cadastrado, você receberá um link de recuperação.");
        return;
      }

      if (mode === "signup") {
        if (!requestedRole) {
          setMessage("Escolha se você é aluno ou professor antes de criar a conta.");
          setSignupStep(1);
          return;
        }
        if (!selectedSchool) {
          setMessage("Selecione sua instituição antes de criar a conta.");
          setSignupStep(2);
          return;
        }
        const checks = passwordChecks(password);
        if (!name.trim()) {
          setMessage("Informe seu nome completo.");
          setSignupStep(3);
          return;
        }
        if (!checks.length || !checks.upper || !checks.lower || !checks.number || !checks.special) {
          setMessage("Crie uma senha com pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial.");
          setSignupStep(3);
          return;
        }
        if (password !== passwordConfirm) {
          setMessage("As senhas não coincidem.");
          setSignupStep(3);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              display_name: name.trim(),
              requested_role: requestedRole,
              school_directory_id: selectedSchool.id,
            },
          },
        });
        if (error) throw error;

        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setMessage("Este e-mail já possui uma conta. Entre com sua senha ou use a opção de recuperação de senha.");
          setMode("login");
          return;
        }

        if (data.session) {
          await finishAuth(requestedRole, selectedSchool.id);
        } else {
          setSignupConfirmationEmail(email.trim());
          setSignupConfirmationOpen(true);
          setMessage("");
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setNeedsConfirmationResend(true);
        }
        throw error;
      }
      await finishAuth();
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resendSignupConfirmation(targetEmail = email) {
    const normalizedEmail = targetEmail.trim();
    if (!normalizedEmail) {
      setMessage("Informe seu e-mail para reenviar a confirmação.");
      return;
    }

    setResendBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
      setSignupConfirmationEmail(normalizedEmail);
      setSignupConfirmationOpen(true);
      setMessage("Novo e-mail de confirmação enviado. Verifique também o spam.");
      setNeedsConfirmationResend(false);
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setResendBusy(false);
    }
  }
  async function google() {
    setMessage("");
    setBusy(true);

    const isSignup = mode === "signup";
    if (isSignup) {
      if (!requestedRole) {
        setMessage("Escolha se você é aluno ou professor antes de continuar.");
        setBusy(false);
        return;
      }
      if (!selectedSchool) {
        setMessage("Selecione sua instituição antes de continuar.");
        setBusy(false);
        return;
      }
      window.localStorage.setItem("sina-requested-role", requestedRole);
      window.localStorage.setItem("sina-school-directory-id", selectedSchool.id);
    } else {
      window.localStorage.removeItem("sina-requested-role");
      window.localStorage.removeItem("sina-school-directory-id");
    }

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });

    if (result.error) {
      window.localStorage.removeItem("sina-requested-role");
      window.localStorage.removeItem("sina-school-directory-id");
      setMessage(authErrorMessage(result.error));
      setBusy(false);
      return;
    }

    if (!result.redirected) {
      try {
        await finishAuth(
          isSignup ? requestedRole ?? undefined : undefined,
          isSignup ? selectedSchool?.id : undefined,
        );
      } catch (error) {
        setMessage(authErrorMessage(error));
      } finally {
        setBusy(false);
      }
    }
  }

  async function changePendingRole(role: RequestedRole) {
    setBusy(true);
    setMessage("");
    try {
      await resubmitRoleRequest(role);
      const state = await getAccountOnboardingState();
      setRequestedRole(role);
      setPendingState(state);
      setMessage(`Nova solicitação enviada como ${roleLabel(role)}.`);
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "login"
      ? "Entrar no SINA"
      : mode === "signup"
        ? "Criar conta"
        : mode === "forgot"
          ? "Recuperar senha"
          : "Aguardando aprovação";

  const description =
    mode === "login"
      ? "Acesse seu espaço acadêmico e acompanhe suas informações."
      : mode === "signup"
        ? "Crie sua conta e indique como você participa da instituição."
        : mode === "forgot"
          ? "Informe seu e-mail e enviaremos as instruções para redefinir sua senha."
          : "Seu cadastro foi recebido. O administrador da instituição precisa aprovar seu acesso antes da entrada na área acadêmica.";

  return (
    <div className="min-h-screen bg-background" aria-busy={busy || checkingSession}>
      {(busy || checkingSession) && (
        <div className="fixed inset-x-0 top-0 z-[100] h-1 bg-primary/20" role="progressbar" aria-label="Processando">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
      )}

      {signupConfirmationOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-confirmation-title"
          aria-describedby="signup-confirmation-description"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="bg-primary px-6 py-5 text-primary-foreground sm:px-7">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-foreground/15">
                  <MailCheck className="size-6" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-80">Cadastro concluído</p>
                  <h2 id="signup-confirmation-title" className="mt-1 font-display text-2xl font-semibold">
                    Conta criada com sucesso!
                  </h2>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-6 sm:p-7">
              <div>
                <p id="signup-confirmation-description" className="text-sm leading-6 text-foreground">
                  Enviamos um e-mail de confirmação para:
                </p>
                <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold break-all">
                  {signupConfirmationEmail}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-secondary/60 p-4">
                <p className="text-sm font-semibold">O que fazer agora?</p>
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Abra o e-mail do SINA e clique no link de confirmação.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Depois, volte ao SINA e entre com seu e-mail e senha.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {requestedRole === "teacher"
                        ? "Seu cadastro ficará aguardando aprovação do administrador da instituição. Depois da aprovação, você poderá entrar na área do professor."
                        : "Depois da confirmação, sua conta de aluno já poderá entrar no SINA. Se ainda não houver vínculo com escola ou turma, você verá o status “Aguardando vínculo acadêmico”."}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs leading-5 text-muted-foreground">
                Não encontrou a mensagem? Verifique também a pasta de spam ou lixo eletrônico.
              </p>

              <div className="space-y-2">
                <Button
                  type="button"
                  className="h-11 w-full font-semibold"
                  disabled={resendBusy}
                  onClick={() => void resendSignupConfirmation(signupConfirmationEmail)}
                >
                  {resendBusy ? "Enviando..." : "Reenviar e-mail de confirmação"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full font-semibold"
                  onClick={() => {
                    setSignupConfirmationOpen(false);
                    setMode("login");
                    setPassword("");
                    setPasswordConfirm("");
                    setEmail(signupConfirmationEmail);
                    setMessage("Confirme seu e-mail antes de entrar no SINA.");
                  }}
                >
                  Ir para entrar <ArrowRight />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-brand-border bg-brand text-brand-foreground">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="group flex items-center gap-2.5 font-display text-xl font-bold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-panel text-primary ring-1 ring-brand-border transition-transform group-hover:scale-105">
              <GraduationCap className="size-5" />
            </span>
            SINA
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/" className="hidden text-sm text-brand-muted transition-colors hover:text-brand-foreground sm:inline">
              Conheça o SINA <ArrowRight className="ml-1 inline size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-10 lg:py-14">
        <section className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <LockKeyhole className="size-3.5" />
            Acesso acadêmico
          </span>
          <h1 className="mt-6 max-w-xl font-display text-5xl font-semibold leading-tight tracking-tight">
            Seu acompanhamento acadêmico, em um só lugar.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-8 text-muted-foreground">
            Notas, frequência, avisos e atividades organizados em uma experiência simples para alunos e professores.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" />
            Acesso individual e protegido
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-foreground/5 sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">SINA</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>

            {mode !== "forgot" && mode !== "pending" && (
              <div className="mt-6 grid grid-cols-2 rounded-xl bg-secondary p-1">
                <button type="button" onClick={() => { setMode("login"); setMessage(""); }} className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Entrar</button>
                <button type="button" onClick={() => { setMode("signup"); setMessage(""); }} className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Criar conta</button>
              </div>
            )}

            {mode === "pending" ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    {pendingState?.request_status === "rejected" ? <ShieldCheck className="mt-0.5 size-5 text-destructive" /> : <CheckCircle2 className="mt-0.5 size-5 text-primary" />}
                    <div>
                      <p className="font-semibold">
                        {pendingState?.request_status === "rejected" ? "A solicitação precisa de nova análise." : "Solicitação recebida."}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Função solicitada: <strong>{roleLabel(pendingState?.requested_role ?? requestedRole)}</strong>.
                        {pendingState?.request_status === "pending" && " O administrador precisa aprovar o acesso antes da entrada no sistema."}
                      </p>
                    </div>
                  </div>
                </div>
                {pendingState?.review_note && <div className="rounded-xl border border-border bg-secondary p-4 text-sm leading-6"><strong>Observação do administrador:</strong> {pendingState.review_note}</div>}
                <div>
                  <p className="text-sm font-semibold">Alterar solicitação</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(["student", "teacher"] as const).map(role => (
                      <Button key={role} type="button" variant={requestedRole === role ? "default" : "outline"} disabled={busy} onClick={() => void changePendingRole(role)}>
                        {role === "student" ? <UserRound className="mr-2 size-4" /> : <UsersRound className="mr-2 size-4" />}
                        {roleLabel(role)}
                      </Button>
                    ))}
                  </div>
                </div>
                {message && <div role="status" className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-6">{message}</div>}
                <Button type="button" variant="outline" className="w-full" onClick={() => { void supabase.auth.signOut(); setMode("login"); setPendingState(null); setMessage(""); }}>
                  Sair da conta
                </Button>
              </div>
            ) : (
              <>
                {mode === "signup" ? (
                  <div className="mt-6 space-y-5">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].map(step => (
                        <div key={step} className="flex flex-1 items-center gap-2">
                          <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${signupStep >= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                            {step}
                          </span>
                          {step < 3 && <span className={`h-px flex-1 ${signupStep > step ? "bg-primary" : "bg-border"}`} />}
                        </div>
                      ))}
                    </div>

                    {signupStep === 1 && (
                      <div>
                        <p className="text-sm font-semibold">Como você participa da instituição?</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Escolha o perfil que será analisado pelo administrador.</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {(["student", "teacher"] as const).map(role => (
                            <button key={role} type="button" onClick={() => { setRequestedRole(role); setMessage(""); }}
                              className={`rounded-2xl border p-4 text-left transition ${requestedRole === role ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "border-border hover:bg-secondary/60"}`}>
                              <div className="flex items-center gap-2">
                                {role === "student" ? <UserRound className="size-5 text-primary" /> : <UsersRound className="size-5 text-primary" />}
                                <span className="font-semibold">{roleLabel(role)}</span>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">{roleDescription(role)}</p>
                            </button>
                          ))}
                        </div>
                        <Button type="button" className="mt-4 h-11 w-full" disabled={!requestedRole}
                          onClick={() => { setMessage(""); setSignupStep(2); }}>
                          Continuar <ArrowRight />
                        </Button>
                      </div>
                    )}

                    {signupStep === 2 && (
                      <div>
                        <p className="text-sm font-semibold">Qual é a sua instituição?</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Pesquise e selecione a escola onde você estuda ou trabalha.</p>
                        {selectedSchool ? (
                          <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{selectedSchool.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {selectedSchool.network_type === "municipal" ? "Rede municipal" : selectedSchool.network_type === "estadual" ? "Rede estadual" : "Rede federal"} · {selectedSchool.municipality} - {selectedSchool.state}
                                </p>
                              </div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedSchool(null)}>Trocar</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative mt-3">
                            <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                              <Input value={schoolSearch} onChange={e => setSchoolSearch(e.target.value)} placeholder="Digite o nome da instituição..." className="h-11" autoComplete="off" />
                              <select value={schoolNetwork} onChange={e => setSchoolNetwork(e.target.value as SchoolDirectoryEntry["network_type"] | "all")} className="h-11 rounded-md border border-input bg-background px-3 text-sm" aria-label="Filtrar rede de ensino">
                                <option value="all">Todas as redes</option>
                                <option value="municipal">Municipal</option>
                                <option value="estadual">Estadual</option>
                                <option value="federal">Federal</option>
                              </select>
                            </div>
                            <div className="mt-2 max-h-52 overflow-auto rounded-2xl border border-border bg-card">
                              {schoolLoading ? (
                                <p className="px-4 py-3 text-sm text-muted-foreground">Pesquisando instituições…</p>
                              ) : schoolResults.length ? (
                                schoolResults.map(school => (
                                  <button key={school.id} type="button"
                                    onClick={() => { setSelectedSchool(school); setSchoolSearch(school.name); setMessage(""); }}
                                    className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-secondary/60">
                                    <GraduationCap className="mt-0.5 size-4 shrink-0 text-primary" />
                                    <span>
                                      <span className="block text-sm font-semibold">{school.name}</span>
                                      <span className="mt-1 block text-xs text-muted-foreground">
                                        {school.network_type === "municipal" ? "Municipal" : school.network_type === "estadual" ? "Estadual" : "Federal"} · {school.municipality} - {school.state}
                                      </span>
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma instituição encontrada.</p>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" className="h-11" onClick={() => { setMessage(""); setSignupStep(1); }}>Voltar</Button>
                          <Button type="button" className="h-11" disabled={!selectedSchool} onClick={() => { setMessage(""); setSignupStep(3); }}>Continuar <ArrowRight /></Button>
                        </div>
                      </div>
                    )}

                    {signupStep === 3 && (
                      <form onSubmit={submit} className="space-y-4">
                        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div><p className="text-xs text-muted-foreground">Cadastro como</p><p className="font-semibold">{roleLabel(requestedRole)}</p></div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSignupStep(1)}>Alterar</Button>
                          </div>
                          <div className="mt-3 border-t border-border pt-3">
                            <p className="text-xs text-muted-foreground">Instituição</p>
                            <p className="mt-1 text-sm font-semibold">{selectedSchool?.name}</p>
                            <Button type="button" variant="link" className="h-auto px-0 text-xs" onClick={() => setSignupStep(2)}>Trocar instituição</Button>
                          </div>
                        </div>

                        <label className="block text-sm font-medium">Nome completo
                          <Input required value={name} onChange={e => setName(e.target.value)} className="mt-2 h-11" autoComplete="name" placeholder="Seu nome completo" />
                        </label>
                        <label className="block text-sm font-medium">E-mail
                          <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-11" autoComplete="email" placeholder="voce@exemplo.com" />
                        </label>
                        <div>
                          <label className="block text-sm font-medium">Senha
                            <Input required type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-11" autoComplete="new-password" placeholder="Crie uma senha forte" />
                          </label>
                          {password && (() => {
                            const checks = passwordChecks(password);
                            const score = Object.values(checks).filter(Boolean).length;
                            return (
                              <div className="mt-2 rounded-xl border border-border bg-secondary/40 p-3">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold">Força da senha</span>
                                  <span className="text-muted-foreground">{score <= 2 ? "Fraca" : score < 5 ? "Boa" : "Forte"}</span>
                                </div>
                                <div className="mt-2 grid grid-cols-5 gap-1">
                                  {Array.from({length: 5}).map((_, index) => <span key={index} className={`h-1 rounded-full ${index < score ? "bg-primary" : "bg-border"}`} />)}
                                </div>
                                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                  <span>{checks.length ? "✓" : "○"} Pelo menos 8 caracteres</span>
                                  <span>{checks.upper ? "✓" : "○"} Uma letra maiúscula</span>
                                  <span>{checks.lower ? "✓" : "○"} Uma letra minúscula</span>
                                  <span>{checks.number ? "✓" : "○"} Um número</span>
                                  <span>{checks.special ? "✓" : "○"} Um caractere especial</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        <label className="block text-sm font-medium">Confirmar senha
                          <Input required type="password" minLength={8} value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} className="mt-2 h-11" autoComplete="new-password" placeholder="Digite a senha novamente" />
                        </label>
                        {passwordConfirm && password !== passwordConfirm && <p className="text-xs font-medium text-destructive">As senhas não coincidem.</p>}
                        {message && <div role="status" className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-6">{message}</div>}
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" className="h-11" onClick={() => { setMessage(""); setSignupStep(2); }}>Voltar</Button>
                          <Button disabled={busy} className="h-11 font-semibold" type="submit">{busy ? "Enviando…" : "Enviar cadastro"} <ArrowRight /></Button>
                        </div>
                      </form>
                    )}

                    {signupStep === 3 && (
                      <>
                        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
                        <Button type="button" variant="outline" onClick={() => void google()} disabled={busy} className="h-11 w-full">Continuar com Google</Button>
                        <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">Sua função e instituição serão mantidas durante o cadastro com Google e também passarão por aprovação.</p>
                      </>
                    )}
                  </div>
                ) : mode === "login" ? (
                  <>
                    {message && <div role="status" className="mt-6 rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-6">{message}</div>}
                    <form onSubmit={submit} className="mt-6 space-y-4">
                      <label className="block text-sm font-medium">E-mail
                        <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-11" autoComplete="email" placeholder="voce@exemplo.com" />
                      </label>
                      <label className="block text-sm font-medium">Senha
                        <Input required type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-11" autoComplete="current-password" placeholder="Sua senha" />
                      </label>
                      <Button disabled={busy} className="h-11 w-full font-semibold" type="submit">{busy ? "Entrando…" : "Entrar no SINA"} <ArrowRight /></Button>
                    </form>
                    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
                    <Button type="button" variant="outline" onClick={() => void google()} disabled={busy} className="h-11 w-full">Continuar com Google</Button>
                  </>
                ) : (
                  <>
                    {message && <div role="status" className="mt-6 rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-6">{message}</div>}
                    <form onSubmit={submit} className="mt-6 space-y-4">
                      <label className="block text-sm font-medium">E-mail
                        <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-11" autoComplete="email" placeholder="voce@exemplo.com" />
                      </label>
                      <Button disabled={busy} className="h-11 w-full font-semibold" type="submit">{busy ? "Enviando…" : "Enviar link de recuperação"} <ArrowRight /></Button>
                    </form>
                  </>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Button variant="link" className="h-auto px-0" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMessage(""); }}>
                    {mode === "signup" ? "Já tenho conta" : "Criar conta"}
                  </Button>
                  <Button variant="link" className="h-auto px-0 text-muted-foreground" onClick={() => { setMode(mode === "forgot" ? "login" : "forgot"); setMessage(""); }}>
                    {mode === "forgot" ? "Voltar para entrar" : "Esqueci minha senha"}
                  </Button>
                </div>
              </>
            )}
          </div>
          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">Ao continuar, você acessa apenas os dados permitidos para sua função no SINA.</p>
        </section>
      </main>
    </div>
  );
}

