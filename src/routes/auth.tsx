import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, GraduationCap, LockKeyhole, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ThemeToggle } from "@/components/theme-toggle";
import {
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
  const [selectedSchool, setSelectedSchool] = useState<SchoolDirectoryEntry | null>(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolResults, setSchoolResults] = useState<SchoolDirectoryEntry[]>([]);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [pendingState, setPendingState] = useState<OnboardingState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function finishAuth(explicitRole?: RequestedRole, explicitSchoolId?: string) {
    const schoolId = explicitSchoolId || window.localStorage.getItem("sina-school-directory-id") || undefined;
    window.localStorage.removeItem("sina-school-directory-id");

    const state = schoolId && explicitRole
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

    const role = await getRole();
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
      void searchSchoolDirectory(schoolSearch).then((items) => {
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
  }, [mode, schoolSearch]);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;

      const storedRole = window.localStorage.getItem("sina-requested-role");
      const storedSchoolId = window.localStorage.getItem("sina-school-directory-id");
      const metadataRole = data.user.user_metadata?.requested_role;
      const metadataSchoolId = data.user.user_metadata?.school_directory_id;

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
        setMessage(authErrorMessage(error));
      }
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
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
          return;
        }
        if (!selectedSchool) {
          setMessage("Selecione sua escola antes de criar a conta.");
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

        if (data.session) {
          await finishAuth(requestedRole, selectedSchool.id);
        } else {
          setMessage("Conta criada. Confirme seu e-mail para continuar; depois o SINA enviará sua solicitação para aprovação.");
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await finishAuth();
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMessage("");
    if (!requestedRole) {
      setMode("signup");
      setMessage("Antes de continuar com o Google, escolha se você é aluno ou professor.");
      return;
    }
    setBusy(true);
    if (!selectedSchool) {
      setMessage("Selecione sua escola antes de continuar com o Google.");
      setBusy(false);
      return;
    }
    window.localStorage.setItem("sina-requested-role", requestedRole);
    window.localStorage.setItem("sina-school-directory-id", selectedSchool.id);
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
        await finishAuth(requestedRole, selectedSchool.id);
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
    <div className="min-h-screen bg-background">
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
                {mode === "signup" && (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm font-semibold">Como você participa da instituição?</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(["student", "teacher"] as const).map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setRequestedRole(role)}
                          className={`rounded-2xl border p-4 text-left transition ${requestedRole === role ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "border-border hover:bg-secondary/60"}`}
                        >
                          <div className="flex items-center gap-2">
                            {role === "student" ? <UserRound className="size-5 text-primary" /> : <UsersRound className="size-5 text-primary" />}
                            <span className="font-semibold">{roleLabel(role)}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{roleDescription(role)}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">A função escolhida é uma solicitação. O acesso só é liberado depois da aprovação do administrador.</p>
                  </div>
                )}

                {mode === "signup" && (
                  <div className="mt-5 space-y-3">
                    <div>
                      <p className="text-sm font-semibold">Qual é a sua escola?</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Pesquise uma escola pública de Salvador. A aprovação será encaminhada para a instituição escolhida.
                      </p>
                    </div>

                    {selectedSchool ? (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
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
                      <div className="relative">
                        <Input
                          value={schoolSearch}
                          onChange={e => setSchoolSearch(e.target.value)}
                          placeholder="Digite o nome da escola..."
                          className="h-11"
                          autoComplete="off"
                        />
                        <div className="mt-2 max-h-56 overflow-auto rounded-2xl border border-border bg-card">
                          {schoolLoading ? (
                            <p className="px-4 py-3 text-sm text-muted-foreground">Pesquisando escolas…</p>
                          ) : schoolResults.length ? (
                            schoolResults.map(school => (
                              <button
                                key={school.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSchool(school);
                                  setSchoolSearch(school.name);
                                }}
                                className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-secondary/60"
                              >
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
                            <p className="px-4 py-3 text-sm text-muted-foreground">
                              Nenhuma escola encontrada com esse nome.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  {mode === "signup" && <label className="block text-sm font-medium">Nome completo<Input required value={name} onChange={e => setName(e.target.value)} className="mt-2 h-11" autoComplete="name" /></label>}
                  <label className="block text-sm font-medium">E-mail<Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-11" autoComplete="email" /></label>
                  {mode !== "forgot" && <label className="block text-sm font-medium">Senha<Input required type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-11" autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>}
                  {message && <div role="status" className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-6 text-foreground">{message}</div>}
                  <Button disabled={busy} className="h-11 w-full font-semibold" type="submit">
                    {busy ? "Aguarde…" : mode === "login" ? "Entrar no SINA" : mode === "signup" ? "Enviar cadastro para aprovação" : "Enviar link de recuperação"}
                    <ArrowRight />
                  </Button>
                </form>

                {mode !== "forgot" && (
                  <>
                    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
                    <Button type="button" variant="outline" onClick={google} disabled={busy} className="h-11 w-full">Continuar com Google</Button>
                    <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">Ao criar uma conta nova com Google, você precisará informar se é aluno ou professor antes da aprovação.</p>
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
