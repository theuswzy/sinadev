import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, ClipboardList, GraduationCap, Megaphone, Plus, School, Users, BarChart3, Paperclip, Pencil, Trash2, X, FileText, Download, RefreshCw, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { AcademicShell } from "@/components/academic-shell";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  assignTeacherSubjectToClass, createAssessment, createTeacherAnnouncement,
  createTeacherCalendarEvent, createTeacherClassroom, createTeacherSubject, createTeacherTask, createTeacherAcademicMaterial, deleteTeacherAcademicMaterial,
  errorText, formatScore, gradeTaskSubmission, uploadAcademicAttachment, updateTeacherTask, deleteTeacherTask, updateTeacherAnnouncement, deleteTeacherAnnouncement, loadAttendance, loadTaskSubmissions, loadTeacherAcademicOptions,
  loadTeacherAnnouncements, loadTeacherAssessments, loadTeacherCalendar, loadTeacherClassReport,
  loadTeacherClassrooms, loadTeacherInstitutionClassrooms, loadTeacherInstitutionStudents, loadTeacherInstitutionStudentsPage, loadTeacherSubjects, loadTeacherTasks, loadTeacherUnassignedStudents, loadTeacherGradebookPeriodStatus,
  loadTeacherUnassignedClassrooms, teacherJoinClassroom, teacherLeaveClassroom, loadTeacherGrades, loadTeacherGradebook, loadTeacherAcademicMaterials,
  saveAttendance, saveTeacherGradebook, clearTeacherGradebookScores, teacherEnrollStudentInClassroom, teacherLinkStudentToSchool,
  teacherRemoveStudentFromClassroom, unassignTeacherSubjectFromClass, deleteTeacherSubject, updateTeacherSubject, updateTeacherCalendarEvent, deleteTeacherCalendarEvent, type AttendanceRow, type TeacherTask, type TeacherAnnouncement
} from "@/lib/sina-data";

type Section = "inicio"|"turmas"|"alunos"|"disciplinas"|"notas"|"frequencia"|"avaliacoes"|"atividades"|"materiais"|"agenda"|"comunicacao";
const menu: {id:Section;label:string;Icon:LucideIcon}[]=[
  {id:"inicio",label:"Visão geral",Icon:BarChart3},{id:"turmas",label:"Turmas",Icon:Users},
  {id:"alunos",label:"Alunos",Icon:GraduationCap},{id:"disciplinas",label:"Disciplinas",Icon:BookOpen},
  {id:"notas",label:"Notas",Icon:BarChart3},{id:"frequencia",label:"Frequência",Icon:CheckCircle2},
  {id:"avaliacoes",label:"Avaliações",Icon:ClipboardCheck},{id:"atividades",label:"Atividades",Icon:ClipboardList},
  {id:"materiais",label:"Materiais",Icon:FileText},{id:"agenda",label:"Agenda",Icon:CalendarDays},{id:"comunicacao",label:"Comunicação",Icon:Megaphone}
];

function Card({title,description,children}:{title:string;description?:string;children:ReactNode}){
  return <section className="sina-card p-5 sm:p-6"><h2 className="font-semibold">{title}</h2>{description&&<p className="mt-1 text-sm text-muted-foreground">{description}</p>}<div className="mt-5">{children}</div></section>;
}
function Select({label,value,onChange,children}:{label:string;value:string;onChange:(v:string)=>void;children:ReactNode}){
  return <label className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span><select value={value} onChange={e=>onChange(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{children}</select></label>;
}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label>}

function useData(section: Section){
  const qc=useQueryClient();
  const needsClasses = true;
  const needsStudents = section==="inicio" || section==="notas" || section==="frequencia" || section==="avaliacoes";
  const needsSubjects = section==="inicio" || section==="disciplinas" || section==="notas" || section==="atividades";
  const needsAssignments = section==="disciplinas" || section==="notas" || section==="frequencia" || section==="avaliacoes" || section==="atividades" || section==="materiais";
  const needsUnassignedClasses = section==="turmas" || section==="alunos" || section==="agenda" || section==="comunicacao";
  const classes=useQuery({queryKey:["teacher-new-classes"],queryFn:loadTeacherClassrooms,staleTime:30000,enabled:needsClasses});
  const institutionClasses=useQuery({queryKey:["teacher-institution-classrooms"],queryFn:loadTeacherInstitutionClassrooms,staleTime:30000,enabled:needsClasses});
  const students=useQuery({queryKey:["teacher-new-students"],queryFn:loadTeacherInstitutionStudents,staleTime:30000,enabled:needsStudents});
  const subjects=useQuery({queryKey:["teacher-new-subjects"],queryFn:loadTeacherSubjects,staleTime:30000,enabled:needsSubjects});
  const assignments=useQuery({queryKey:["teacher-new-assignments"],queryFn:async()=>{const {data,error}=await supabase.rpc("teacher_list_subject_assignments");if(error)throw error;return data??[]},staleTime:30000,enabled:needsAssignments});
  const unassignedClasses=useQuery({queryKey:["teacher-new-unassigned-classes"],queryFn:loadTeacherUnassignedClassrooms,staleTime:15000,enabled:needsUnassignedClasses});
  async function refresh(){
    await Promise.all([
      qc.invalidateQueries({queryKey:["teacher-new-classes"]}),
      qc.invalidateQueries({queryKey:["teacher-institution-classrooms"]}),
      qc.invalidateQueries({queryKey:["teacher-new-unassigned-classes"]}),
      qc.invalidateQueries({queryKey:["teacher-new-students"]}),
      qc.invalidateQueries({queryKey:["teacher-new-students-page"]}),
      qc.invalidateQueries({queryKey:["teacher-new-subjects"]}),
      qc.invalidateQueries({queryKey:["teacher-new-assignments"]}),
    ]);
  }
  return {classes,institutionClasses,students,subjects,assignments,unassignedClasses,refresh};
}

function DataError({d}:{d:ReturnType<typeof useData>}) {
  const errors = [
    d.classes.error && "turmas",
    d.students.error && "alunos",
    d.subjects.error && "disciplinas",
    d.assignments.error && "vínculos de disciplinas",
    d.unassignedClasses.error && "turmas disponíveis",
    d.institutionClasses.error && "turmas da escola",
  ].filter(Boolean) as string[];
  if (!errors.length) return null;
  return <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
    <p className="font-semibold">Não foi possível carregar alguns dados</p>
    <p className="mt-1 text-sm text-muted-foreground">Falha ao carregar: {errors.join(", ")}.</p>
    <Button className="mt-3" variant="outline" onClick={()=>void d.refresh()}>Tentar novamente</Button>
  </section>;
}

function Overview({d,onNavigate}:{d:ReturnType<typeof useData>;onNavigate:(section:Section)=>void}){
  const tasks=useQuery({queryKey:["teacher-overview-tasks"],queryFn:loadTeacherTasks,staleTime:15000,refetchOnWindowFocus:true,refetchInterval:30000});
  const materials=useQuery({queryKey:["teacher-overview-materials"],queryFn:loadTeacherAcademicMaterials,staleTime:15000,refetchOnWindowFocus:true,refetchInterval:30000});
  const calendarRange={from:new Date().toISOString(),to:new Date(Date.now()+30*86400000).toISOString()};
  const calendar=useQuery({queryKey:["teacher-overview-calendar",calendarRange.from.slice(0,10),calendarRange.to.slice(0,10)],queryFn:()=>loadTeacherCalendar(calendarRange.from,calendarRange.to),staleTime:15000,refetchOnWindowFocus:true,refetchInterval:30000});
  const classes=(d.classes.data??[]).filter(x=>x.status==="active");
  const students=d.students.data??[];
  const subjects=(d.subjects.data??[]).filter(x=>x.status==="active");
  const pending=(d.students.data??[]).filter(x=>x.class_status==="sem_turma");
  const overdueTasks=(tasks.data??[]).filter(t=>t.due_at&&new Date(t.due_at).getTime()<Date.now());
  const upcomingTasks=(tasks.data??[]).filter(t=>t.due_at&&new Date(t.due_at).getTime()>=Date.now()).sort((a,b)=>new Date(a.due_at!).getTime()-new Date(b.due_at!).getTime()).slice(0,5);
  const upcomingEvents=(calendar.data??[]).filter(e=>new Date(e.start_at).getTime()>=Date.now()).slice(0,5);
  const actions: { label: string; value: number; desc: string; icon: LucideIcon; go: Section }[]=[
    {label:"Turmas",value:classes.length,desc:"Acompanhar desempenho e vínculos",icon:Users,go:"turmas" as Section},
    {label:"Alunos da escola",value:students.length,desc:"Consultar e organizar estudantes",icon:GraduationCap,go:"alunos" as Section},
    {label:"Disciplinas",value:subjects.length,desc:"Gerenciar suas disciplinas",icon:BookOpen,go:"disciplinas" as Section},
    {label:"Sem turma",value:pending.length,desc:"Resolver vínculos pendentes",icon:School,go:"alunos" as Section},
  ];

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl bg-brand p-6 text-brand-foreground shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-muted">Central do professor</p>
          <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">Seu trabalho acadêmico, organizado em um único fluxo.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">Acompanhe turmas, lance notas e frequência, publique atividades e mantenha os alunos informados sem sair do contexto da turma.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" onClick={()=>onNavigate("notas")} className="rounded-xl">Lançar notas</Button>
          <Button type="button" variant="outline" onClick={()=>onNavigate("frequencia")} className="rounded-xl border-brand-border bg-transparent text-brand-foreground hover:bg-brand-panel">Registrar frequência</Button>
          <Button type="button" variant="outline" onClick={()=>void Promise.all([d.refresh(), tasks.refetch(), materials.refetch(), calendar.refetch()])} disabled={tasks.isFetching || materials.isFetching || calendar.isFetching} className="rounded-xl border-brand-border bg-transparent text-brand-foreground hover:bg-brand-panel"><RefreshCw className={"mr-2 size-4 " + ((tasks.isFetching || materials.isFetching || calendar.isFetching) ? "animate-spin" : "")}/>{tasks.isFetching || materials.isFetching || calendar.isFetching ? "Atualizando…" : "Atualizar painel"}</Button>
        </div>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map(({label,value,desc,icon:Icon,go})=><button key={label} type="button" onClick={()=>onNavigate(go)} className="sina-card group p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></span>
          <span className="text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">Abrir →</span>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
      </button>)}
    </section>

    <Card title="Fluxo recomendado" description="O SINA foi pensado para acompanhar o trabalho do professor na ordem em que ele acontece.">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {([
          ["1","Turmas","Organize seus vínculos.","turmas",Users],
          ["2","Alunos","Confira matrículas.","alunos",GraduationCap],
          ["3","Notas","Lance resultados.","notas",BarChart3],
          ["4","Frequência","Registre presença.","frequencia",CheckCircle2],
          ["5","Avaliações","Crie e corrija.","avaliacoes",ClipboardCheck],
          ["6","Comunicação","Avise suas turmas.","comunicacao",Megaphone],
        ] as [string,string,string,Section,LucideIcon][]).map(([step,title,desc,go,StepIcon])=>{
          return <button key={String(step)} type="button" onClick={()=>onNavigate(go as Section)} className="rounded-2xl border border-border p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5">
            <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-primary">ETAPA {step}</span><StepIcon className="size-4 text-primary"/></div>
            <b className="mt-2 block">{title}</b>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
          </button>;
        })}
      </div>
    </Card>

    <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
      <Card title="Prioridades de hoje" description="Veja primeiro aquilo que realmente pede uma ação.">
        <div className="grid gap-3 md:grid-cols-2">
          <button type="button" onClick={()=>onNavigate("alunos")} className="rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Alunos sem turma</p>
            <p className="mt-1 text-3xl font-semibold">{pending.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{pending.length?"Há alunos aguardando vínculo.":"Nenhum aluno aguardando vínculo."}</p>
          </button>
          <button type="button" onClick={()=>onNavigate("atividades")} className="rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Atividades vencidas</p>
            <p className="mt-1 text-3xl font-semibold">{overdueTasks.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{overdueTasks.length?"Confira entregas e correções pendentes.":"Nenhuma atividade com prazo vencido."}</p>
          </button>
          <button type="button" onClick={()=>onNavigate("materiais")} className="rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Materiais publicados</p>
            <p className="mt-1 text-3xl font-semibold">{materials.data?.length??0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Arquivos disponíveis para suas turmas.</p>
          </button>
          <button type="button" onClick={()=>onNavigate("agenda")} className="rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Próximos eventos</p>
            <p className="mt-1 text-3xl font-semibold">{upcomingEvents.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Compromissos acadêmicos nos próximos dias.</p>
          </button>
        </div>
        {tasks.isError&&<p className="mt-3 text-xs text-destructive">Não foi possível atualizar os indicadores de atividades.</p>}
        {materials.isError&&<p className="mt-1 text-xs text-destructive">Não foi possível atualizar os indicadores de materiais.</p>}
      </Card>

      <Card title="Próximos compromissos" description="Atividades e eventos aparecem juntos aqui.">
        <div className="space-y-2">
          {upcomingTasks.map(t=><button key={"task-"+t.id} type="button" onClick={()=>onNavigate("atividades")} className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="size-4"/></span>
            <span className="min-w-0 flex-1"><b className="block truncate text-sm">{t.title}</b><span className="text-xs text-muted-foreground">{t.classroom} · {new Date(t.due_at!).toLocaleDateString("pt-BR")}</span></span>
          </button>)}
          {upcomingEvents.map(e=><button key={"event-"+e.id} type="button" onClick={()=>onNavigate("agenda")} className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"><CalendarDays className="size-4"/></span>
            <span className="min-w-0 flex-1"><b className="block truncate text-sm">{e.title}</b><span className="text-xs text-muted-foreground">{e.classroom_name||"Todas as turmas"} · {new Date(e.start_at).toLocaleDateString("pt-BR")}</span></span>
          </button>)}
          {!tasks.isPending&&!calendar.isPending&&!upcomingTasks.length&&!upcomingEvents.length&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma atividade ou evento próximo.</p>}
        </div>
      </Card>
    </div>

    <Card title="Atalhos operacionais" description="Ações que costumam acontecer todos os dias.">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["notas","Lançar notas","Atualize o diário de notas.",BarChart3],
          ["frequencia","Frequência","Registre presença por data.",CheckCircle2],
          ["avaliacoes","Avaliações","Crie instrumentos e acompanhe resultados.",ClipboardCheck],
          ["comunicacao","Comunicação","Publique avisos para as turmas.",Megaphone],
        ] as [Section,string,string,LucideIcon][]).map(([go,title,desc,ActionIcon])=>{
          return <button key={String(go)} type="button" onClick={()=>onNavigate(go as Section)} className="flex items-start gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ActionIcon className="size-5"/></span>
            <span><b>{title}</b><p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p></span>
          </button>;
        })}
      </div>
    </Card>
  </div>;
}

function Classes({d,onNavigate}:{d:ReturnType<typeof useData>;onNavigate:(section:Section)=>void}){
  const [name,setName]=useState("");
  const [code,setCode]=useState("");
  const [selected,setSelected]=useState("");
  const [busy,setBusy]=useState("");
  const report=useQuery({queryKey:["teacher-new-report",selected],queryFn:()=>loadTeacherClassReport(selected),enabled:!!selected});

  async function create(){
    if(!name.trim())return;
    setBusy("create");
    try{
      await createTeacherClassroom(name.trim(),code.trim());
      setName("");setCode("");
      await d.refresh();
      toast.success("Turma criada e você foi vinculado a ela.");
    }catch(e){toast.error(errorText(e))}finally{setBusy("")}
  }

  async function join(id:string){
    setBusy("join:"+id);
    try{
      await teacherJoinClassroom(id);
      await d.refresh();
      setSelected(id);
      toast.success("Você foi vinculado à turma. Ela já está disponível no seu painel.");
    }catch(e){toast.error(errorText(e))}finally{setBusy("")}
  }

  async function leave(id:string){
    setBusy("leave:"+id);
    try{
      await teacherLeaveClassroom(id);
      await d.refresh();
      if(selected===id)setSelected("");
      toast.success("Você deixou a turma. Os dados da escola permanecem intactos.");
    }catch(e){toast.error(errorText(e))}finally{setBusy("")}
  }

  const myClassIds=new Set((d.classes.data??[]).map(c=>c.id));

  return <div className="space-y-5">
    <Card title="Minhas turmas" description="Turmas em que você atua. O vínculo é individual: uma mesma turma pode ter vários professores.">
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da nova turma"/>
        <Input value={code} onChange={e=>setCode(e.target.value)} placeholder="Código (opcional)"/>
        <Button disabled={busy!==""||!name.trim()} onClick={()=>void create()}><Plus className="mr-2 size-4"/>{busy==="create"?"Criando…":"Criar turma"}</Button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {(d.classes.data??[]).map(c=><button key={c.id} type="button" onClick={()=>setSelected(c.id)} className={"rounded-xl border p-4 text-left "+(selected===c.id?"border-primary bg-primary/5":"border-border")}>
          <b>{c.name}</b><p className="text-xs text-muted-foreground">{c.code||"Sem código"} · {c.student_count} aluno(s) · {c.status==="active"?"Ativa":"Arquivada"}</p>
        </button>)}
      </div>
      {(d.classes.data??[]).length===0&&<p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Você ainda não está vinculado a nenhuma turma. Escolha uma turma da escola abaixo quando quiser atuar nela.</p>}
    </Card>

    <Card title="Turmas da escola" description="Você pode consultar todas as turmas da sua escola. Vincule-se apenas às turmas em que realmente vai atuar; vários professores podem participar da mesma turma.">
      <div className="space-y-2">
        {(d.institutionClasses.data??[]).map(c=><div key={c.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={()=>myClassIds.has(c.id)&&setSelected(c.id)} className="min-w-0 text-left">
            <b>{c.name}</b>
            <p className="text-xs text-muted-foreground">{c.code||"Sem código"} · {c.student_count} aluno(s) · {c.teacher_count} professor(es)</p>
          </button>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {c.is_linked ? <><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Você atua aqui</span><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>void leave(c.id)}>Sair da turma</Button></> :
              <Button size="sm" disabled={!!busy} onClick={()=>void join(c.id)}>{busy==="join:"+c.id?"Vinculando…":"Vincular-me à turma"}</Button>}
          </div>
        </div>)}
        {d.institutionClasses.isPending&&<p className="text-sm text-muted-foreground">Carregando turmas da escola…</p>}
        {d.institutionClasses.error&&<p className="text-sm text-destructive">Não foi possível carregar as turmas da escola.</p>}
        {!d.institutionClasses.isPending&&!(d.institutionClasses.data??[]).length&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma turma ativa cadastrada nesta escola.</p>}
      </div>
    </Card>

    {selected&&myClassIds.has(selected)&&<Card title="Relatório da turma" description="Resumo acadêmico da turma selecionada. Cada indicador vem dos registros acadêmicos vinculados aos alunos."><div className="mb-4 grid gap-2 grid-cols-2 md:grid-cols-4"><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Alunos</p><b>{report.data?.length??0}</b></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Com nota</p><b>{(report.data??[]).filter(s=>s.grade_average!=null).length}</b></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Média da turma</p><b>{(()=>{const values=(report.data??[]).map(s=>s.grade_average).filter((v):v is number=>v!=null&&Number.isFinite(Number(v))).map(Number);return values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1):"—";})()}</b></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Frequência média</p><b>{(()=>{const values=(report.data??[]).map(s=>s.attendance_percent).filter((v):v is number=>v!=null&&Number.isFinite(Number(v))).map(Number);return values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(0)+"%":"—";})()}</b></div></div><div className="mb-4 grid gap-2 grid-cols-2"><div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-xs text-muted-foreground">Atenção nas notas</p><b>{(report.data??[]).filter(s=>s.grade_average!=null&&Number(s.grade_average)<6).length}</b><p className="mt-1 text-[11px] text-muted-foreground">Média abaixo de 6,0</p></div><div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-xs text-muted-foreground">Atenção na frequência</p><b>{(report.data??[]).filter(s=>s.attendance_percent!=null&&Number(s.attendance_percent)<75).length}</b><p className="mt-1 text-[11px] text-muted-foreground">Registro abaixo de 75%</p></div></div><div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[["Alunos","Veja a lista e ficha dos alunos.","alunos"],["Notas","Lance e acompanhe notas.","notas"],["Frequência","Registre presença e faltas.","frequencia"],["Atividades","Publique e corrija atividades.","atividades"],["Materiais","Publique PDFs e materiais.","materiais"],["Avaliações","Crie e acompanhe avaliações.","avaliacoes"],["Agenda","Organize aulas e eventos.","agenda"]].map(([title,desc,go])=><button key={title} type="button" onClick={()=>onNavigate(go as Section)} className="rounded-xl border border-border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"><b>{title}</b><p className="mt-1 text-xs text-muted-foreground">{desc}</p></button>)}</div><div className="space-y-2">{(report.data??[]).map(s=><div key={s.student_id} className="rounded-xl border border-border p-3"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><b>{s.student_name}</b><p className="text-xs text-muted-foreground">{s.enrollment} · Nota: média dos lançamentos · Frequência: registros de presença</p></div><div className="text-sm"><b>{s.grade_average==null?"—":Number(s.grade_average).toFixed(1)}</b> · {s.attendance_percent==null?"—":s.attendance_percent+"%"}</div></div></div>)}</div><div className="mt-4 rounded-xl border border-border p-4"><p className="font-semibold">Alunos que precisam de atenção</p><p className="mt-1 text-xs text-muted-foreground">Use esta lista para priorizar acompanhamento pedagógico.</p><div className="mt-3 space-y-2">{(report.data??[]).filter(s=>(s.grade_average!=null&&Number(s.grade_average)<6)||(s.attendance_percent!=null&&Number(s.attendance_percent)<75)).map(s=><div key={s.student_id} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"><div><b>{s.student_name}</b><p className="text-xs text-muted-foreground">{s.enrollment||"Sem matrícula"}</p></div><div className="flex flex-wrap gap-2 text-xs">{s.grade_average!=null&&Number(s.grade_average)<6&&<span className="rounded-full bg-amber-500/10 px-2 py-1">Nota {Number(s.grade_average).toFixed(1)}</span>}{s.attendance_percent!=null&&Number(s.attendance_percent)<75&&<span className="rounded-full bg-amber-500/10 px-2 py-1">Frequência {Number(s.attendance_percent).toFixed(0)}%</span>}</div></div>)}{!(report.data??[]).some(s=>(s.grade_average!=null&&Number(s.grade_average)<6)||(s.attendance_percent!=null&&Number(s.attendance_percent)<75))&&<p className="text-sm text-muted-foreground">Nenhum aluno sinalizado pelos critérios atuais. 🎉</p>}</div></div>{report.isLoading&&<p className="mt-3 text-sm text-muted-foreground">Carregando relatório…</p>}{report.error&&<div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar o relatório. <Button size="sm" variant="outline" onClick={()=>void report.refetch()}>Tentar novamente</Button></div>}</Card>}
  </div>;
}

function Students({d}:{d:ReturnType<typeof useData>}){
  const [search,setSearch]=useState("");
  const [debouncedSearch,setDebouncedSearch]=useState("");
  const [classStatus,setClassStatus]=useState("");
  const [page,setPage]=useState(1);
  const pageSize=25;
  const [busy,setBusy]=useState("");
  const [targetClass,setTargetClass]=useState<Record<string,string>>({});
  const [enrollments,setEnrollments]=useState<Record<string,string>>({});
  const [selectedStudent,setSelectedStudent]=useState<string|null>(null);
  const waiting=useQuery({queryKey:["teacher-new-unassigned"],queryFn:loadTeacherUnassignedStudents,staleTime:15000});
  const roster=useQuery({
    queryKey:["teacher-new-students-page",debouncedSearch,classStatus,page],
    queryFn:()=>loadTeacherInstitutionStudentsPage(debouncedSearch,classStatus,page,pageSize),
    placeholderData:previous=>previous,
  });
  const academic=useQuery({queryKey:["teacher-student-academic",selectedStudent],queryFn:()=>loadTeacherGrades(selectedStudent!),enabled:!!selectedStudent,staleTime:10000});
  useEffect(()=>{const timer=window.setTimeout(()=>{setDebouncedSearch(search.trim());setPage(1);},300);return()=>window.clearTimeout(timer);},[search]);
  useEffect(()=>{setPage(1);},[classStatus]);
  const list=roster.data?.items??[];
  const total=roster.data?.total??0;
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const availableClasses=d.classes.data??[];
  function classFor(id:string){return targetClass[id]??""}
  function enrollmentFor(s:{id:string;enrollment:string|null}){return enrollments[s.id]??s.enrollment??""}
  async function school(id:string){setBusy(id);try{await teacherLinkStudentToSchool(id);await Promise.all([waiting.refetch(),d.refresh()]);toast.success("Aluno vinculado à escola.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  async function enroll(id:string){const classroom=classFor(id);const enrollment=enrollmentFor({id,enrollment:(list.find(s=>s.id===id)?.enrollment??"")});if(!classroom){toast.error("Selecione uma turma.");return;}if(!enrollment.trim()){toast.error("Informe a matrícula do aluno.");return;}setBusy(id);try{await teacherEnrollStudentInClassroom(id,classroom,enrollment.trim());await d.refresh();toast.success("Aluno vinculado à turma.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  async function remove(id:string){setBusy(id);try{await teacherRemoveStudentFromClassroom(id);await d.refresh();toast.success("Aluno removido da turma.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  return <div className="space-y-5">
    <Card title="Alunos da instituição" description="Você pode consultar todos os alunos da sua escola. Para alterar a turma ou lançar dados acadêmicos, primeiro vincule-se à turma em que vai atuar.">
      <div className="grid gap-2 md:grid-cols-[1fr_220px]">
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, matrícula ou turma"/>
        <select value={classStatus} onChange={e=>setClassStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Todos os vínculos</option>
          <option value="minha_turma">Minhas turmas</option>
          <option value="sem_turma">Sem turma</option>
          <option value="outra_turma">Outra turma</option>
        </select>
      </div>
      <div className="mt-4 space-y-2">
        {list.map(s=><div key={s.id} className="rounded-xl border border-border p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0"><button type="button" className="text-left" onClick={()=>setSelectedStudent(selectedStudent===s.id?null:s.id)}><b className="hover:text-primary">{s.full_name}</b><p className="text-xs text-muted-foreground">{s.enrollment||"Sem matrícula"} · {s.classroom||"Sem turma"} · {s.class_status}</p><p className="mt-1 text-xs font-semibold text-primary">{selectedStudent===s.id?"Ocultar ficha":"Abrir ficha acadêmica →"}</p></button></div>
            {s.class_status!=="outra_turma"&&<div className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_160px_auto_auto]">
              <select value={classFor(s.id)} onChange={e=>setTargetClass(v=>({...v,[s.id]:e.target.value}))} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Turma em que você atua</option>{availableClasses.filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <Input value={enrollmentFor(s)} onChange={e=>setEnrollments(v=>({...v,[s.id]:e.target.value}))} placeholder="Matrícula"/>
              <Button disabled={!!busy||!classFor(s.id)||!enrollmentFor(s).trim()} onClick={()=>void enroll(s.id)}>{busy===s.id?"Salvando…":s.class_status==="minha_turma"?"Mover":"Vincular"}</Button>
              {s.class_status==="minha_turma"&&<Button variant="outline" disabled={!!busy} onClick={()=>void remove(s.id)}>Remover</Button>}
            </div>}
          </div>
        </div>)}
        {roster.isPending && <p className="text-sm text-muted-foreground">Carregando alunos…</p>}
        {roster.error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar os alunos. <Button size="sm" variant="outline" onClick={()=>void roster.refetch()}>Tentar novamente</Button></div>}
        {!roster.isPending && list.length===0&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum aluno encontrado nesta escola.</p>}
      </div>
      {total > 0 && <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Página {page} de {totalPages} · {total} aluno(s)</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={page<=1||roster.isFetching} onClick={()=>setPage(v=>Math.max(1,v-1))}>Anterior</Button>
          <Button type="button" size="sm" variant="outline" disabled={page>=totalPages||roster.isFetching} onClick={()=>setPage(v=>Math.min(totalPages,v+1))}>Próxima</Button>
        </div>
      </div>}
    </Card>
    {selectedStudent && <Card title="Ficha acadêmica do aluno" description="Resumo rápido para acompanhamento do aluno selecionado.">
      {academic.isPending && <p className="text-sm text-muted-foreground">Carregando histórico acadêmico…</p>}
      {academic.error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar a ficha. <Button size="sm" variant="outline" className="ml-2" onClick={()=>void academic.refetch()}>Tentar novamente</Button></div>}
      {!academic.isPending && !academic.error && (()=>{const grades=academic.data??[];const scored=grades.filter(g=>Number.isFinite(Number(g.score)));const average=scored.length?scored.reduce((sum,g)=>sum+Number(g.score),0)/scored.length:0;const absences=grades.reduce((sum,g)=>sum+Number(g.absences??0),0);return <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-primary/5 p-4"><p className="text-xs text-muted-foreground">Média simples</p><b className="text-2xl">{scored.length?average.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:2}):"—"}</b></div><div className="rounded-xl bg-secondary p-4"><p className="text-xs text-muted-foreground">Lançamentos</p><b className="text-2xl">{grades.length}</b></div><div className="rounded-xl bg-secondary p-4"><p className="text-xs text-muted-foreground">Faltas lançadas</p><b className="text-2xl">{absences}</b></div></div>
        <div className="grid gap-2 md:grid-cols-2">{grades.map(g=><div key={g.id} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between gap-3"><b>{g.subject}</b><b>{g.score}</b></div><p className="mt-1 text-xs text-muted-foreground">{g.period}º período · {g.absences??0} falta(s)</p></div>)}{!grades.length&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum lançamento acadêmico encontrado para este aluno.</p>}</div>
      </div>})()}
    </Card>}
    <Card title="Alunos sem escola" description="Vincule o aluno à escola ativa do professor antes de colocá-lo em uma turma.">
      <div className="space-y-2">{(waiting.data??[]).map(s=><div key={s.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><b>{s.full_name}</b><p className="text-xs text-muted-foreground">{s.enrollment||"Sem matrícula"}</p></div><Button disabled={!!busy} onClick={()=>void school(s.id)}>{busy===s.id?"Vinculando…":"Vincular à minha escola"}</Button></div>)}</div>
      {(waiting.data??[]).length===0&&<p className="text-sm text-muted-foreground">Não há alunos aguardando vínculo com uma escola.</p>}
    </Card>
  </div>;
}

function Subjects({d}:{d:ReturnType<typeof useData>}){
  const currentUser=useQuery({queryKey:["teacher-current-user"],queryFn:async()=>{const {data,error}=await supabase.auth.getUser();if(error)throw error;return data.user?.id??""},staleTime:300000});
  const [name,setName]=useState("");const [code,setCode]=useState("");const [subject,setSubject]=useState("");const [classroom,setClassroom]=useState("");const [busy,setBusy]=useState("");
  const [confirm,setConfirm]=useState<{kind:"unlink"|"delete";id:string;name:string;classroom:string}|null>(null);
  const [edit,setEdit]=useState<{id:string;name:string;code:string}|null>(null);
  async function create(){try{await createTeacherSubject(name.trim(),code.trim());setName("");setCode("");await d.refresh();toast.success("Disciplina criada.");}catch(e){toast.error(errorText(e))}}
  async function assign(){if(!subject||!classroom)return;setBusy("assign");try{await assignTeacherSubjectToClass(subject,classroom);setSubject("");setClassroom("");await d.refresh();toast.success("Disciplina vinculada à turma.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  async function confirmRemoveAssignment(){
    if(!confirm||confirm.kind!=="unlink")return;
    setBusy("remove:"+confirm.id);
    try{await unassignTeacherSubjectFromClass(confirm.id);await d.refresh();toast.success("Disciplina desvinculada.");setConfirm(null);}
    catch(e){toast.error(errorText(e))}
    finally{setBusy("")}
  }
  async function editSubject(){
    if(!edit)return;
    if(!edit.name.trim()){toast.error("Informe o nome da disciplina.");return;}
    setBusy("edit-subject:"+edit.id);
    try{
      await updateTeacherSubject(edit.id, edit.name.trim(), edit.code.trim());
      await d.refresh();
      toast.success("Disciplina atualizada.");
      setEdit(null);
    }catch(e){toast.error(errorText(e))}
    finally{setBusy("")}
  }
  async function confirmDeleteSubject(){
    if(!confirm||confirm.kind!=="delete")return;
    setBusy("delete-subject:"+confirm.id);
    try{await deleteTeacherSubject(confirm.id);await d.refresh();toast.success("Disciplina excluída.");setConfirm(null);}
    catch(e){toast.error(errorText(e))}
    finally{setBusy("")}
  }
  return <div className="space-y-5">
    <Card title="Disciplinas" description="Cadastre e distribua as disciplinas que você administra.">
      <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome"/><Input value={code} onChange={e=>setCode(e.target.value)} placeholder="Código"/><Button disabled={!name.trim()||!!busy} onClick={()=>void create()}><Plus className="mr-2 size-4"/>Criar</Button></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{(d.subjects.data??[]).map(s=><div key={s.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-3"><div><b>{s.name}</b><p className="text-xs text-muted-foreground">{s.code||"Sem código"} · {s.status}</p></div>{s.status==="active"&&s.created_by===currentUser.data&&<div className="flex gap-2"><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>setEdit({id:s.id,name:s.name,code:s.code||""})}>Editar</Button><Button size="sm" variant="ghost" className="text-destructive" disabled={!!busy} onClick={()=>setConfirm({kind:"delete",id:s.id,name:s.name,classroom:""})}>{busy==="delete-subject:"+s.id?"Excluindo…":"Excluir"}</Button></div>}</div></div>)}</div>
    </Card>
    <Card title="Vincular disciplina à turma" description="Uma disciplina precisa estar vinculada à turma antes de receber atividades e materiais.">
      <div className="grid gap-3 md:grid-cols-3"><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Selecione</option>{(d.subjects.data??[]).filter(s=>s.status==="active").map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><div className="self-end"><Button disabled={!subject||!classroom||!!busy} onClick={()=>void assign()}>{busy==="assign"?"Vinculando…":"Vincular"}</Button></div></div>
      <div className="mt-4 space-y-2">{(d.assignments.data??[]).map((a:{id:string;subject_name:string;classroom_name:string})=><div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"><div className="min-w-0"><b>{a.subject_name}</b><p className="text-xs text-muted-foreground">{a.classroom_name}</p></div><Button size="sm" variant="ghost" className="text-destructive" disabled={!!busy} onClick={()=>setConfirm({kind:"unlink",id:a.id,name:a.subject_name,classroom:a.classroom_name})}>{busy==="remove:"+a.id?"Removendo…":"Desvincular"}</Button></div>)}</div>
      {!d.assignments.isPending&&!(d.assignments.data??[]).length&&<p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma disciplina foi vinculada a uma turma ainda.</p>}
    </Card>
    <ConfirmActionDialog
      open={!!confirm}
      onOpenChange={open=>{if(!open)setConfirm(null)}}
      title={confirm?.kind==="delete" ? "Excluir disciplina?" : "Desvincular disciplina?"}
      description={confirm?.kind==="delete"
        ? 'A disciplina "'+(confirm?.name??"")+'" será excluída e seus vínculos com as turmas serão removidos. Esta ação não pode ser desfeita.'
        : 'A disciplina "'+(confirm?.name??"")+'" será desvinculada da turma "'+(confirm?.classroom??"")+'". A disciplina continuará cadastrada no SINA.'}
      actionLabel={confirm?.kind==="delete" ? "Excluir disciplina" : "Desvincular"}
      loading={busy.startsWith("delete-subject:") || busy.startsWith("remove:")}
      onConfirm={()=>void (confirm?.kind==="delete" ? confirmDeleteSubject() : confirmRemoveAssignment())}
    />
    <Dialog open={!!edit} onOpenChange={open=>{if(!open&&busy!=="edit-subject:"+edit?.id)setEdit(null)}}>
      <DialogContent className="rounded-2xl border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar disciplina</DialogTitle>
          <DialogDescription>Atualize o nome e o código da disciplina sem sair do contexto acadêmico.</DialogDescription>
        </DialogHeader>
        {edit&&<div className="grid gap-4 py-2">
          <Field label="Nome da disciplina">
            <Input autoFocus value={edit.name} onChange={e=>setEdit(v=>v?({...v,name:e.target.value}):v)} placeholder="Ex.: Matemática"/>
          </Field>
          <Field label="Código">
            <Input value={edit.code} onChange={e=>setEdit(v=>v?({...v,code:e.target.value}):v)} placeholder="Ex.: MAT01"/>
          </Field>
        </div>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy==="edit-subject:"+edit?.id} onClick={()=>setEdit(null)}>Cancelar</Button>
          <Button type="button" disabled={!edit?.name.trim()||busy==="edit-subject:"+edit?.id} onClick={()=>void editSubject()}>
            {busy==="edit-subject:"+edit?.id?"Salvando…":"Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Grades({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");
  const [subject,setSubject]=useState("");
  const [period,setPeriod]=useState("1");
  const [drafts,setDrafts]=useState<Record<string,{score:string;absences:string}>>({});
  const [busy,setBusy]=useState(false);
  const [clearStudentId,setClearStudentId]=useState<string|null>(null);
  const options=useQuery({queryKey:["teacher-new-options"],queryFn:loadTeacherAcademicOptions,staleTime:30000});
  const assignments=(d.assignments.data??[]).filter(a=>a.classroom_id===classroom);
  const subjectOptions=assignments.filter((a,index,self)=>self.findIndex(x=>x.subject_id===a.subject_id)===index);
  const selectedSubject=subjectOptions.find(a=>a.subject_id===subject);
  const configuredTerms=(options.data?.terms??[]).slice(0,4);
  const periodOptions=configuredTerms.length
    ? configuredTerms.map((term,index)=>({value:String(index+1),label:term.name}))
    : [1,2,3,4].map(value=>({value:String(value),label:value+"º período"}));
  const periodStatus=useQuery({ queryKey:["teacher-gradebook-period-status",period], queryFn:()=>loadTeacherGradebookPeriodStatus(Number(period)), staleTime:10000, refetchOnWindowFocus:true });
  const periodClosed=periodStatus.data?.is_closed === true;
  const gradebook=useQuery({
    queryKey:["teacher-gradebook",classroom,subject,period],
    queryFn:()=>loadTeacherGradebook(classroom,subject,Number(period)),
    enabled:!!classroom&&!!subject&&!!period,
    staleTime:10000,
  });

  useEffect(()=>{
    if(!configuredTerms.length) return;
    const currentIndex=configuredTerms.findIndex(term=>term.is_current);
    if(currentIndex>=0) setPeriod(String(currentIndex+1));
  },[options.data?.terms]);

  useEffect(()=>{
    setDrafts({});
  },[classroom,subject,period]);

  useEffect(()=>{
    if(!gradebook.data) return;
    setDrafts(prev=>{
      const next={...prev};
      for(const row of gradebook.data){
        if(next[row.student_id]) continue;
        next[row.student_id]={
          score:row.score==null?"":String(row.score),
          absences:String(row.absences??0),
        };
      }
      return next;
    });
  },[gradebook.data]);

  function updateDraft(studentId:string,key:"score"|"absences",value:string){
    setDrafts(prev=>({
      ...prev,
      [studentId]:{score:prev[studentId]?.score??"",absences:prev[studentId]?.absences??"0",[key]:value}
    }));
  }

  async function save(){
    if(periodClosed){ toast.error("Este período está encerrado. Solicite ao administrador a reabertura."); return; }
    if(!classroom||!subject||!gradebook.data?.length){
      toast.error("Selecione turma, disciplina e carregue o diário.");
      return;
    }

    const rows: Array<{student_id:string;score:number;absences:number}>=[];
    const clearRows: Array<{student_id:string;absences:number}>=[];

    for(const row of gradebook.data){
      const draft=drafts[row.student_id]??{score:row.score==null?"":String(row.score),absences:String(row.absences??0)};
      const rawScore=draft.score.trim();
      if(!rawScore){
        if(row.score!=null){
          const absences=Number(draft.absences);
          if(!Number.isInteger(absences)||absences<0){
            toast.error("Existe uma quantidade de faltas inválida.");
            return;
          }
          clearRows.push({student_id:row.student_id,absences});
        }
        continue;
      }
      const score=Number(rawScore.replace(",","."));
      const absences=Number(draft.absences);
      if(!Number.isFinite(score)||score<0||score>10){
        toast.error("Existe uma nota inválida. Use valores entre 0 e 10.");
        return;
      }
      if(!Number.isInteger(absences)||absences<0){
        toast.error("Existe uma quantidade de faltas inválida.");
        return;
      }
      rows.push({student_id:row.student_id,score,absences});
    }

    if(!rows.length&&!clearRows.length){
      toast.error("Faça uma alteração antes de salvar.");
      return;
    }

    setBusy(true);
    try{
      const saved=rows.length
        ? await saveTeacherGradebook({classroomId:classroom,subjectId:subject,period:Number(period),rows})
        : 0;
      const cleared=clearRows.length
        ? await clearTeacherGradebookScores({classroomId:classroom,subjectId:subject,period:Number(period),rows:clearRows})
        : 0;
      await gradebook.refetch();
      setDrafts({});
      toast.success((saved+cleared)+" alteração(ões) salva(s).");
    }catch(e){
      toast.error(errorText(e));
    }finally{
      setBusy(false);
    }
  }

  const rows=gradebook.data??[];
  const filled=rows.filter(row=>{
    const draft=drafts[row.student_id];
    return (draft?.score??(row.score==null?"":String(row.score)))!=="";
  }).length;
  const pending=Math.max(0,rows.length-filled);
  const averageValues=rows
    .map(row=>drafts[row.student_id]?.score??(row.score==null?"":String(row.score)))
    .map(value=>Number(value.replace(",",".")||NaN))
    .filter(value=>Number.isFinite(value));
  const average=averageValues.length?averageValues.reduce((sum,value)=>sum+value,0)/averageValues.length:null;

  return <div className="space-y-5">
    <Card title="Diário de notas" description="Lance as notas da turma inteira de uma vez. O lançamento fica vinculado à turma, à disciplina, ao professor e ao período acadêmico selecionado.">
      <div className="grid gap-3 md:grid-cols-3">
        <Select label="Turma" value={classroom} onChange={value=>{setClassroom(value);setSubject("");setDrafts({});}}>
          <option value="">Selecione</option>
          {(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select label="Disciplina" value={subject} onChange={value=>{setSubject(value);setDrafts({});}}>
          <option value="">Selecione</option>
          {subjectOptions.map(item=><option key={item.subject_id} value={item.subject_id}>{item.subject_name}</option>)}
        </Select>
        <Select label="Período acadêmico" value={period} onChange={setPeriod}>
          {periodOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </div>

      {periodClosed&&<div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 size-4 text-destructive"/><div><p className="font-semibold">Período encerrado</p><p className="mt-1 text-muted-foreground">As notas oficiais deste período estão protegidas contra alterações. O diário permanece disponível para consulta.</p>{periodStatus.data?.closed_at&&<p className="mt-1 text-xs text-muted-foreground">Encerrado em {new Date(periodStatus.data.closed_at).toLocaleString("pt-BR")}.</p>}</div></div></div>}

      {selectedSubject&&<div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm">
        <b>{selectedSubject.subject_name}</b>
        <span className="text-muted-foreground"> · {selectedSubject.classroom_name} · professor responsável: você</span>
      </div>}

      {classroom&&subject&&(
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Alunos</p>
            <b className="mt-1 block text-2xl tabular-nums">{rows.length}</b>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Notas preenchidas</p>
            <b className="mt-1 block text-2xl tabular-nums">{filled}</b>
            <p className="text-[11px] text-muted-foreground">{pending} pendente(s)</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Média da turma</p>
            <b className="mt-1 block text-2xl tabular-nums">{average==null?"—":formatScore(average)}</b>
          </div>
        </div>
      )}

      {gradebook.isError&&(
        <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">Não foi possível carregar o diário.</p>
          <p className="mt-1 text-muted-foreground">{errorText(gradebook.error)}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={()=>void gradebook.refetch()}>Tentar novamente</Button>
        </div>
      )}

      {gradebook.isPending&&<div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Carregando diário…</div>}

      {!gradebook.isPending&&!gradebook.isError&&classroom&&subject&&rows.length===0&&(
        <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum aluno está vinculado a esta turma ainda.
        </div>
      )}

      {rows.length>0&&(
        <div className="mt-5 overflow-hidden rounded-2xl border border-border">
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_120px_120px] gap-3 bg-secondary/60 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Aluno</span><span>Nota</span><span>Faltas</span><span>Situação</span>
          </div>
          <div className="divide-y divide-border">
            {rows.map(row=>{
              const draft=drafts[row.student_id]??{score:row.score==null?"":String(row.score),absences:String(row.absences??0)};
              const score=Number(draft.score.replace(",","."));
              const hasScore=draft.score.trim()!=="";
              const validScore=hasScore&&Number.isFinite(score)&&score>=0&&score<=10;
              return <div key={row.student_id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_150px_120px_120px] md:items-center">
                <div className="min-w-0">
                  <p className="font-semibold">{row.full_name}</p>
                  <p className="text-xs text-muted-foreground">{row.enrollment||"Sem matrícula"}</p>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground md:hidden">Nota</label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step=".01"
                    inputMode="decimal"
                    placeholder="0,0–10,0"
                    value={draft.score}
                    onChange={e=>updateDraft(row.student_id,"score",e.target.value)}
                    disabled={periodClosed}
                    aria-label={"Nota de "+row.full_name}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground md:hidden">Faltas</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={draft.absences}
                    onChange={e=>updateDraft(row.student_id,"absences",e.target.value)}
                    disabled={periodClosed}
                    aria-label={"Faltas de "+row.full_name}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={
                    !hasScore
                      ? "inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                      : validScore
                        ? "inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                        : "inline-flex rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive"
                  }>
                    {!hasScore?"Pendente":validScore?"Preenchida":"Inválida"}
                  </span>
                  {row.score!=null&&<Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-destructive hover:text-destructive" disabled={busy||periodClosed} onClick={()=>setClearStudentId(row.student_id)}>
                    <Trash2 className="mr-1 size-3"/>Limpar nota
                  </Button>}
                </div>
              </div>;
            })}
          </div>
        </div>
      )}

      {rows.length>0&&(
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Você pode editar várias linhas e salvar tudo em um único lançamento.</p>
          <Button disabled={busy||gradebook.isPending||periodClosed} onClick={()=>void save()}>{busy?"Salvando…":"Salvar alterações"}</Button>
        </div>
      )}

      {!classroom&&!gradebook.isPending&&<div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Selecione uma turma para começar o diário de notas.</div>}

      <ConfirmActionDialog
        open={!!clearStudentId&&!periodClosed}
        onOpenChange={open=>{if(!open&&!busy)setClearStudentId(null)}}
        title="Limpar nota lançada?"
        description="A nota oficial deste aluno será removida deste período. As faltas permanecem registradas."
        actionLabel="Limpar nota"
        loading={busy}
        onConfirm={async()=>{
          if(!clearStudentId||!classroom||!subject)return;
          setBusy(true);
          try{
            await clearTeacherGradebookScores({classroomId:classroom,subjectId:subject,period:Number(period),rows:[{student_id:clearStudentId,absences:Number(drafts[clearStudentId]?.absences??0)}]});
            await gradebook.refetch();
            setDrafts({});
            toast.success("Nota removida do diário.");
            setClearStudentId(null);
          }catch(e){toast.error(errorText(e))}
          finally{setBusy(false)}
        }}
      />
    </Card>
  </div>;
}

function Attendance({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");
  const [subject,setSubject]=useState("");
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [rows,setRows]=useState<AttendanceRow[]>([]);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);

  const subjectOptions=(d.assignments.data??[]).filter(a=>a.classroom_id===classroom);
  const selectedSubject=subjectOptions.find(a=>a.subject_id===subject);

  async function load(){
    if(!classroom){toast.error("Selecione uma turma.");return;}
    if(!subject){toast.error("Selecione a disciplina.");return;}
    setLoading(true);
    try{setRows(await loadAttendance(classroom,date,subject));}
    catch(e){setRows([]);toast.error(errorText(e))}
    finally{setLoading(false)}
  }

  async function save(){
    if(!classroom||!subject||!rows.length){toast.error("Carregue o diário antes de salvar.");return;}
    setBusy(true);
    try{
      await saveAttendance(classroom,date,subject,rows.map(r=>({student_id:r.student_id,status:r.status,note:r.note})));
      toast.success("Frequência salva.");
    }catch(e){toast.error(errorText(e))}
    finally{setBusy(false)}
  }

  const present=rows.filter(r=>r.status==="present").length;
  const absent=rows.filter(r=>r.status==="absent").length;
  const late=rows.filter(r=>r.status==="late").length;
  const excused=rows.filter(r=>r.status==="excused").length;

  return <Card title="Frequência" description="Diário por turma, disciplina e data. Cada lançamento fica ligado ao professor responsável pela disciplina.">
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
      <Select label="Turma" value={classroom} onChange={value=>{setClassroom(value);setSubject("");setRows([]);}}>
        <option value="">Selecione</option>
        {(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Select label="Disciplina" value={subject} onChange={value=>{setSubject(value);setRows([]);}}>
        <option value="">Selecione</option>
        {subjectOptions.map(a=><option key={a.id} value={a.subject_id}>{a.subject_name}</option>)}
      </Select>
      <Field label="Data"><Input type="date" value={date} onChange={e=>{setDate(e.target.value);setRows([]);}}/></Field>
      <div className="self-end"><Button disabled={!classroom||!subject||loading} onClick={()=>void load()}>{loading?"Carregando…":"Carregar diário"}</Button></div>
    </div>

    {selectedSubject&&<div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm">
      <b>{selectedSubject.subject_name}</b><span className="text-muted-foreground"> · Professor responsável pelo registro: você</span>
    </div>}

    {rows.length>0&&<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Presentes</p><b>{present}</b></div>
      <div className="rounded-xl bg-destructive/5 p-3"><p className="text-xs text-muted-foreground">Faltas</p><b>{absent}</b></div>
      <div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Atrasados</p><b>{late}</b></div>
      <div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Justificados</p><b>{excused}</b></div>
    </div>}
    {rows.length>0&&<div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-3">
      <span className="mr-1 text-xs font-semibold text-muted-foreground">Ações rápidas:</span>
      <Button size="sm" variant="outline" disabled={busy||loading} onClick={()=>setRows(current=>current.map(row=>({...row,status:"present" as const})))}>Marcar todos presentes</Button>
      <span className="text-xs text-muted-foreground">Confira a lista antes de salvar.</span>
    </div>}

    <div className="mt-4 space-y-2">
      {rows.map((r,i)=><div key={r.student_id} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[1fr_160px_1fr]">
        <div><b>{r.full_name}</b><p className="text-xs text-muted-foreground">{r.enrollment} · {selectedSubject?.subject_name||"Disciplina selecionada"}</p></div>
        <select value={r.status} onChange={e=>setRows(v=>v.map((x,j)=>j===i?{...x,status:e.target.value as AttendanceRow["status"]}:x))} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="present">Presente</option><option value="absent">Ausente</option><option value="late">Atrasado</option><option value="excused">Justificado</option>
        </select>
        <Input value={r.note} onChange={e=>setRows(v=>v.map((x,j)=>j===i?{...x,note:e.target.value}:x))} placeholder="Observação"/>
      </div>)}
      {rows.length>0&&<Button disabled={busy} onClick={()=>void save()}>{busy?"Salvando…":"Salvar frequência"}</Button>}
    </div>
  </Card>;
}
function Assessments({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [subject,setSubject]=useState("");const [term,setTerm]=useState("");const [title,setTitle]=useState("");const [type,setType]=useState("prova");const [weight,setWeight]=useState("1");const [max,setMax]=useState("10");const [due,setDue]=useState("");const [busy,setBusy]=useState(false);const [selectedAssessmentId,setSelectedAssessmentId]=useState("");const [scores,setScores]=useState<Record<string,string>>({});const [feedback,setFeedback]=useState<Record<string,string>>({});
  const options=useQuery({queryKey:["teacher-new-options"],queryFn:loadTeacherAcademicOptions,staleTime:30000});const list=useQuery({queryKey:["teacher-new-assessments",classroom],queryFn:()=>loadTeacherAssessments(classroom),enabled:!!classroom});
  const results=useQuery({queryKey:["teacher-new-assessment-results",selectedAssessmentId],queryFn:async()=>{const {data,error}=await supabase.rpc("teacher_list_assessment_scores",{_assessment_id:selectedAssessmentId});if(error)throw error;return data??[]},enabled:!!selectedAssessmentId,staleTime:10000});
  async function create(){
    const normalizedWeight=Number(weight.replace(",","."));
    const normalizedMax=Number(max.replace(",","."));
    if(!classroom){toast.error("Selecione a turma.");return;}
    if(!title.trim()){toast.error("Informe o título da avaliação.");return;}
    if(!Number.isFinite(normalizedWeight)||normalizedWeight<=0){toast.error("O peso deve ser maior que zero.");return;}
    if(!Number.isFinite(normalizedMax)||normalizedMax<=0){toast.error("A nota máxima deve ser maior que zero.");return;}
    setBusy(true);
    try{
      await createAssessment({classroomId:classroom,subjectId:subject||null,termId:term||null,title:title.trim(),type:type.trim()||"prova",weight:normalizedWeight,maxScore:normalizedMax,dueAt:due?new Date(due).toISOString():null});
      setTitle("");setDue("");await list.refetch();toast.success("Avaliação criada.");
    }catch(e){toast.error(errorText(e))}finally{setBusy(false)}
  }
  const assessmentSubjectIds=new Set((d.assignments.data??[]).filter(a=>a.classroom_id===classroom).map(a=>a.subject_id));
  const assessmentSubjects=(options.data?.subjects??[]).filter(s=>assessmentSubjectIds.has(s.id));
  const selectedAssessment=list.data?.find(a=>a.id===selectedAssessmentId);
  return <Card title="Avaliações" description="Crie avaliações, selecione uma delas e lance notas e feedback por aluno."><div className="grid gap-3 md:grid-cols-3"><Select label="Turma" value={classroom} onChange={v=>{setClassroom(v);setSubject("");}}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Opcional</option>{assessmentSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select label="Período" value={term} onChange={setTerm}><option value="">Opcional</option>{(options.data?.terms??[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Tipo"><Input value={type} onChange={e=>setType(e.target.value)}/></Field><Field label="Peso"><Input type="number" value={weight} onChange={e=>setWeight(e.target.value)}/></Field><Field label="Nota máxima"><Input type="number" value={max} onChange={e=>setMax(e.target.value)}/></Field><Field label="Prazo"><Input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></Field><div className="self-end"><Button disabled={busy||!classroom||!title.trim()} onClick={()=>void create()}>{busy?"Salvando…":"Criar avaliação"}</Button></div></div><div className="mt-4 space-y-2">{list.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar as avaliações. <Button size="sm" variant="outline" onClick={()=>void list.refetch()}>Tentar novamente</Button></div>}{(list.data??[]).map(a=><div key={a.id} className="rounded-xl border border-border p-3"><button type="button" className="w-full text-left" onClick={()=>setSelectedAssessmentId(a.id)}><b>{a.title}</b><p className="text-xs text-muted-foreground">{a.subject_name} · {a.term_name} · {a.max_score} pontos</p><p className="mt-1 text-xs font-semibold text-primary">Abrir lançamento →</p></button></div>)}</div>
    {selectedAssessment && <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4"><b>Lançamento de resultados</b><p className="mt-1 text-sm text-muted-foreground">{selectedAssessment.title} · peso {selectedAssessment.weight} · nota máxima {selectedAssessment.max_score}</p><div className="mt-3">{results.error&&<div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar os resultados desta avaliação. <Button size="sm" variant="outline" onClick={()=>void results.refetch()}>Tentar novamente</Button></div>}<div className="grid gap-2 grid-cols-2 sm:grid-cols-3"><div className="rounded-xl border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Alunos da turma</p><b>{(d.students.data??[]).filter(s=>s.classroom_id===classroom).length}</b></div><div className="rounded-xl border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Corrigidos</p><b>{results.data?.length??0}</b></div><div className="rounded-xl border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Pendentes</p><b>{Math.max(0,(d.students.data??[]).filter(s=>s.classroom_id===classroom).length-(results.data?.length??0))}</b></div></div><div className="mt-4 space-y-2">{(d.students.data??[]).filter(s=>s.classroom_id===classroom).map(s=>{const r=results.data?.find(x=>x.student_id===s.id);return <div key={s.id} className="grid gap-2 rounded-xl border border-border bg-background p-3 md:grid-cols-[1fr_120px_1fr_auto]"><div><b>{s.full_name}</b><p className="text-xs text-muted-foreground">{s.enrollment||"Sem matrícula"} · {r?"Resultado já lançado":"Ainda sem resultado"}</p></div><Input type="number" min="0" max={String(selectedAssessment.max_score)} step=".01" placeholder="Nota" value={scores[s.id]??(r?.score==null?"":String(r.score))} onChange={e=>setScores(v=>({...v,[s.id]:e.target.value}))}/><Input placeholder="Feedback" value={feedback[s.id]??(r?.feedback??"")} onChange={e=>setFeedback(v=>({...v,[s.id]:e.target.value}))}/><Button disabled={busy||scores[s.id]===""&&r?.score==null} onClick={async()=>{
  const raw=scores[s.id]??(r?.score==null?"":String(r.score));
  const value=Number(raw.replace(",","."));
  if(!Number.isFinite(value)||value<0||value>Number(selectedAssessment.max_score)){toast.error(`A nota deve ficar entre 0 e ${selectedAssessment.max_score}.`);return;}
  setBusy(true);
  try{
    await supabase.rpc("teacher_upsert_assessment_score",{_assessment_id:selectedAssessment.id,_student_id:s.id,_score:value,_feedback:feedback[s.id]??r?.feedback??""});
    await results.refetch();toast.success("Resultado salvo.");
  }catch(e){toast.error(errorText(e))}finally{setBusy(false)}
}}>Salvar</Button></div>})}</div>{results.error&&<p className="mt-3 text-sm text-destructive">Não foi possível carregar os resultados desta avaliação.</p>}</div></div>}
    </Card>;
}

function Tasks({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [subject,setSubject]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [due,setDue]=useState("");const [selected,setSelected]=useState("");const [busy,setBusy]=useState(false);const [scores,setScores]=useState<Record<string,string>>({});const [feedback,setFeedback]=useState<Record<string,string>>({});
  const [attachment,setAttachment]=useState<File|null>(null);const [editing,setEditing]=useState<string|null>(null);
  const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const tasks=useQuery({queryKey:["teacher-new-tasks"],queryFn:loadTeacherTasks,staleTime:15000,refetchOnWindowFocus:true});const submissions=useQuery({queryKey:["teacher-new-submissions",selected],queryFn:()=>loadTaskSubmissions(selected),enabled:!!selected,refetchOnWindowFocus:true});
  const selectedTask=tasks.data?.find(t=>t.id===editing)??null;
  const taskSubjectOptions=(d.assignments.data??[]).filter(a=>a.classroom_id===classroom);
  const taskSubjectIds=new Set(taskSubjectOptions.map(a=>a.subject_id));
  const taskSubjects=(d.subjects.data??[]).filter(s=>s.status==="active" && taskSubjectIds.has(s.id));

  function resetForm(){setTitle("");setDescription("");setDue("");setAttachment(null);setEditing(null);}

  async function create(){
    if(!classroom||!subject||!title.trim()){toast.error("Selecione turma, disciplina e informe o título.");return;}
    setBusy(true);
    let uploadedPath:string|null=null;
    try{
      const uploaded=attachment?await uploadAcademicAttachment(attachment,"tasks"):null;
      uploadedPath=uploaded?.path??null;
      await createTeacherTask({classroom,subject,title:title.trim(),description:description.trim(),dueAt:due?new Date(due).toISOString():null,attachment:uploaded});
      resetForm();await Promise.all([tasks.refetch(),qc.invalidateQueries({queryKey:["teacher-overview-tasks"]})]);toast.success("Atividade publicada.");
    }catch(e){
      if(uploadedPath) void supabase.storage.from("academic-attachments").remove([uploadedPath]);
      toast.error(errorText(e));
    }finally{setBusy(false)}
  }

  async function update(){
    if(!editing||!classroom||!subject||!title.trim()){toast.error("Preencha turma, disciplina e título.");return;}
    setBusy(true);
    let uploadedPath:string|null=null;
    try{
      const uploaded=attachment?await uploadAcademicAttachment(attachment,"tasks"):null;
      uploadedPath=uploaded?.path??null;
      await updateTeacherTask({id:editing,classroom,subject,title:title.trim(),description:description.trim(),dueAt:due?new Date(due).toISOString():null,attachmentPath:uploaded?.path??selectedTask?.attachment_path??null,attachmentName:uploaded?.name??selectedTask?.attachment_name??null,attachmentSize:uploaded?.size??selectedTask?.attachment_size??null,attachmentType:uploaded?.type??selectedTask?.attachment_type??null});
      resetForm();await Promise.all([tasks.refetch(),qc.invalidateQueries({queryKey:["teacher-overview-tasks"]})]);toast.success("Atividade atualizada.");
    }catch(e){
      if(uploadedPath) void supabase.storage.from("academic-attachments").remove([uploadedPath]);
      toast.error(errorText(e));
    }finally{setBusy(false)}
  }

  async function remove(){
    if(!confirmDelete)return;
    setBusy(true);
    try{await deleteTeacherTask(confirmDelete);if(selected===confirmDelete)setSelected("");await Promise.all([tasks.refetch(),qc.invalidateQueries({queryKey:["teacher-overview-tasks"]})]);toast.success("Atividade excluída.");setConfirmDelete(null);}
    catch(e){toast.error(errorText(e))}
    finally{setBusy(false)}
  }

  async function grade(id:string){const n=Number(scores[id]);if(Number.isNaN(n)||n<0||n>10){toast.error("A nota deve estar entre 0 e 10.");return;}try{await gradeTaskSubmission(id,n,feedback[id]??"");await Promise.all([submissions.refetch(),qc.invalidateQueries({queryKey:["student-module-submissions"]}),qc.invalidateQueries({queryKey:["student-module-tasks"]}),qc.invalidateQueries({queryKey:["teacher-overview-tasks"]})]);toast.success("Entrega corrigida.");}catch(e){toast.error(errorText(e))}}

  function startEdit(t:TeacherTask){
    const classroomId=(d.classes.data??[]).find(c=>c.id===t.classroom||c.name===t.classroom)?.id??"";
    const subjectId=(d.subjects.data??[]).find(s=>s.id===t.subject||s.name===t.subject)?.id??"";
    setEditing(t.id);setClassroom(classroomId);setSubject(subjectId);setTitle(t.title);setDescription(t.description);setDue(t.due_at?new Date(t.due_at).toISOString().slice(0,16):"");setAttachment(null);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  return <Card title="Atividades e entregas" description="Publique atividades, anexe PDF/arquivos e acompanhe as entregas.">
    <div className="grid gap-3 md:grid-cols-2">
      <Select label="Turma" value={classroom} onChange={v=>{setClassroom(v);setSubject("");}}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      <Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Selecione</option>{taskSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      <Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Lista de exercícios"/></Field>
      <Field label="Prazo"><Input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></Field>
      <Field label="Descrição"><textarea value={description} onChange={e=>setDescription(e.target.value)} className="min-h-24 rounded-md border border-input bg-background p-3 text-sm"/></Field>
      <Field label="Arquivo (PDF ou outro)"><div className="flex items-center gap-2"><Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={e=>setAttachment(e.target.files?.[0]??null)}/>{attachment&&<button type="button" className="text-muted-foreground hover:text-foreground" onClick={()=>setAttachment(null)} aria-label="Remover arquivo"><X className="size-4"/></button>}</div><p className="text-[11px] text-muted-foreground">Máximo 20 MB. O aluno receberá um link seguro.</p></Field>
      <div className="flex items-end gap-2"><Button disabled={busy||!classroom||!subject||!title.trim()} onClick={()=>void(editing?update():create())}>{busy?(editing?"Salvando…":"Publicando…"):(editing?"Salvar alterações":"Publicar atividade")}</Button>{editing&&<Button type="button" variant="outline" onClick={resetForm} disabled={busy}>Cancelar</Button>}</div>
    </div>
    <div className="mt-5 grid gap-2 md:grid-cols-2">
      {tasks.error&&<div className="col-span-full rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar as atividades. <Button size="sm" variant="outline" onClick={()=>void tasks.refetch()}>Tentar novamente</Button></div>}
      {(tasks.data??[]).map(t=><div key={t.id} className={"rounded-xl border p-3 "+(selected===t.id?"border-primary bg-primary/5":"border-border")}>
        <button type="button" onClick={()=>setSelected(t.id)} className="w-full text-left"><b>{t.title}</b><p className="text-xs text-muted-foreground">{t.classroom} · {t.subject} · {t.due_at?new Date(t.due_at).toLocaleString("pt-BR"):"Sem prazo"}</p></button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {t.attachment_name&&<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="size-3"/> {t.attachment_name}</span>}
          <Button size="sm" variant="ghost" onClick={()=>startEdit(t)}><Pencil className="mr-1 size-3"/>Editar</Button>
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={()=>setConfirmDelete(t.id)}><Trash2 className="mr-1 size-3"/>Excluir</Button>
        </div>
      </div>)}
    </div>
    <ConfirmActionDialog
      open={!!confirmDelete}
      onOpenChange={open=>{if(!open&&!busy)setConfirmDelete(null)}}
      title="Excluir atividade?"
      description="A atividade será excluída. As entregas vinculadas podem deixar de aparecer para os alunos."
      actionLabel="Excluir atividade"
      loading={busy}
      onConfirm={remove}
    />
    {selected&&<div className="mt-5 space-y-3">
      {submissions.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar as entregas. <Button size="sm" variant="outline" onClick={()=>void submissions.refetch()}>Tentar novamente</Button></div>}
      {!submissions.isPending&&!submissions.error&&<div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Entregas</p><b className="mt-1 block text-xl">{submissions.data?.length??0}</b></div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-xs text-muted-foreground">Aguardando correção</p><b className="mt-1 block text-xl">{(submissions.data??[]).filter(s=>s.status==="submitted"||s.status==="in_progress").length}</b></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Corrigidas</p><b className="mt-1 block text-xl">{(submissions.data??[]).filter(s=>s.status==="graded").length}</b></div>
      </div>}
      {submissions.isPending&&<div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Carregando entregas…</div>}
      {(submissions.data??[]).map(s=><div key={s.id} className="rounded-xl border border-border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><b>{s.student_name}</b><p className="text-xs text-muted-foreground">{s.enrollment}</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{s.status==="graded"?"Corrigida":s.status==="submitted"?"Entregue":s.status==="in_progress"?"Em andamento":"Sem entrega"}</span></div>
        <p className="mt-2 text-sm">{s.content||"Sem resposta textual."}</p>{s.attachment_name&&<p className="mt-1 text-xs text-muted-foreground">Anexo enviado: {s.attachment_name}</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto]"><Input type="number" min="0" max="10" step=".01" placeholder="Nota" value={scores[s.id]??(s.score==null?"":String(s.score))} onChange={e=>setScores(v=>({...v,[s.id]:e.target.value}))}/><Input placeholder="Feedback para o aluno" value={feedback[s.id]??(s.feedback??"")} onChange={e=>setFeedback(v=>({...v,[s.id]:e.target.value}))}/><Button disabled={scores[s.id]===""&&s.score==null} onClick={()=>void grade(s.id)}>Corrigir</Button></div>
      </div>)}
      {selected&&!submissions.isPending&&!submissions.error&&!(submissions.data??[]).length&&<div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhum aluno enviou uma entrega para esta atividade ainda.</div>}
    </div>}
  </Card>;
}

function Agenda({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [start,setStart]=useState("");const [type,setType]=useState("aula");const [busy,setBusy]=useState("");const [editing,setEditing]=useState<string|null>(null);const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const from=new Date(Date.now()-30*86400000).toISOString();const to=new Date(Date.now()+180*86400000).toISOString();const events=useQuery({queryKey:["teacher-new-calendar",from,to],queryFn:()=>loadTeacherCalendar(from,to),staleTime:30000});
  function reset(){setClassroom("");setTitle("");setDescription("");setStart("");setType("aula");setEditing(null);}
  function startEdit(event:NonNullable<typeof events.data>[number]){
    setEditing(event.id);setClassroom(event.classroom_id??"");setTitle(event.title);setDescription(event.description??"");setStart(event.start_at?new Date(event.start_at).toISOString().slice(0,16):"");setType(event.event_type||"aula");window.scrollTo({top:0,behavior:"smooth"});
  }
  async function save(){
    if(!title.trim()){toast.error("Informe o título do evento.");return;}
    if(!start){toast.error("Informe a data e hora.");return;}
    const startDate=new Date(start);
    if(Number.isNaN(startDate.getTime())){toast.error("Data e hora inválidas.");return;}
    setBusy(editing?"update":"create");
    try{
      if(editing){
        await updateTeacherCalendarEvent({id:editing,classroomId:classroom||null,title:title.trim(),description:description.trim(),startAt:startDate.toISOString(),endAt:null,eventType:type});
        toast.success("Evento atualizado.");
      } else {
        await createTeacherCalendarEvent({classroomId:classroom||null,title:title.trim(),description:description.trim(),startAt:startDate.toISOString(),endAt:null,eventType:type});
        toast.success("Evento criado e salvo na agenda.");
      }
      reset();await events.refetch();
    }catch(e){toast.error(errorText(e))}finally{setBusy("")}
  }
  async function remove(){
    if(!confirmDelete)return;
    setBusy("delete:"+confirmDelete);
    try{await deleteTeacherCalendarEvent(confirmDelete);if(editing===confirmDelete)reset();await events.refetch();toast.success("Evento removido da agenda.");setConfirmDelete(null);}
    catch(e){toast.error(errorText(e))}
    finally{setBusy("")}
  }
  return <Card title="Agenda" description="Organize aulas, provas, trabalhos, reuniões e outros eventos acadêmicos.">
    {events.isLoading&&<p className="mb-4 text-sm text-muted-foreground">Carregando agenda…</p>}
    {events.error&&<div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><b>Não foi possível carregar a agenda.</b><Button className="ml-3" size="sm" variant="outline" onClick={()=>void events.refetch()}>Tentar novamente</Button></div>}
    <div className="grid gap-3 md:grid-cols-2">
      <Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Todas as turmas</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      <Select label="Tipo" value={type} onChange={setType}><option value="aula">Aula</option><option value="prova">Prova</option><option value="trabalho">Trabalho</option><option value="evento">Evento</option><option value="recesso">Recesso</option><option value="outro">Outro</option></Select>
      <Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Aula de revisão"/></Field>
      <Field label="Quando"><Input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></Field>
      <Field label="Descrição"><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Detalhes opcionais" className="min-h-20 rounded-md border border-input bg-background p-3 text-sm"/></Field>
      <div className="flex items-end gap-2">
        <Button disabled={!!busy||!title.trim()||!start} onClick={()=>void save()}>{busy==="update"||busy==="create"?"Salvando…":editing?"Salvar alterações":"Adicionar evento"}</Button>
        {editing&&<Button type="button" variant="outline" onClick={reset} disabled={!!busy}>Cancelar</Button>}
      </div>
    </div>
    <ConfirmActionDialog
      open={!!confirmDelete}
      onOpenChange={open=>{if(!open&&!busy)setConfirmDelete(null)}}
      title="Excluir evento?"
      description="O evento será removido da agenda e deixará de aparecer para os usuários vinculados."
      actionLabel="Excluir evento"
      loading={busy.startsWith("delete:")}
      onConfirm={remove}
    />
    <div className="mt-5 space-y-2">
      {!events.isLoading&&!events.data?.length&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum evento encontrado nos últimos 30 dias ou próximos 180 dias.</p>}
      {(events.data??[]).map(e=><article key={e.id} className="rounded-xl border border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><b>{e.title}</b><p className="text-xs text-muted-foreground">{new Date(e.start_at).toLocaleString("pt-BR")} · {e.classroom_name||"Todas as turmas"} · {e.event_type}</p>{e.description&&<p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}</div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" onClick={()=>startEdit(e)}>Editar</Button>
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy!==""} onClick={()=>setConfirmDelete(e.id)}>Excluir</Button>
          </div>
        </div>
      </article>)}
    </div>
  </Card>;
}
function Materials({d}:{d:ReturnType<typeof useData>}) {
  const [classroom,setClassroom]=useState(""); const [subject,setSubject]=useState(""); const [term,setTerm]=useState("");
  const [title,setTitle]=useState(""); const [description,setDescription]=useState(""); const [file,setFile]=useState<File|null>(null); const [busy,setBusy]=useState("");const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const materials=useQuery({queryKey:["teacher-academic-materials"],queryFn:loadTeacherAcademicMaterials,staleTime:10000});
  const options=useQuery({queryKey:["teacher-academic-options"],queryFn:loadTeacherAcademicOptions,staleTime:30000});
  const materialSubjectIds=new Set((d.assignments.data??[]).filter(a=>a.classroom_id===classroom).map(a=>a.subject_id));
  const materialSubjects=(options.data?.subjects??[]).filter(s=>materialSubjectIds.has(s.id));
  function reset(){setClassroom("");setSubject("");setTerm("");setTitle("");setDescription("");setFile(null);}
  async function publish(){
    if(!classroom||!title.trim()||!file){toast.error("Selecione a turma, informe o título e escolha um arquivo.");return;}
    setBusy("publish"); let uploadedPath:string|null=null;
    try { const uploaded=await uploadAcademicAttachment(file,"materials"); uploadedPath=uploaded.path;
      await createTeacherAcademicMaterial({classroomId:classroom,subjectId:subject||null,termId:term||null,title:title.trim(),description:description.trim(),attachment:uploaded});
      reset(); await materials.refetch(); toast.success("Material publicado para a turma.");
    } catch(e) { if(uploadedPath) void supabase.storage.from("academic-attachments").remove([uploadedPath]); toast.error(errorText(e)); } finally { setBusy(""); }
  }
  async function remove(){ if(!confirmDelete)return; setBusy("delete:"+confirmDelete); try { await deleteTeacherAcademicMaterial(confirmDelete); await materials.refetch(); toast.success("Material arquivado."); setConfirmDelete(null); } catch(e){toast.error(errorText(e));} finally{setBusy("");} }
  return <div className="space-y-5">
    <Card title="Central de materiais" description="Publique PDFs, documentos, apresentações, planilhas e imagens diretamente para suas turmas.">
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="Turma" value={classroom} onChange={v=>{setClassroom(v);setSubject("");}}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Todas / não especificada</option>{materialSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Select label="Período" value={term} onChange={setTerm}><option value="">Sem período</option>{(options.data?.terms??[]).map(t=><option key={t.id} value={t.id}>{t.name}{t.is_current?" · atual":""}</option>)}</Select>
        <Field label="Arquivo"><Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={e=>setFile(e.target.files?.[0]??null)}/><p className="text-[11px] text-muted-foreground">PDF, Word, PowerPoint, Excel, imagens ou TXT · até 20 MB.</p></Field>
        <div className="md:col-span-2"><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Material de revisão — Unidade 2"/></Field></div>
        <div className="md:col-span-2"><Field label="Descrição"><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Explique rapidamente o que o aluno encontrará neste material." className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"/></Field></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy!==""||!classroom||!title.trim()||!file} onClick={()=>void publish()}>{busy==="publish"?"Publicando…":"Publicar material"}</Button><Button variant="outline" disabled={busy!==""} onClick={reset}>Limpar</Button></div>
    </Card>
    <ConfirmActionDialog
      open={!!confirmDelete}
      onOpenChange={open=>{if(!open&&busy==="")setConfirmDelete(null)}}
      title="Arquivar material?"
      description="O material deixará de ficar disponível como publicação ativa para os alunos."
      actionLabel="Arquivar material"
      loading={busy.startsWith("delete:")}
      onConfirm={remove}
    />
    <Card title="Materiais publicados" description="Os alunos da turma recebem acesso automaticamente pelo painel deles.">
      {materials.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar os materiais. <Button size="sm" variant="outline" className="ml-2" onClick={()=>void materials.refetch()}>Tentar novamente</Button></div>}
      {materials.isPending&&<p className="text-sm text-muted-foreground">Carregando materiais…</p>}
      <div className="grid gap-3 md:grid-cols-2">{(materials.data??[]).map(m=><article key={m.id} className="rounded-2xl border border-border p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-primary"/><b className="truncate">{m.title}</b></div>
        <p className="mt-1 text-xs text-muted-foreground">{m.classroom_name}{m.subject_name?" · "+m.subject_name:""}{m.term_name?" · "+m.term_name:""}</p>{m.description&&<p className="mt-2 text-sm text-muted-foreground">{m.description}</p>}
        <p className="mt-2 text-xs text-muted-foreground">{m.file_name} · {(m.file_size/1024/1024).toFixed(1)} MB</p></div><Button size="sm" variant="ghost" className="text-destructive" disabled={busy!==""} onClick={()=>setConfirmDelete(m.id)}><Trash2 className="size-4"/></Button></div>
        <div className="mt-3">{m.file_url?<a href={m.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline"><Download className="size-4"/>Abrir material</a>:<span className="text-xs text-muted-foreground">Link indisponível no momento.</span>}</div>
      </article>)}</div>
      {!materials.isPending&&!materials.error&&(materials.data??[]).length===0&&<p className="mt-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Você ainda não publicou nenhum material.</p>}
    </Card>
  </div>;
}
function Communication({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [title,setTitle]=useState("");const [content,setContent]=useState("");const [busy,setBusy]=useState("");const [attachment,setAttachment]=useState<File|null>(null);const [editing,setEditing]=useState<string|null>(null);const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const notices=useQuery({queryKey:["teacher-new-notices"],queryFn:loadTeacherAnnouncements,staleTime:15000});
  const selected=notices.data?.find(n=>n.id===editing)??null;
  async function join(id:string){setBusy("join:"+id);try{await teacherJoinClassroom(id);await d.refresh();toast.success("Você foi vinculado à turma. Agora ela aparece nos seus fluxos de trabalho.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  function reset(){setClassroom("");setTitle("");setContent("");setAttachment(null);setEditing(null)}
  function startEdit(n:TeacherAnnouncement){
    const classroomId=(d.classes.data??[]).find(c=>c.id===n.classroom||c.name===n.classroom)?.id??"";
    setEditing(n.id);setClassroom(classroomId);setTitle(n.title);setContent(n.content);setAttachment(null);window.scrollTo({top:0,behavior:"smooth"});
  }
  async function create(){
    if(!classroom||!title.trim()||!content.trim()){toast.error("Selecione a turma e preencha título e mensagem.");return;}
    setBusy("publish");let uploadedPath:string|null=null;
    try{const uploaded=attachment?await uploadAcademicAttachment(attachment,"announcements"):null;uploadedPath=uploaded?.path??null;await createTeacherAnnouncement({classroom,title:title.trim(),content:content.trim(),attachment:uploaded});reset();await notices.refetch();toast.success("Aviso publicado.");}
    catch(e){if(uploadedPath)void supabase.storage.from("academic-attachments").remove([uploadedPath]);toast.error(errorText(e))}finally{setBusy("")}
  }
  async function update(){
    if(!editing||!classroom||!title.trim()||!content.trim()){toast.error("Preencha todos os campos.");return;}
    setBusy("update");let uploadedPath:string|null=null;
    try{const uploaded=attachment?await uploadAcademicAttachment(attachment,"announcements"):null;uploadedPath=uploaded?.path??null;await updateTeacherAnnouncement({id:editing,classroom,title:title.trim(),content:content.trim(),attachmentPath:uploaded?.path??selected?.attachment_path??null,attachmentName:uploaded?.name??selected?.attachment_name??null,attachmentSize:uploaded?.size??selected?.attachment_size??null,attachmentType:uploaded?.type??selected?.attachment_type??null});reset();await notices.refetch();toast.success("Aviso atualizado.");}
    catch(e){if(uploadedPath)void supabase.storage.from("academic-attachments").remove([uploadedPath]);toast.error(errorText(e))}finally{setBusy("")}
  }
  async function remove(){if(!confirmDelete)return;setBusy("delete");try{await deleteTeacherAnnouncement(confirmDelete);await notices.refetch();toast.success("Aviso excluído.");setConfirmDelete(null);}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  return <div className="space-y-5">
    <Card title="Comunicação" description="Publique avisos para suas turmas e anexe PDFs ou documentos.">
      {(d.classes.data??[]).filter(c=>c.status==="active").length===0 && (d.institutionClasses.data??[]).length>0 && <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4"><b>Escolha onde você vai atuar.</b><p className="mt-1 text-sm text-muted-foreground">Você pode ver todas as turmas da escola. Vincule-se a uma ou mais para liberar lançamento de notas, frequência, atividades e comunicação.</p><div className="mt-3 space-y-2">{(d.institutionClasses.data??[]).filter(c=>!c.is_linked).slice(0,5).map(c=><div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"><div><b>{c.name}</b><p className="text-xs text-muted-foreground">{c.student_count} aluno(s) · {c.teacher_count} professor(es)</p></div><Button size="sm" disabled={busy!==""} onClick={()=>void join(c.id)}>{busy==="join:"+c.id?"Vinculando…":"Vincular-me"}</Button></div>)}</div></div>}
      <div className="grid gap-3"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Mensagem"><textarea value={content} onChange={e=>setContent(e.target.value)} className="min-h-28 rounded-md border border-input bg-background p-3 text-sm"/></Field><Field label="Anexo"><Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={e=>setAttachment(e.target.files?.[0]??null)}/><p className="text-[11px] text-muted-foreground">Até 20 MB.</p></Field><div className="flex gap-2"><Button disabled={busy!==""||!classroom||!title.trim()||!content.trim()} onClick={()=>void(editing?update():create())}>{busy==="publish"?"Publicando…":editing?"Salvar alterações":"Publicar aviso"}</Button>{editing&&<Button variant="outline" disabled={busy!==""} onClick={reset}>Cancelar</Button>}</div></div>
      <ConfirmActionDialog
        open={!!confirmDelete}
        onOpenChange={open=>{if(!open&&busy==="")setConfirmDelete(null)}}
        title="Excluir aviso?"
        description="O aviso será removido da comunicação da turma."
        actionLabel="Excluir aviso"
        loading={busy==="delete"}
        onConfirm={remove}
      />
      {notices.error&&<div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><b>Não foi possível carregar os avisos.</b><Button className="ml-3" size="sm" variant="outline" onClick={()=>void notices.refetch()}>Tentar novamente</Button></div>}
      <div className="mt-5 space-y-2">{(notices.data??[]).map(n=><div key={n.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-3"><div><b>{n.title}</b><p className="text-xs text-muted-foreground">{n.classroom}</p><p className="mt-1 text-sm text-muted-foreground">{n.content}</p>{n.attachment_name&&<p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="size-3"/>{n.attachment_name}</p>}</div><div className="flex shrink-0 gap-1"><Button size="sm" variant="ghost" onClick={()=>startEdit(n)}><Pencil className="size-3"/></Button><Button size="sm" variant="ghost" className="text-destructive" disabled={busy!==""} onClick={()=>setConfirmDelete(n.id)}><Trash2 className="size-3"/></Button></div></div></div>)}</div>
    </Card>
  </div>;
}

const sectionPaths: Record<Section, "/professor" | "/professor/turmas" | "/professor/alunos" | "/professor/disciplinas" | "/professor/notas" | "/professor/frequencia" | "/professor/avaliacoes" | "/professor/atividades" | "/professor/materiais" | "/professor/agenda" | "/professor/comunicacao"> = {
  inicio: "/professor",
  turmas: "/professor/turmas",
  alunos: "/professor/alunos",
  disciplinas: "/professor/disciplinas",
  notas: "/professor/notas",
  frequencia: "/professor/frequencia",
  avaliacoes: "/professor/avaliacoes",
  atividades: "/professor/atividades",
  materiais: "/professor/materiais",
  agenda: "/professor/agenda",
  comunicacao: "/professor/comunicacao",
};

const pathToSection: Partial<Record<string, Section>> = Object.fromEntries(
  Object.entries(sectionPaths).map(([section, path]) => [path, section]),
) as Partial<Record<string, Section>>;

export function TeacherWorkspace({initialSection="inicio"}:{initialSection?:Section}){
  const location=useLocation();
  const navigate=useNavigate();
  const section=pathToSection[location.pathname] ?? initialSection;
  const d=useData(section);
  const current=menu.find(x=>x.id===section) ?? menu[0]!;

  function onNavigate(nextSection: Section) {
    void navigate({to:sectionPaths[nextSection]});
  }

  const body=section==="inicio"?<Overview d={d} onNavigate={onNavigate}/>:section==="turmas"?<Classes d={d} onNavigate={onNavigate}/>:section==="alunos"?<Students d={d}/>:section==="disciplinas"?<Subjects d={d}/>:section==="notas"?<Grades d={d}/>:section==="frequencia"?<Attendance d={d}/>:section==="avaliacoes"?<Assessments d={d}/>:section==="atividades"?<Tasks d={d}/>:section==="materiais"?<Materials d={d}/>:section==="agenda"?<Agenda d={d}/>:<Communication d={d}/>;

  return <AcademicShell title={current.label} subtitle="Gestão acadêmica docente" requiredRole="teacher">
    <div className="space-y-5">
      <DataError d={d}/>
      {body}
    </div>
  </AcademicShell>;
}