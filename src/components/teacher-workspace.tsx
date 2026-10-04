import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, ClipboardList, GraduationCap, Megaphone, Plus, School, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  assignTeacherSubjectToClass, createAssessment, createTeacherAnnouncement,
  createTeacherCalendarEvent, createTeacherClassroom, createTeacherSubject, createTeacherTask,
  errorText, gradeTaskSubmission, loadAttendance, loadTaskSubmissions, loadTeacherAcademicOptions,
  loadTeacherAnnouncements, loadTeacherAssessments, loadTeacherCalendar, loadTeacherClassReport,
  loadTeacherClassrooms, loadTeacherInstitutionStudentsPage, loadTeacherSubjects, loadTeacherTasks, loadTeacherUnassignedStudents,
  loadTeacherUnassignedClassrooms, teacherClaimClassroom, loadTeacherGrades,
  saveAttendance, teacherEnrollStudentInClassroom, teacherLinkStudentToSchool,
  teacherRemoveStudentFromClassroom, type AttendanceRow
} from "@/lib/sina-data";

type Section = "inicio"|"turmas"|"alunos"|"disciplinas"|"notas"|"frequencia"|"avaliacoes"|"atividades"|"agenda"|"comunicacao";
const menu: {id:Section;label:string;Icon:LucideIcon}[]=[
  {id:"inicio",label:"Visão geral",Icon:BarChart3},{id:"turmas",label:"Turmas",Icon:Users},
  {id:"alunos",label:"Alunos",Icon:GraduationCap},{id:"disciplinas",label:"Disciplinas",Icon:BookOpen},
  {id:"notas",label:"Notas",Icon:BarChart3},{id:"frequencia",label:"Frequência",Icon:CheckCircle2},
  {id:"avaliacoes",label:"Avaliações",Icon:ClipboardCheck},{id:"atividades",label:"Atividades",Icon:ClipboardList},
  {id:"agenda",label:"Agenda",Icon:CalendarDays},{id:"comunicacao",label:"Comunicação",Icon:Megaphone}
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
  const needsAssignments = section==="disciplinas";
  const needsUnassignedClasses = section==="turmas" || section==="agenda" || section==="comunicacao";
  const classes=useQuery({queryKey:["teacher-new-classes"],queryFn:loadTeacherClassrooms,staleTime:30000,enabled:needsClasses});
  const students=useQuery({queryKey:["teacher-new-students"],queryFn:loadTeacherInstitutionStudents,staleTime:30000,enabled:needsStudents});
  const subjects=useQuery({queryKey:["teacher-new-subjects"],queryFn:loadTeacherSubjects,staleTime:30000,enabled:needsSubjects});
  const assignments=useQuery({queryKey:["teacher-new-assignments"],queryFn:async()=>{const {data,error}=await supabase.rpc("teacher_list_subject_assignments");if(error)throw error;return data??[]},staleTime:30000,enabled:needsAssignments});
  const unassignedClasses=useQuery({queryKey:["teacher-new-unassigned-classes"],queryFn:loadTeacherUnassignedClassrooms,staleTime:15000,enabled:needsUnassignedClasses});
  async function refresh(){
    await Promise.all([
      qc.invalidateQueries({queryKey:["teacher-new-classes"]}),
      qc.invalidateQueries({queryKey:["teacher-new-unassigned-classes"]}),
      qc.invalidateQueries({queryKey:["teacher-new-students"]}),
      qc.invalidateQueries({queryKey:["teacher-new-subjects"]}),
      qc.invalidateQueries({queryKey:["teacher-new-assignments"]}),
    ]);
  }
  return {classes,students,subjects,assignments,unassignedClasses,refresh};
}

function DataError({d}:{d:ReturnType<typeof useData>}) {
  const errors = [
    d.classes.error && "turmas",
    d.students.error && "alunos",
    d.subjects.error && "disciplinas",
    d.assignments.error && "vínculos de disciplinas",
    d.unassignedClasses.error && "turmas disponíveis",
  ].filter(Boolean) as string[];
  if (!errors.length) return null;
  return <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
    <p className="font-semibold">Não foi possível carregar alguns dados</p>
    <p className="mt-1 text-sm text-muted-foreground">Falha ao carregar: {errors.join(", ")}.</p>
    <Button className="mt-3" variant="outline" onClick={()=>void d.refresh()}>Tentar novamente</Button>
  </section>;
}

function Overview({d,onNavigate}:{d:ReturnType<typeof useData>;onNavigate:(section:Section)=>void}){
  const classes=(d.classes.data??[]).filter(x=>x.status==="active");
  const students=(d.students.data??[]).filter(x=>x.class_status==="minha_turma");
  const subjects=(d.subjects.data??[]).filter(x=>x.status==="active");
  const pending=(d.students.data??[]).filter(x=>x.class_status==="sem_turma");
  const actions=[
    {label:"Turmas",value:classes.length,desc:"Acesse alunos e desempenho",icon:Users,go:"turmas" as Section},
    {label:"Alunos",value:students.length,desc:"Consulte sua turma",icon:GraduationCap,go:"alunos" as Section},
    {label:"Disciplinas",value:subjects.length,desc:"Gerencie vínculos",icon:BookOpen,go:"disciplinas" as Section},
    {label:"Sem turma",value:pending.length,desc:"Alunos aguardando vínculo",icon:School,go:"alunos" as Section},
  ];
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Painel do professor</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Tudo que precisa para acompanhar suas turmas.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Acompanhe alunos, notas, frequência, avaliações e atividades em um único fluxo.</p></div>
        <div className="rounded-2xl bg-primary/10 px-4 py-3 text-sm"><b>Atalho rápido</b><p className="mt-1 text-muted-foreground">Comece por Turmas para ver o desempenho.</p></div>
      </div>
    </section>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map(({label,value,desc,icon:Icon,go})=><button key={label} type="button" onClick={()=>onNavigate(go)} className="sina-card group p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></span><span className="text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">Abrir →</span></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{desc}</p></button>)}
    </div>
    <Card title="Próximas ações" description="Use o menu para executar cada etapa. O SINA mantém o vínculo entre a ação e a turma.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Notas","Lance e confira notas por aluno.","notas"],["Frequência","Registre o diário por data.","frequencia"],["Avaliações","Crie instrumentos e acompanhe resultados.","avaliacoes"],["Atividades","Publique e corrija entregas.","atividades"]].map(([title,desc,go])=><button key={title} type="button" onClick={()=>onNavigate(go as Section)} className="rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"><b>{title}</b><p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p></button>)}
      </div>
    </Card>
  </div>;
}

function Classes({d}:{d:ReturnType<typeof useData>}){
  const [name,setName]=useState("");const [code,setCode]=useState("");const [selected,setSelected]=useState("");const [busy,setBusy]=useState("");
  const report=useQuery({queryKey:["teacher-new-report",selected],queryFn:()=>loadTeacherClassReport(selected),enabled:!!selected});
  async function create(){if(!name.trim())return;setBusy("create");try{await createTeacherClassroom(name.trim(),code.trim());setName("");setCode("");await d.refresh();toast.success("Turma criada e atribuída a você.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  async function claim(id:string){setBusy(id);try{await teacherClaimClassroom(id);await d.refresh();toast.success("Turma atribuída a você.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  return <div className="space-y-5">
    <Card title="Turmas" description="Crie turmas ou assuma turmas da escola que ainda não tenham professor responsável.">
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da turma"/>
        <Input value={code} onChange={e=>setCode(e.target.value)} placeholder="Código (opcional)"/>
        <Button disabled={busy!==""||!name.trim()} onClick={()=>void create()}><Plus className="mr-2 size-4"/>{busy==="create"?"Criando…":"Criar turma"}</Button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {(d.classes.data??[]).map(c=><button key={c.id} type="button" onClick={()=>setSelected(c.id)} className={"rounded-xl border p-4 text-left "+(selected===c.id?"border-primary bg-primary/5":"border-border")}>
          <b>{c.name}</b><p className="text-xs text-muted-foreground">{c.code||"Sem código"} · {c.student_count} aluno(s) · {c.status==="active"?"Ativa":"Arquivada"}</p>
        </button>)}
      </div>
      {(d.classes.data??[]).length===0&&<p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Você ainda não tem turmas atribuídas. Veja abaixo as turmas da escola que estão disponíveis.</p>}
    </Card>
    <Card title="Turmas disponíveis na escola" description="Somente turmas ativas sem nenhum professor responsável podem ser assumidas. Turmas de outro professor continuam protegidas.">
      <div className="space-y-2">
        {(d.unassignedClasses.data??[]).map(c=><div key={c.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><b>{c.name}</b><p className="text-xs text-muted-foreground">{c.code||"Sem código"} · {c.student_count} aluno(s)</p></div>
          <Button disabled={busy!==""} onClick={()=>void claim(c.id)}>{busy===c.id?"Atribuindo…":"Assumir turma"}</Button>
        </div>)}
        {(d.unassignedClasses.data??[]).length===0&&<p className="text-sm text-muted-foreground">Não há turmas sem professor responsável nesta escola.</p>}
      </div>
    </Card>
    {selected&&<Card title="Relatório da turma" description="Resumo acadêmico da turma selecionada. Cada indicador vem dos registros acadêmicos vinculados aos alunos."><div className="mb-4 grid gap-2 grid-cols-2 md:grid-cols-4"><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Alunos</p><b>{report.data?.length??0}</b></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Com nota</p><b>{(report.data??[]).filter(s=>s.grade_average!=null).length}</b></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Média da turma</p><b>{report.data?.length?((report.data.reduce((a,s)=>a+(Number(s.grade_average)||0),0)/report.data.length).toFixed(1)):"—"}</b></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Frequência média</p><b>{report.data?.length?((report.data.reduce((a,s)=>a+(Number(s.attendance_percent)||0),0)/report.data.length).toFixed(0)+"%"):"—"}</b></div></div><div className="space-y-2">{(report.data??[]).map(s=><div key={s.student_id} className="rounded-xl border border-border p-3"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><b>{s.student_name}</b><p className="text-xs text-muted-foreground">{s.enrollment} · Nota: média dos lançamentos · Frequência: registros de presença</p></div><div className="text-sm"><b>{s.grade_average==null?"—":Number(s.grade_average).toFixed(1)}</b> · {s.attendance_percent==null?"—":s.attendance_percent+"%"}</div></div></div>)}</div>{report.isLoading&&<p className="mt-3 text-sm text-muted-foreground">Carregando relatório…</p>}{report.error&&<div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar o relatório. <Button size="sm" variant="outline" onClick={()=>void report.refetch()}>Tentar novamente</Button></div>}</Card>}
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
  function classFor(id:string){return targetClass[id]??""}
  function enrollmentFor(s:{id:string;enrollment:string|null}){return enrollments[s.id]??s.enrollment??""}
  async function school(id:string){setBusy(id);try{await teacherLinkStudentToSchool(id);await Promise.all([waiting.refetch(),d.refresh()]);toast.success("Aluno vinculado à escola.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  async function enroll(id:string){const classroom=classFor(id);const enrollment=enrollmentFor({id,enrollment:(list.find(s=>s.id===id)?.enrollment??"")});if(!classroom||!enrollment.trim())return;setBusy(id);try{await teacherEnrollStudentInClassroom(id,classroom,enrollment.trim());await d.refresh();toast.success("Aluno vinculado à turma.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  async function remove(id:string){setBusy(id);try{await teacherRemoveStudentFromClassroom(id);await d.refresh();toast.success("Aluno removido da turma.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  return <div className="space-y-5">
    <Card title="Alunos da instituição" description="Escolha a turma diretamente em cada aluno. Alunos em uma turma sem professor também podem ser reatribuídos.">
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
            <div><b>{s.full_name}</b><p className="text-xs text-muted-foreground">{s.enrollment||"Sem matrícula"} · {s.classroom||"Sem turma"} · {s.class_status}</p></div>
            {s.class_status!=="outra_turma"&&<div className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_160px_auto_auto]">
              <select value={classFor(s.id)} onChange={e=>setTargetClass(v=>({...v,[s.id]:e.target.value}))} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Escolha a turma</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
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
    <Card title="Alunos sem escola" description="Vincule o aluno à escola ativa do professor antes de colocá-lo em uma turma.">
      <div className="space-y-2">{(waiting.data??[]).map(s=><div key={s.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><b>{s.full_name}</b><p className="text-xs text-muted-foreground">{s.enrollment||"Sem matrícula"}</p></div><Button disabled={!!busy} onClick={()=>void school(s.id)}>{busy===s.id?"Vinculando…":"Vincular à minha escola"}</Button></div>)}</div>
      {(waiting.data??[]).length===0&&<p className="text-sm text-muted-foreground">Não há alunos aguardando vínculo com uma escola.</p>}
    </Card>
  </div>;
}

function Subjects({d}:{d:ReturnType<typeof useData>}){
  const [name,setName]=useState("");const [code,setCode]=useState("");const [subject,setSubject]=useState("");const [classroom,setClassroom]=useState("");
  async function create(){try{await createTeacherSubject(name.trim(),code.trim());setName("");setCode("");await d.refresh();toast.success("Disciplina criada.");}catch(e){toast.error(errorText(e))}}
  async function assign(){try{await assignTeacherSubjectToClass(subject,classroom);setSubject("");setClassroom("");await d.refresh();toast.success("Disciplina vinculada à turma.");}catch(e){toast.error(errorText(e))}}
  async function editSubject(id:string,currentName:string,currentCode:string){const nextName=window.prompt("Nome da disciplina",currentName);if(nextName===null)return;const nextCode=window.prompt("Código",currentCode);if(nextCode===null)return;try{await supabase.rpc("teacher_update_subject",{_id:id,_name:nextName.trim(),_code:nextCode.trim()});await d.refresh();toast.success("Disciplina atualizada.");}catch(e){toast.error(errorText(e))}}
  async function archiveSubject(id:string){if(!window.confirm("Arquivar esta disciplina?"))return;try{await supabase.rpc("teacher_archive_subject",{_id:id});await d.refresh();toast.success("Disciplina arquivada.");}catch(e){toast.error(errorText(e))}}
  return <div className="space-y-5"><Card title="Disciplinas" description="Cadastre e distribua as disciplinas que você administra."><div className="grid gap-3 md:grid-cols-[1fr_160px_auto]"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome"/><Input value={code} onChange={e=>setCode(e.target.value)} placeholder="Código"/><Button disabled={!name.trim()} onClick={()=>void create()}><Plus className="mr-2 size-4"/>Criar</Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{(d.subjects.data??[]).map(s=><div key={s.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-3"><div><b>{s.name}</b><p className="text-xs text-muted-foreground">{s.code||"Sem código"} · {s.status}</p></div>{s.status==="active"&&<div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>void editSubject(s.id,s.name,s.code||"")}>Editar</Button><Button size="sm" variant="ghost" onClick={()=>void archiveSubject(s.id)}>Arquivar</Button></div>}</div></div>)}</div></Card>
  <Card title="Vincular disciplina à turma"><div className="grid gap-3 md:grid-cols-3"><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Selecione</option>{(d.subjects.data??[]).filter(s=>s.status==="active").map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><div className="self-end"><Button disabled={!subject||!classroom} onClick={()=>void assign()}>Vincular</Button></div></div><div className="mt-4 space-y-2">{(d.assignments.data??[]).map((a:{id:string;subject_name:string;classroom_name:string})=><div key={a.id} className="rounded-xl border border-border p-3 text-sm">{a.subject_name} · {a.classroom_name}</div>)}</div></Card></div>;
}

function Grades({d}:{d:ReturnType<typeof useData>}){
  const [student,setStudent]=useState("");const [subject,setSubject]=useState("");const [period,setPeriod]=useState("1");const [score,setScore]=useState("");const [absences,setAbsences]=useState("0");const [busy,setBusy]=useState(false);
  const selectedStudent=(d.students.data??[]).find(s=>s.id===student);
  const grades=useQuery({queryKey:["teacher-new-grades",student],queryFn:async()=>{const {data,error}=await supabase.rpc("teacher_list_grades",{_student_id:student});if(error)throw error;return data??[]},enabled:!!student,staleTime:15000});
  const assessments=useQuery({queryKey:["teacher-new-student-assessments",selectedStudent?.classroom_id],queryFn:()=>loadTeacherAssessments(selectedStudent?.classroom_id??""),enabled:!!selectedStudent?.classroom_id,staleTime:15000});
  async function save(){const n=Number(score),f=Number(absences);if(!student||!subject||Number.isNaN(n)||n<0||n>10||f<0)return;setBusy(true);try{const {error}=await supabase.rpc("teacher_upsert_grade",{_student_id:student,_subject:subject,_period:Number(period),_score:n,_absences:f});if(error)throw error;setScore("");await grades.refetch();toast.success("Nota salva.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  return <div className="space-y-5">
    <Card title="Notas" description="Lance a nota por período e deixe claro para qual aluno, disciplina e período o registro pertence.">
      <div className="grid gap-3 md:grid-cols-5"><Select label="Aluno" value={student} onChange={setStudent}><option value="">Selecione</option>{(d.students.data??[]).filter(s=>s.class_status==="minha_turma").map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</Select><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Selecione</option>{(d.subjects.data??[]).filter(s=>s.status==="active").map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</Select><Select label="Período" value={period} onChange={setPeriod}>{[1,2,3,4].map(n=><option key={n} value={String(n)}>{n}º período</option>)}</Select><Field label="Nota"><Input type="number" min="0" max="10" step=".01" value={score} onChange={e=>setScore(e.target.value)}/></Field><div className="flex items-end gap-2"><Field label="Faltas"><Input type="number" min="0" value={absences} onChange={e=>setAbsences(e.target.value)}/></Field><Button disabled={busy||!student||!subject||!score} onClick={()=>void save()}>{busy?"Salvando…":"Salvar"}</Button></div></div>
      <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm"><b>Origem do lançamento:</b> nota periódica do professor. Para avaliações individuais, use a área <b>Avaliações</b>, onde ficam tipo, peso, prazo e nota da avaliação.</div>
      {student&&<div className="mt-4 space-y-2">{(grades.data??[]).map((g:{id:string;subject:string;period:number;score:number;absences?:number})=><div key={g.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><b>{g.subject}</b><p className="text-xs text-muted-foreground">{g.period}º período · Fonte: lançamento do professor · Faltas: {g.absences??0}</p></div><b>{g.score}</b></div>)}{!grades.data?.length&&<p className="text-sm text-muted-foreground">Este aluno ainda não possui lançamentos periódicos.</p>}</div>}
    </Card>
    {student&&<Card title="Avaliações cadastradas para a turma" description={selectedStudent?.classroom ? "Estas avaliações explicam os instrumentos avaliativos usados na turma de " + selectedStudent.classroom + "." : "Avaliações da turma do aluno selecionado."}><div className="grid gap-2 md:grid-cols-2">{(assessments.data??[]).map(a=><div key={a.id} className="rounded-xl border border-border p-3"><b>{a.title}</b><p className="mt-1 text-xs text-muted-foreground">{a.subject_name||"Sem disciplina"} · {a.term_name||"Sem período"} · Tipo: {a.assessment_type} · Peso: {a.weight} · Máx.: {a.max_score}</p><p className="mt-1 text-xs text-muted-foreground">{a.due_at ? "Prazo: " + new Date(a.due_at).toLocaleString("pt-BR") : "Sem prazo"}</p></div>)}{!assessments.data?.length&&<p className="text-sm text-muted-foreground">Nenhuma avaliação cadastrada para esta turma.</p>}</div></Card>}
  </div>;
}

function Attendance({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [rows,setRows]=useState<AttendanceRow[]>([]);const [busy,setBusy]=useState(false);
  async function load(){if(!classroom)return;try{setRows(await loadAttendance(classroom,date))}catch(e){toast.error(errorText(e))}}
  async function save(){setBusy(true);try{await saveAttendance(classroom,date,rows.map(r=>({student_id:r.student_id,status:r.status,note:r.note})));toast.success("Frequência salva.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  const present=rows.filter(r=>r.status==="present").length, absent=rows.filter(r=>r.status==="absent").length, late=rows.filter(r=>r.status==="late").length, excused=rows.filter(r=>r.status==="excused").length;
  return <Card title="Frequência" description="Diário por turma e por data. O registro fica ligado à turma, data e aluno."><div className="grid gap-3 md:grid-cols-[1fr_180px_auto]"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Field label="Data"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><div className="self-end"><Button disabled={!classroom} onClick={()=>void load()}>Carregar diário</Button></div></div>
    {rows.length>0&&<div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-4"><div className="rounded-xl bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Presentes</p><b>{present}</b></div><div className="rounded-xl bg-destructive/5 p-3"><p className="text-xs text-muted-foreground">Faltas</p><b>{absent}</b></div><div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Atrasados</p><b>{late}</b></div><div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Justificados</p><b>{excused}</b></div></div>}
    <div className="mt-4 space-y-2">{rows.map((r,i)=><div key={r.student_id} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[1fr_160px_1fr]"><div><b>{r.full_name}</b><p className="text-xs text-muted-foreground">{r.enrollment} · Fonte: diário da turma</p></div><select value={r.status} onChange={e=>setRows(v=>v.map((x,j)=>j===i?{...x,status:e.target.value as AttendanceRow["status"]}:x))} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="present">Presente</option><option value="absent">Ausente</option><option value="late">Atrasado</option><option value="excused">Justificado</option></select><Input value={r.note} onChange={e=>setRows(v=>v.map((x,j)=>j===i?{...x,note:e.target.value}:x))} placeholder="Observação"/></div>)}{rows.length>0&&<Button disabled={busy} onClick={()=>void save()}>{busy?"Salvando…":"Salvar frequência"}</Button>}</div>
  </Card>;
}

function Assessments({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [subject,setSubject]=useState("");const [term,setTerm]=useState("");const [title,setTitle]=useState("");const [type,setType]=useState("prova");const [weight,setWeight]=useState("1");const [max,setMax]=useState("10");const [due,setDue]=useState("");const [busy,setBusy]=useState(false);const [selectedAssessmentId,setSelectedAssessmentId]=useState("");const [scores,setScores]=useState<Record<string,string>>({});const [feedback,setFeedback]=useState<Record<string,string>>({});
  const options=useQuery({queryKey:["teacher-new-options"],queryFn:loadTeacherAcademicOptions,staleTime:30000});const list=useQuery({queryKey:["teacher-new-assessments",classroom],queryFn:()=>loadTeacherAssessments(classroom),enabled:!!classroom});
  const results=useQuery({queryKey:["teacher-new-assessment-results",selectedAssessmentId],queryFn:async()=>{const {data,error}=await supabase.rpc("teacher_list_assessment_scores",{_assessment_id:selectedAssessmentId});if(error)throw error;return data??[]},enabled:!!selectedAssessmentId,staleTime:10000});
  async function create(){setBusy(true);try{await createAssessment({classroomId:classroom,subjectId:subject||null,termId:term||null,title:title.trim(),type,weight:Number(weight),maxScore:Number(max),dueAt:due?new Date(due).toISOString():null});setTitle("");setDue("");await list.refetch();toast.success("Avaliação criada.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  const selectedAssessment=list.data?.find(a=>a.id===selectedAssessmentId);
  return <Card title="Avaliações" description="Crie avaliações, selecione uma delas e lance notas e feedback por aluno."><div className="grid gap-3 md:grid-cols-3"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Opcional</option>{(options.data?.subjects??[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select label="Período" value={term} onChange={setTerm}><option value="">Opcional</option>{(options.data?.terms??[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Tipo"><Input value={type} onChange={e=>setType(e.target.value)}/></Field><Field label="Peso"><Input type="number" value={weight} onChange={e=>setWeight(e.target.value)}/></Field><Field label="Nota máxima"><Input type="number" value={max} onChange={e=>setMax(e.target.value)}/></Field><Field label="Prazo"><Input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></Field><div className="self-end"><Button disabled={busy||!classroom||!title.trim()} onClick={()=>void create()}>{busy?"Salvando…":"Criar avaliação"}</Button></div></div><div className="mt-4 space-y-2">{list.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar as avaliações. <Button size="sm" variant="outline" onClick={()=>void list.refetch()}>Tentar novamente</Button></div>}{(list.data??[]).map(a=><div key={a.id} className="rounded-xl border border-border p-3"><button type="button" className="w-full text-left" onClick={()=>setSelectedAssessmentId(a.id)}><b>{a.title}</b><p className="text-xs text-muted-foreground">{a.subject_name} · {a.term_name} · {a.max_score} pontos</p><p className="mt-1 text-xs font-semibold text-primary">Abrir lançamento →</p></button></div>)}</div>
    {selectedAssessment && <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4"><b>Lançamento de resultados</b><p className="mt-1 text-sm text-muted-foreground">{selectedAssessment.title} · peso {selectedAssessment.weight} · nota máxima {selectedAssessment.max_score}</p><div className="mt-3">{results.error&&<div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar os resultados desta avaliação. <Button size="sm" variant="outline" onClick={()=>void results.refetch()}>Tentar novamente</Button></div>}<div className="grid gap-2 grid-cols-2 sm:grid-cols-3"><div className="rounded-xl border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Alunos da turma</p><b>{(d.students.data??[]).filter(s=>s.class_status==="minha_turma").length}</b></div><div className="rounded-xl border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Corrigidos</p><b>{results.data?.length??0}</b></div><div className="rounded-xl border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Pendentes</p><b>{Math.max(0,(d.students.data??[]).filter(s=>s.class_status==="minha_turma").length-(results.data?.length??0))}</b></div></div><div className="mt-4 space-y-2">{(d.students.data??[]).filter(s=>s.class_status==="minha_turma").map(s=>{const r=results.data?.find(x=>x.student_id===s.id);return <div key={s.id} className="grid gap-2 rounded-xl border border-border bg-background p-3 md:grid-cols-[1fr_120px_1fr_auto]"><div><b>{s.full_name}</b><p className="text-xs text-muted-foreground">{s.enrollment||"Sem matrícula"} · {r?"Resultado já lançado":"Ainda sem resultado"}</p></div><Input type="number" min="0" max={String(selectedAssessment.max_score)} step=".01" placeholder="Nota" value={scores[s.id]??(r?.score==null?"":String(r.score))} onChange={e=>setScores(v=>({...v,[s.id]:e.target.value}))}/><Input placeholder="Feedback" value={feedback[s.id]??(r?.feedback??"")} onChange={e=>setFeedback(v=>({...v,[s.id]:e.target.value}))}/><Button disabled={busy||scores[s.id]===""&&r?.score==null} onClick={async()=>{setBusy(true);try{await supabase.rpc("teacher_upsert_assessment_score",{_assessment_id:selectedAssessment.id,_student_id:s.id,_score:Number(scores[s.id]??r?.score),_feedback:feedback[s.id]??r?.feedback??""});await results.refetch();toast.success("Resultado salvo.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}}>Salvar</Button></div>})}</div>{results.error&&<p className="mt-3 text-sm text-destructive">Não foi possível carregar os resultados desta avaliação.</p>}</div></div>}
    </Card>;
}

function Tasks({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [subject,setSubject]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [due,setDue]=useState("");const [selected,setSelected]=useState("");const [busy,setBusy]=useState(false);const [scores,setScores]=useState<Record<string,string>>({});const [feedback,setFeedback]=useState<Record<string,string>>({});
  const tasks=useQuery({queryKey:["teacher-new-tasks"],queryFn:loadTeacherTasks,staleTime:15000});const submissions=useQuery({queryKey:["teacher-new-submissions",selected],queryFn:()=>loadTaskSubmissions(selected),enabled:!!selected});
  async function create(){setBusy(true);try{await createTeacherTask({classroom,subject,title:title.trim(),description,dueAt:due?new Date(due).toISOString():null});setTitle("");setDescription("");setDue("");await tasks.refetch();toast.success("Atividade publicada.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  async function grade(id:string){const n=Number(scores[id]);if(Number.isNaN(n)||n<0||n>10)return;try{await gradeTaskSubmission(id,n,feedback[id]??"");await submissions.refetch();toast.success("Entrega corrigida.");}catch(e){toast.error(errorText(e))}}
  return <Card title="Atividades e entregas" description="Publique atividades, veja entregas e corrija notas."><div className="grid gap-3 md:grid-cols-2"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</Select><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Selecione</option>{(d.subjects.data??[]).filter(s=>s.status==="active").map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</Select><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Prazo"><Input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></Field><Field label="Descrição"><textarea value={description} onChange={e=>setDescription(e.target.value)} className="min-h-24 rounded-md border border-input bg-background p-3 text-sm"/></Field><div className="self-end"><Button disabled={busy||!classroom||!subject||!title.trim()} onClick={()=>void create()}>{busy?"Publicando…":"Publicar atividade"}</Button></div></div><div className="mt-5 grid gap-2 md:grid-cols-2">{tasks.error&&<div className="col-span-full rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar as atividades. <Button size="sm" variant="outline" onClick={()=>void tasks.refetch()}>Tentar novamente</Button></div>}{(tasks.data??[]).map(t=><button key={t.id} type="button" onClick={()=>setSelected(t.id)} className={"rounded-xl border p-3 text-left "+(selected===t.id?"border-primary bg-primary/5":"border-border")}><b>{t.title}</b><p className="text-xs text-muted-foreground">{t.classroom} · {t.subject}</p></button>)}</div>{selected&&<div className="mt-5 space-y-2">{submissions.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar as entregas. <Button size="sm" variant="outline" onClick={()=>void submissions.refetch()}>Tentar novamente</Button></div>}{(submissions.data??[]).map(s=><div key={s.id} className="rounded-xl border border-border p-4"><b>{s.student_name}</b><p className="text-xs text-muted-foreground">{s.enrollment} · {s.status}</p><p className="mt-2 text-sm">{s.content||"Sem resposta textual."}</p><div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto]"><Input type="number" min="0" max="10" step=".01" placeholder="Nota" value={scores[s.id]??(s.score==null?"":String(s.score))} onChange={e=>setScores(v=>({...v,[s.id]:e.target.value}))}/><Input placeholder="Feedback para o aluno" value={feedback[s.id]??(s.feedback??"")} onChange={e=>setFeedback(v=>({...v,[s.id]:e.target.value}))}/><Button disabled={scores[s.id]===""&&s.score==null} onClick={()=>void grade(s.id)}>Corrigir</Button></div></div>)}</div>}</Card>;
}

function Agenda({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [start,setStart]=useState("");const [type,setType]=useState("aula");const [busy,setBusy]=useState(false);
  const from=new Date().toISOString();const to=new Date(Date.now()+60*86400000).toISOString();const events=useQuery({queryKey:["teacher-new-calendar"],queryFn:()=>loadTeacherCalendar(from,to),staleTime:30000});
  async function create(){setBusy(true);try{await createTeacherCalendarEvent({classroomId:classroom||null,title:title.trim(),description,startAt:new Date(start).toISOString(),endAt:null,eventType:type});setTitle("");setDescription("");setStart("");await events.refetch();toast.success("Evento criado.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  return <Card title="Agenda" description="Organize aulas, reuniões e eventos acadêmicos.">{events.error&&<div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><b>Não foi possível carregar a agenda.</b><Button className="ml-3" size="sm" variant="outline" onClick={()=>void events.refetch()}>Tentar novamente</Button></div>}<div className="grid gap-3 md:grid-cols-2"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Todas</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Field label="Tipo"><Input value={type} onChange={e=>setType(e.target.value)}/></Field><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Quando"><Input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></Field><Field label="Descrição"><textarea value={description} onChange={e=>setDescription(e.target.value)} className="min-h-20 rounded-md border border-input bg-background p-3 text-sm"/></Field><div className="self-end"><Button disabled={busy||!title.trim()||!start} onClick={()=>void create()}>{busy?"Salvando…":"Adicionar evento"}</Button></div></div><div className="mt-5 space-y-2">{(events.data??[]).map(e=><div key={e.id} className="rounded-xl border border-border p-3"><b>{e.title}</b><p className="text-xs text-muted-foreground">{new Date(e.start_at).toLocaleString("pt-BR")} · {e.classroom_name||"Todas as turmas"} · {e.event_type}</p></div>)}</div></Card>;
}

function Communication({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [title,setTitle]=useState("");const [content,setContent]=useState("");const [busy,setBusy]=useState("");

  const notices=useQuery({queryKey:["teacher-new-notices"],queryFn:loadTeacherAnnouncements,staleTime:15000});
  async function claim(id:string){setBusy("claim:"+id);try{await teacherClaimClassroom(id);await d.refresh();toast.success("Turma atribuída a você. Agora ela já pode receber avisos.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  async function create(){setBusy("publish");try{await createTeacherAnnouncement({classroom,title:title.trim(),content});setTitle("");setContent("");await notices.refetch();toast.success("Aviso publicado.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  return <div className="space-y-5">
    <Card title="Comunicação" description="Publique avisos apenas para suas turmas.">
      {(d.classes.data??[]).filter(c=>c.status==="active").length===0 && (d.unassignedClasses.data??[]).length>0 && <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4"><b>Você ainda não tem uma turma atribuída.</b><p className="mt-1 text-sm text-muted-foreground">Assuma uma das turmas disponíveis para poder publicar avisos para os alunos.</p><div className="mt-3 space-y-2">{(d.unassignedClasses.data??[]).map(c=><div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"><div><b>{c.name}</b><p className="text-xs text-muted-foreground">{c.student_count} aluno(s)</p></div><Button size="sm" disabled={busy!==""} onClick={()=>void claim(c.id)}>{busy==="claim:"+c.id?"Atribuindo…":"Assumir turma"}</Button></div>)}</div></div>}
      <div className="grid gap-3"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</Select><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Mensagem"><textarea value={content} onChange={e=>setContent(e.target.value)} className="min-h-28 rounded-md border border-input bg-background p-3 text-sm"/></Field><div><Button disabled={busy!==""||!classroom||!title.trim()||!content.trim()} onClick={()=>void create()}>{busy==="publish"?"Publicando…":"Publicar aviso"}</Button></div></div>
      {notices.error&&<div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><b>Não foi possível carregar os avisos.</b><Button className="ml-3" size="sm" variant="outline" onClick={()=>void notices.refetch()}>Tentar novamente</Button></div>}
      <div className="mt-5 space-y-2">{(notices.data??[]).map(n=><div key={n.id} className="rounded-xl border border-border p-3"><b>{n.title}</b><p className="text-xs text-muted-foreground">{n.classroom}</p><p className="mt-1 text-sm text-muted-foreground">{n.content}</p></div>)}</div>
    </Card>
  </div>;
}

export function TeacherWorkspace({initialSection="inicio"}:{initialSection?:Section}){
  const [section,setSection]=useState<Section>(initialSection);const d=useData(section);const current=menu.find(x=>x.id===section) ?? menu[0]!;
  const body=section==="inicio"?<Overview d={d} onNavigate={setSection}/>:section==="turmas"?<Classes d={d}/>:section==="alunos"?<Students d={d}/>:section==="disciplinas"?<Subjects d={d}/>:section==="notas"?<Grades d={d}/>:section==="frequencia"?<Attendance d={d}/>:section==="avaliacoes"?<Assessments d={d}/>:section==="atividades"?<Tasks d={d}/>:section==="agenda"?<Agenda d={d}/>:<Communication d={d}/>;
  return <AcademicShell title={current.label} subtitle="Gestão acadêmica docente" requiredRole="teacher"><div className="space-y-5"><DataError d={d}/><nav className="flex gap-2 overflow-x-auto pb-1">{menu.map(item=>{const Icon=item.Icon;return <button key={item.id} type="button" onClick={()=>setSection(item.id)} className={"inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold "+(item.id===section?"bg-primary text-primary-foreground":"border border-border bg-card text-muted-foreground hover:text-foreground")}><Icon className="size-4"/>{item.label}</button>})}</nav>{body}</div></AcademicShell>;
}
