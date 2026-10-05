import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, LogOut, ShieldCheck, Users, LayoutDashboard, Search, BookOpen, UserCheck, Ban, UserRoundCheck, XCircle, Building2, Power, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { errorText, loadAccountRoleRequests, reviewAccountRoleRequest, searchSchoolDirectory, type SchoolDirectoryEntry, type AdminAcademicSetup as AdminAcademicSetupData } from "@/lib/sina-data";
import { AdminAcademicSetup } from "@/components/admin-academic-setup";
import { AdminStudentClassroom } from "@/components/admin-student-classroom";
import { AdminTeacherSchool } from "@/components/admin-teacher-school";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administração — SINA" },
    { name: "description", content: "Gerencie as funções de alunos e professores no SINA." },
    { property: "og:title", content: "Administração — SINA" },
    { property: "og:description", content: "Gerencie as funções acadêmicas no SINA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminArea,
});

type AdminTab = "visao-geral" | "escolas" | "pessoas" | "academico" | "historico";

function AdminArea() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const role = useQuery({
    queryKey: ["admin-role"],
    queryFn: async () => {
      const { data: auth, error } = await supabase.auth.getUser();
      if (error || !auth.user) throw new Error("Entre na sua conta para continuar.");
      const { data, error: roleError } = await supabase.rpc("is_admin", { _user_id: auth.user.id });
      if (roleError) throw roleError;
      return Boolean(data);
    },
  });
  const institutions = useQuery({
    queryKey: ["my-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_list_institutions");
      if (error) throw error;
      return data ?? [];
    },
    enabled: role.data === true,
  });

  const accounts = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_accounts");
      if (error) throw error;
      return data ?? [];
    },
    enabled: role.data === true,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("visao-geral");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountRoleFilter, setAccountRoleFilter] = useState<"all" | "student" | "teacher">("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState<"all" | "active" | "pending" | "suspended">("all");
  const adminStudents = useQuery({ queryKey: ["admin-students"], queryFn: async () => { const { data, error } = await supabase.rpc("admin_list_student_school_links"); if (error) throw error; return data ?? []; }, enabled: role.data === true });
  const adminTeachers = useQuery({ queryKey: ["admin-teachers"], queryFn: async () => { const { data, error } = await supabase.rpc("admin_list_teacher_school_links"); if (error) throw error; return data ?? []; }, enabled: role.data === true });
  const academicSetup = useQuery<AdminAcademicSetupData>({ queryKey: ["admin-academic-setup"], queryFn: async () => { const { data, error } = await supabase.rpc("admin_list_academic_setup"); if (error) throw error; return (data ?? { classrooms: [], subjects: [], terms: [] }) as AdminAcademicSetupData; }, enabled: role.data === true });
  const roleRequests = useQuery({
    queryKey: ["admin-role-requests"],
    queryFn: loadAccountRoleRequests,
    enabled: role.data === true,
  });
  const [approvalRoles, setApprovalRoles] = useState<Record<string, "student" | "teacher">>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [institutionName, setInstitutionName] = useState("");
  const [institutionSlug, setInstitutionSlug] = useState("");
  const [creatingInstitution, setCreatingInstitution] = useState(false);
  const [institutionSchoolSearch, setInstitutionSchoolSearch] = useState("");
  const [selectedInstitutionSchool, setSelectedInstitutionSchool] = useState<SchoolDirectoryEntry | null>(null);

  const institutionSchools = useQuery({
    queryKey: ["admin-school-directory", institutionSchoolSearch],
    queryFn: () => searchSchoolDirectory(institutionSchoolSearch),
    enabled: role.data === true,
  });

  useEffect(() => {
    if (!selectedInstitutionSchool) return;
    setInstitutionName(selectedInstitutionSchool.name);
    setInstitutionSlug(
      selectedInstitutionSchool.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }, [selectedInstitutionSchool]);

  async function createInstitution() {
    if (!selectedInstitutionSchool || !institutionName.trim() || !institutionSlug.trim()) return;
    setCreatingInstitution(true);
    try {
      const { error } = await supabase.rpc("admin_create_institution", {
        _name: institutionName.trim(),
        _slug: institutionSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        _school_directory_id: selectedInstitutionSchool.id,
      });
      if (error) throw error;
      setInstitutionName("");
      setInstitutionSlug("");
      setInstitutionSchoolSearch("");
      setSelectedInstitutionSchool(null);
      toast.success("Escola vinculada à instituição. Ela já está disponível no seletor do cabeçalho.");
      await queryClient.invalidateQueries({ queryKey: ["my-institutions"] });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setCreatingInstitution(false);
    }
  }

  async function setInstitutionStatus(institutionId: string, status: "active" | "inactive") {
    setBusyId("institution:" + institutionId);
    try {
      const { error } = await supabase.rpc("admin_set_institution_status", { _institution_id: institutionId, _status: status });
      if (error) throw error;
      toast.success(status === "active" ? "Escola reativada." : "Escola desativada.");
      await queryClient.invalidateQueries({ queryKey: ["my-institutions"] });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteInstitution(institutionId: string, institutionNameValue: string) {
    const confirmation = window.prompt(`Esta ação é IRREVERSÍVEL e apagará os dados acadêmicos desta escola.

Digite exatamente o nome da escola para confirmar:

${institutionNameValue}`);
    if (confirmation !== institutionNameValue) {
      if (confirmation !== null) toast.error("O nome digitado não corresponde. A escola não foi excluída.");
      return;
    }
    setBusyId("delete-institution:" + institutionId);
    try {
      const { error } = await supabase.rpc("admin_delete_institution", { _institution_id: institutionId });
      if (error) throw error;
      toast.success("Escola excluída definitivamente.");
      await queryClient.invalidateQueries({ queryKey: ["my-institutions"] });
      window.location.reload();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyId(null);
    }
  }

  async function reviewRequest(requestId: string, decision: "approved" | "rejected", requestedRole: "student" | "teacher") {
    setBusyId(requestId);
    setMessage("");
    try {
      const roleToApprove = approvalRoles[requestId] ?? requestedRole;
      await reviewAccountRoleRequest(requestId, decision, roleToApprove, reviewNotes[requestId] ?? "");
      setMessage(decision === "approved" ? "Cadastro aprovado com sucesso." : "Solicitação rejeitada.");
      toast.success(decision === "approved" ? "Cadastro aprovado." : "Solicitação rejeitada.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-role-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audit"] }),
      ]);
    } catch (error) {
      setMessage(errorText(error));
      toast.error(errorText(error));
    } finally {
      setBusyId(null);
    }
  }

  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_audit_logs", { _limit: 100 });
      if (error) throw error;
      return data ?? [];
    },
    enabled: role.data === true,
  });

  async function setAcademicRole(userId: string, nextRole: "student" | "teacher") {
    setBusyId(userId);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_set_academic_role", {
      _user_id: userId,
      _role: nextRole,
    });
    setBusyId(null);
    if (error) {
      setMessage(errorText(error));
      toast.error(errorText(error));
      return;
    }
    if (!data) {
      setMessage("Conta não encontrada. Atualize a página e tente novamente.");
      return;
    }
    setMessage(nextRole === "teacher" ? "Conta definida como professor." : "Conta definida como aluno.");
    toast.success(nextRole === "teacher" ? "Professor autorizado." : "Conta definida como aluno.");
    await queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
  }

  async function setAccountStatus(userId: string, nextStatus: "active" | "suspended") {
    setBusyId(userId);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_set_account_status", {
      _user_id: userId,
      _status: nextStatus,
    });
    setBusyId(null);
    if (error) {
      setMessage(errorText(error));
      toast.error(errorText(error));
      return;
    }
    if (!data) {
      setMessage("Não foi possível atualizar o status da conta.");
      return;
    }
    setMessage(nextStatus === "active" ? "Conta reativada." : "Conta suspensa.");
    toast.success(nextStatus === "active" ? "Conta reativada." : "Conta suspensa.");
    await queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
  }

  const filteredAccounts = useMemo(() => accounts.data?.filter(account => {
    const matchesText = `${account.display_name} ${account.email}`.toLowerCase().includes(accountSearch.toLowerCase());
    const matchesRole = accountRoleFilter === "all" || account.academic_role === accountRoleFilter;
    const matchesStatus = accountStatusFilter === "all" || account.account_status === accountStatusFilter;
    return matchesText && matchesRole && matchesStatus;
  }) ?? [], [accounts.data, accountSearch, accountRoleFilter, accountStatusFilter]);
  const teacherCount = accounts.data?.filter(account => account.academic_role === "teacher").length ?? 0;
  const studentCount = adminStudents.data?.length ?? 0;
  const unassignedStudents = adminStudents.data?.filter(student => !student.institution_id || !student.classroom_id).length ?? 0;
  const activeTeacherLinks = adminTeachers.data?.filter(teacher => teacher.institution_id).length ?? 0;
  const classroomCount = academicSetup.data?.classrooms?.length ?? 0;
  const subjectCount = academicSetup.data?.subjects?.length ?? 0;
  const currentTerm = academicSetup.data?.terms?.find(term => term.is_current)?.name ?? "Nenhum período atual";
  const academicOverview = useQuery({
    queryKey: ["admin-academic-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_academic_overview");
      if (error) throw error;
      return (data ?? {}) as {
        students:number; students_without_class:number; classrooms:number; teachers:number;
        grades_count:number; average:number|null; attendance_percent:number|null;
        students_below_average:number; students_low_attendance:number;
        classrooms_attention:Array<{id:string;name:string;average:number|null;attendance_percent:number|null}>;
      };
    },
    enabled: role.data === true,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  async function logout() {
    await supabase.auth.signOut();
    queryClient.clear();
    void navigate({ to: "/auth", replace: true });
  }

  if (role.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Verificando permissões…</div>;
  }

  if (role.error || !role.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
          <ShieldCheck className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Acesso administrativo restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">Esta área só pode ser acessada por contas com a função de administrador.</p>
          <Link to="/painel" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">Voltar ao painel</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-brand-border/80 bg-brand/95 text-brand-foreground shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-5 lg:px-8">
          <Link to="/painel" className="group flex shrink-0 items-center gap-2.5 font-display text-xl font-bold tracking-tight" aria-label="SINA — voltar ao painel">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-panel text-primary ring-1 ring-brand-border transition-transform group-hover:scale-105">
              <GraduationCap className="size-5" />
            </span>
            SINA
          </Link>
          <nav aria-label="Navegação administrativa" className="ml-2 hidden items-center rounded-xl border border-brand-border/80 bg-brand-panel/60 p-1 sm:flex">
            <Link to="/painel" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-muted hover:bg-brand-panel hover:text-brand-foreground">
              <LayoutDashboard className="size-4" /> Painel
            </Link>
            <span className="flex items-center gap-2 rounded-lg bg-brand-panel px-3 py-2 text-sm font-semibold text-brand-foreground shadow-sm ring-1 ring-brand-border/70">
              <ShieldCheck className="size-4 text-primary" /> Administração
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {institutions.data && institutions.data.length > 0 && (
              <select
                aria-label="Instituição ativa"
                value={institutions.data.find(i => i.is_active)?.id ?? institutions.data[0]?.id ?? ""}
                onChange={async e => {
                  const { error } = await supabase.rpc("account_set_institution", { _institution_id: e.target.value });
                  if (!error) window.location.reload();
                }}
                className="hidden max-w-52 rounded-lg border border-brand-border bg-brand-panel px-2.5 py-2 text-xs font-semibold text-brand-foreground lg:block"
              >
                {institutions.data.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}
            <span className="hidden rounded-full border border-brand-border bg-brand-panel/70 px-3 py-1.5 text-xs font-medium text-brand-muted lg:inline-flex">Controle de acesso</span>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={logout} className="border-brand-border bg-transparent text-brand-foreground shadow-none hover:bg-brand-panel">
              <LogOut className="mr-2 size-4" /><span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
     </header>

      <main id="inicio" className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-9">
        <nav aria-label="Seções administrativas" className="sina-card sticky top-[68px] z-30 -mx-1 overflow-x-auto p-2 sm:mx-0">
          <div className="flex min-w-max gap-1">
            {[
              ["visao-geral","Visão geral",LayoutDashboard],
              ["escolas","Escolas",Building2],
              ["pessoas","Pessoas e acessos",Users],
              ["academico","Acadêmico",BookOpen],
              ["historico","Histórico",ShieldCheck],
            ].map(([id,label,Icon]) => (
              <button key={id as string} type="button" onClick={() => setAdminTab(id as AdminTab)} className={adminTab === id ? "inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm" : "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"}>
                <Icon className="size-4" />{label}
              </button>
            ))}
          </div>
        </nav>
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">{adminTab === "visao-geral" ? "Visão geral" : adminTab === "escolas" ? "Escolas" : adminTab === "pessoas" ? "Pessoas e acessos" : adminTab === "academico" ? "Gestão acadêmica" : "Histórico"}</p><h1 className="mt-1 font-display text-2xl font-bold">{adminTab === "visao-geral" ? "Central administrativa" : adminTab === "escolas" ? "Escolas e instituições" : adminTab === "pessoas" ? "Pessoas, funções e acessos" : adminTab === "academico" ? "Estrutura e vínculos acadêmicos" : "Histórico de alterações"}</h1></div>
          <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:inline-flex">Instituição ativa</span>
        </div>

        <div className={adminTab === "visao-geral" ? "space-y-6" : "hidden"}>
        <section className="rounded-3xl bg-brand p-6 text-brand-foreground shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><ShieldCheck className="size-6" /></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Controle de acesso</p><h1 className="mt-1 font-display text-2xl font-bold">Administração de contas</h1><p className="mt-2 max-w-2xl text-sm text-brand-muted">Defina quem acessa a área do aluno e quem pode lançar dados como professor.</p></div>
          </div>
        </section>

        <section className={adminTab === "escolas" ? "sina-card p-6" : "hidden"}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Multi-instituição</p>
              <h2 className="mt-1 font-semibold">Cadastrar uma nova escola</h2>
              <p className="mt-1 text-sm text-muted-foreground">Cada instituição terá sua própria estrutura acadêmica, turmas, usuários e dados.</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
              <Input
                value={institutionSchoolSearch}
                onChange={e => setInstitutionSchoolSearch(e.target.value)}
                placeholder="Pesquisar escola real no catálogo"
              />
              <select
                value={selectedInstitutionSchool?.id ?? ""}
                onChange={e => {
                  const school = institutionSchools.data?.find(item => item.id === e.target.value) ?? null;
                  setSelectedInstitutionSchool(school);
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Escola do catálogo"
              >
                <option value="">Selecione a escola</option>
                {(institutionSchools.data ?? []).map(school => (
                  <option key={school.id} value={school.id}>
                    {school.name} — {school.network_type}
                  </option>
                ))}
              </select>
              <Input value={institutionName} onChange={e => setInstitutionName(e.target.value)} placeholder="Nome da instituição" />
              <Input value={institutionSlug} onChange={e => setInstitutionSlug(e.target.value)} placeholder="Identificador, ex.: escola-centro" />
              <Button className="sm:col-span-2 lg:col-span-2" onClick={() => void createInstitution()} disabled={creatingInstitution || !selectedInstitutionSchool || !institutionName.trim() || !institutionSlug.trim()}>
                {creatingInstitution ? "Vinculando…" : "Vincular escola e criar instituição"}
              </Button>
            </div>
          </div>
        </section>

        <section className={adminTab === "escolas" ? "sina-card p-6" : "hidden"}>
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Escolas e instituições</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ative, desative ou exclua uma instituição. A exclusão definitiva só ocorre quando não existem dados vinculados.</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {(institutions.data ?? []).map((institution) => (
              <div key={institution.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{institution.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{institution.slug}</span>
                    <span className={institution.status === "active" ? "rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary" : "rounded-full bg-muted px-2 py-1 font-semibold"}>{institution.status === "active" ? "Ativa" : "Inativa"}</span>
                    {institution.is_active && <span className="rounded-full border border-border px-2 py-1">Atual</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId?.includes(institution.id)}
                    onClick={() => void setInstitutionStatus(institution.id, institution.status === "active" ? "inactive" : "active")}
                  >
                    <Power className="mr-2 size-4" />
                    {institution.status === "active" ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={busyId?.includes(institution.id)}
                    onClick={() => void deleteInstitution(institution.id, institution.name)}
                  >
                    <Trash2 className="mr-2 size-4" />Excluir
                  </Button>
                </div>
              </div>
            ))}
            {!(institutions.data ?? []).length && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma escola vinculada a esta conta administrativa.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Precisa da sua atenção</p><h2 className="mt-1 font-semibold">Pendências administrativas</h2></div><ShieldCheck className="size-5 text-primary"/></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <a href="#aprovacoes" className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"><p className="text-xs font-bold uppercase text-muted-foreground">Aprovações</p><p className="mt-1 text-2xl font-semibold">{roleRequests.data?.filter(item=>item.status==="pending").length??0}</p><p className="mt-1 text-xs text-muted-foreground">Solicitações aguardando análise.</p></a>
            <a href="#alunos-turmas" className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"><p className="text-xs font-bold uppercase text-muted-foreground">Alunos sem vínculo completo</p><p className="mt-1 text-2xl font-semibold">{unassignedStudents}</p><p className="mt-1 text-xs text-muted-foreground">Escola ou turma ainda não definida.</p></a>
            <a href="#autorizacao" className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"><p className="text-xs font-bold uppercase text-muted-foreground">Contas suspensas</p><p className="mt-1 text-2xl font-semibold">{accounts.data?.filter(account=>account.account_status==="suspended").length??0}</p><p className="mt-1 text-xs text-muted-foreground">Revise acessos quando necessário.</p></a>
          </div>
        </section>

        <section className="sina-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Panorama acadêmico</p><h2 className="mt-1 font-semibold">Como está a instituição?</h2><p className="mt-1 text-sm text-muted-foreground">Indicadores calculados somente sobre os dados acadêmicos da instituição ativa.</p></div>
            <span className="text-xs text-muted-foreground">Atualização automática</span>
          </div>
          {academicOverview.isPending ? <p className="mt-5 text-sm text-muted-foreground">Calculando indicadores…</p> :
            academicOverview.error ? <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar o panorama acadêmico. <Button size="sm" variant="outline" className="ml-2" onClick={()=>void academicOverview.refetch()}>Tentar novamente</Button></div> :
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Média institucional", academicOverview.data?.average == null ? "—" : Number(academicOverview.data.average).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:2}), "Média simples das notas lançadas."],
                  ["Frequência", academicOverview.data?.attendance_percent == null ? "—" : Number(academicOverview.data.attendance_percent).toLocaleString("pt-BR",{maximumFractionDigits:0})+"%", "Presenças sobre registros presentes/ausentes."],
                  ["Atenção nas notas", academicOverview.data?.students_below_average ?? 0, "Alunos com média abaixo de 6,0."],
                  ["Atenção na frequência", academicOverview.data?.students_low_attendance ?? 0, "Alunos com frequência abaixo de 75%."],
                ].map(([label,value,desc])=><div key={label} className="rounded-xl border border-border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{desc}</p></div>)}
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="font-semibold">Turmas que precisam de atenção</p>
                <div className="mt-3 space-y-2">
                  {(academicOverview.data?.classrooms_attention ?? []).map(item=><div key={item.id} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"><div><b>{item.name}</b><p className="text-xs text-muted-foreground">Média: {item.average == null ? "—" : Number(item.average).toFixed(1)} · Frequência: {item.attendance_percent == null ? "—" : Number(item.attendance_percent).toFixed(0)+"%"}</p></div><span className="text-xs font-semibold text-primary">Revisar turma</span></div>)}
                  {!(academicOverview.data?.classrooms_attention ?? []).length && <p className="text-sm text-muted-foreground">Nenhuma turma foi sinalizada pelos critérios atuais. 🎉</p>}
                </div>
              </div>
            </div>}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {([
            { label: "Contas", value: accounts.data?.length ?? 0, caption: "Usuários cadastrados", Icon: Users },
            { label: "Alunos", value: studentCount, caption: unassignedStudents ? `${unassignedStudents} sem vínculo completo` : "Com vínculo acadêmico", Icon: GraduationCap },
            { label: "Professores", value: teacherCount, caption: `${activeTeacherLinks} com instituição`, Icon: ShieldCheck },
            { label: "Aprovações", value: roleRequests.data?.filter(item => item.status === "pending").length ?? 0, caption: "Solicitações aguardando análise", Icon: UserRoundCheck },
            { label: "Turmas", value: classroomCount, caption: "Estrutura da instituição ativa", Icon: LayoutDashboard },
            { label: "Disciplinas", value: subjectCount, caption: currentTerm, Icon: BookOpen },
          ] as Array<{ label: string; value: number; caption: string; Icon: LucideIcon }>).map(({ label, value, caption, Icon }) => (
            <div key={label} className="sina-card sina-card-hover p-5">
              <Icon className="size-5 text-primary" />
              <p className="mt-3 text-xs font-bold uppercase text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Leitura dos indicadores</p>
          <p className="mt-1 text-sm text-muted-foreground">Os números são contagens dos registros da instituição ativa. Não representam estimativas ou dados demonstrativos.</p>
        </section>

        <section aria-label="Acesso rápido administrativo" className="rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Acesso rápido</p><p className="mt-1 text-sm text-muted-foreground">Escolha uma área sem precisar percorrer todo o painel.</p></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["escolas","Escolas"],["pessoas","Pessoas"],["academico","Acadêmico"],["historico","Histórico"]].map(([id,label])=><button key={id} type="button" onClick={()=>setAdminTab(id as AdminTab)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold hover:border-primary/40 hover:bg-primary/5">{label}</button>)}
            </div>
          </div>
        </section>

        </div>

        <section id="aprovacoes" className={adminTab === "pessoas" ? "sina-card sina-card-hover scroll-mt-28 p-6" : "hidden"}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 size-5 text-primary" /><div><h2 className="font-semibold">Solicitações de acesso</h2><p className="mt-1 text-sm text-muted-foreground">Revise como a pessoa se identificou no cadastro e libere a função acadêmica somente depois da análise.</p></div></div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{roleRequests.data?.filter(item => item.status === "pending").length ?? 0} pendentes</span>
          </div>

          {roleRequests.isPending ? <p className="mt-5 text-sm text-muted-foreground">Carregando solicitações…</p> :
            roleRequests.error ? <p role="alert" className="mt-5 text-sm text-destructive">{errorText(roleRequests.error)}</p> :
            (roleRequests.data?.filter(item => item.status === "pending").length ?? 0) > 0 ? (
              <div className="mt-5 space-y-3">
                {roleRequests.data?.filter(item => item.status === "pending").map(request => (
                  <article key={request.id} className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold">{request.display_name || request.email}</p>
                        <p className="text-sm text-muted-foreground">{request.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-background px-2.5 py-1 font-semibold">Solicitou: {request.requested_role === "teacher" ? "Professor" : "Aluno"}</span>
                          <span className="rounded-full bg-background px-2.5 py-1 font-semibold">
                            Escola: {request.school_name ?? "Não informada"}
                          </span>
                          <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">{new Date(request.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="grid w-full gap-2 lg:max-w-sm">
                        <select
                          value={approvalRoles[request.id] ?? request.requested_role}
                          onChange={e => setApprovalRoles(prev => ({ ...prev, [request.id]: e.target.value as "student" | "teacher" }))}
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          aria-label={`Função para aprovar ${request.display_name || request.email}`}
                        >
                          <option value="student">Aprovar como aluno</option>
                          <option value="teacher">Aprovar como professor</option>
                        </select>
                        <Input
                          placeholder="Observação opcional"
                          value={reviewNotes[request.id] ?? ""}
                          onChange={e => setReviewNotes(prev => ({ ...prev, [request.id]: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button disabled={busyId === request.id} onClick={() => void reviewRequest(request.id, "approved", request.requested_role)}>
                            <UserCheck className="mr-2 size-4" />Aprovar
                          </Button>
                          <Button disabled={busyId === request.id} variant="outline" onClick={() => void reviewRequest(request.id, "rejected", request.requested_role)}>
                            <XCircle className="mr-2 size-4" />Rejeitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhuma solicitação pendente. Novos cadastros aparecerão aqui antes de receberem acesso acadêmico.</div>
            )}
        </section>

        <section id="autorizacao" className={adminTab === "pessoas" ? "sina-card sina-card-hover scroll-mt-28 p-6" : "hidden"}>
          <div className="flex items-start gap-3"><Users className="mt-0.5 size-5 text-primary" /><div><h2 className="font-semibold">Funções acadêmicas</h2><p className="mt-1 text-sm text-muted-foreground">Escolha aluno ou professor para cada conta cadastrada.</p></div></div>
          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar contas" placeholder="Buscar por nome ou e-mail" className="pl-9" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} /></div>
            <select aria-label="Filtrar por função" value={accountRoleFilter} onChange={e => setAccountRoleFilter(e.target.value as typeof accountRoleFilter)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Todas as funções</option><option value="student">Alunos</option><option value="teacher">Professores</option></select>
            <select aria-label="Filtrar por status" value={accountStatusFilter} onChange={e => setAccountStatusFilter(e.target.value as typeof accountStatusFilter)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Todos os status</option><option value="active">Ativas</option><option value="pending">Pendentes</option><option value="suspended">Suspensas</option></select>
          </div>
          {message && <p role="status" className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm">{message}</p>}
          {accounts.data && <p className="mt-3 text-xs text-muted-foreground">Exibindo {filteredAccounts.length} de {accounts.data.length} contas.</p>}
          {accounts.isPending ? <p className="mt-5 text-sm text-muted-foreground">Carregando contas…</p> : accounts.error ? <p role="alert" className="mt-5 text-sm text-destructive">{errorText(accounts.error)}</p> : filteredAccounts.length ? (
            <div className="mt-5 divide-y divide-border border-t border-border">
              {filteredAccounts.map(account => (
                <div key={account.user_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{account.display_name || account.email}</p>
                    <p className="break-all text-sm text-muted-foreground">{account.email}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {account.is_administrator && <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><ShieldCheck className="size-3" /> Administrador</span>}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${account.account_status === "suspended" ? "bg-destructive/10 text-destructive" : account.account_status === "pending" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}>
                        {account.account_status === "suspended" ? <Ban className="size-3" /> : <UserCheck className="size-3" />}
                        {account.account_status === "suspended" ? "Suspensa" : account.account_status === "pending" ? "Pendente" : "Ativa"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="flex shrink-0 gap-1 rounded-md border border-border p-1" aria-label={`Função acadêmica de ${account.email}`}>
                      <Button size="sm" variant={account.academic_role === "student" ? "default" : "ghost"} disabled={account.is_administrator || busyId === account.user_id} onClick={() => void setAcademicRole(account.user_id, "student")}>Aluno</Button>
                      <Button size="sm" variant={account.academic_role === "teacher" ? "default" : "ghost"} disabled={account.is_administrator || busyId === account.user_id} onClick={() => void setAcademicRole(account.user_id, "teacher")}>Professor</Button>
                    </div>
                    {!account.is_administrator && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === account.user_id}
                        onClick={() => void setAccountStatus(account.user_id, account.account_status === "suspended" ? "active" : "suspended")}
                      >
                        {account.account_status === "suspended" ? <><UserCheck className="mr-2 size-4" />Ativar</> : <><Ban className="mr-2 size-4" />Suspender</>}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mt-5 text-sm text-muted-foreground">{accountSearch ? "Nenhuma conta encontrada." : "Nenhuma conta cadastrada."}</p>}
        </section>

        <section id="configuracao-academica" className={adminTab === "academico" ? "scroll-mt-28" : "hidden"}>
          <AdminAcademicSetup />
        </section>

        <section id="alunos-turmas" className={adminTab === "academico" ? "scroll-mt-28" : "hidden"}>
          <AdminStudentClassroom />
        </section>

        <div className={adminTab === "academico" ? "space-y-6" : "hidden"}><AdminTeacherSchool />

        <section id="historico" className={adminTab === "historico" ? "sina-card sina-card-hover scroll-mt-28" : "hidden"}>
          <div className="flex items-center justify-between border-b border-border p-6">
            <div>
              <h2 className="font-semibold">Histórico de alterações</h2>
              <p className="mt-1 text-sm text-muted-foreground">Registro das alterações feitas em alunos e notas.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{audit.data?.length ?? 0} registros</span>
          </div>
          {audit.isPending ? <div className="space-y-3 p-6">{[1,2,3].map(item => <div key={item} className="sina-skeleton h-12 w-full" />)}</div> : audit.error ? <p role="alert" className="p-6 text-sm text-destructive">{errorText(audit.error)}</p> : audit.data?.length ? (
            <div className="divide-y divide-border">
              {audit.data.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{entry.action} · {entry.table_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Registro {entry.record_id ?? "—"}</p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("pt-BR")}</time>
                </div>
              ))}
            </div>
          ) : <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>}
        </section>

      </main>
    </div>
  );
}
</div>