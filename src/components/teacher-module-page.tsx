import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BarChart3, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, ClipboardList, Megaphone, Users, School } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText, formatScore, loadAttendance, loadGrades, loadStudents, loadTeacherInstitutionStudents, loadTeacherAcademicOptions, loadTeacherAssessments, loadTeacherCalendar, loadTeacherClassrooms, createTeacherClassroom, saveAttendance, createAssessment, createTeacherCalendarEvent, loadTaskSubmissions, gradeTaskSubmission, loadTeacherSubjects, createTeacherSubject, updateTeacherSubject, archiveTeacherSubject, loadTeacherSubjectAssignments, loadTeacherClassReport, assignTeacherSubjectToClass, unassignTeacherSubjectFromClass, teacherRemoveStudentFromClassroom, loadTeacherUnassignedStudents, teacherLinkStudentToSchool, updateTeacherTask, deleteTeacherTask, updateTeacherAnnouncement, deleteTeacherAnnouncement, type AttendanceRow, type TeacherStudent, type TeacherClassroom, type TeacherInstitutionStudent, type TaskSubmission, type TeacherSubject } from "@/lib/sina-data";
import { supabase } from "@/integrations/supabase/client";

export type TeacherModule = "turmas"|"disciplinas"|"notas"|"frequencia"|"avaliacoes"|"atividades"|"agenda"|"comunicacao";
const meta: Record<TeacherModule,{title:string;subtitle:string}> = { turmas:{title:"Turmas e alunos",subtitle:"Organize suas turmas e acompanhe os alunos"}, disciplinas:{title:"Disciplinas",subtitle:"Crie e organize as disciplinas que você leciona"}, notas:{title:"Notas",subtitle:"Lançamento e consulta de resultados"}, frequencia:{title:"Frequência",subtitle:"Diário de presença das suas turmas"}, avaliacoes:{title:"Avaliações",subtitle:"Crie avaliações e registre resultados"}, atividades:{title:"Atividades",subtitle:"Atividades, prazos e entregas"}, agenda:{title:"Agenda",subtitle:"Calendário acadêmico das suas turmas"}, comunicacao:{title:"Comunicação",subtitle:"Avisos para alunos e turmas"} };
function Guard({children}:{children:ReactNode}) { const role=useQuery({queryKey:["my-role"],queryFn:async()=>{const m=await import("@/lib/sina-data");return m.getRole()}}); if(role.isPending)return <AcademicShell title="Professor" subtitle="Área acadêmica"><div className="sina-card mt-8 p-6">Verificando acesso…</div></AcademicShell>; if(role.error||role.data!=="teacher")return <AcademicShell title="Professor" subtitle="Área acadêmica"><div className="sina-card mt-8 p-6 text-sm">{role.error?errorText(role.error):"Esta área é exclusiva para professores autorizados."}</div></AcademicShell>; return <>{children}</>; }
export function TeacherDashboard(){return <Guard><AcademicShell title="Dashboard" subtitle="Visão geral da atividade docente"><DashboardContent/></AcademicShell></Guard>}
function DashboardContent(){
  const c=useQuery({queryKey:["teacher-dashboard-classes"],queryFn:loadTeacherClassrooms});
  const s=useQuery({queryKey:["teacher-dashboard-students"],queryFn:loadStudents});
  const subjects=useQuery({queryKey:["teacher-dashboard-subjects"],queryFn:loadTeacherSubjects});
  const e=useQuery({queryKey:["teacher-dashboard-events"],queryFn:()=>{const a=new Date(),b=new Date();b.setDate(b.getDate()+14);return loadTeacherCalendar(a.toISOString(),b.toISOString())}});
  const links=[["/professor/turmas","Turmas e alunos",Users],["/professor/disciplinas","Disciplinas",BookOpen],["/professor/notas","Notas",BarChart3],["/professor/frequencia","Frequência",CheckCircle2],["/professor/avaliacoes","Avaliações",ClipboardCheck],["/professor/atividades","Atividades",ClipboardList],["/professor/agenda","Agenda",CalendarDays],["/professor/comunicacao","Comunicação",Megaphone]] as const;
  return <div className="mt-6 space-y-5">
    <section className="rounded-3xl bg-brand p-6 text-brand-foreground md:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-brand-muted">Área docente</p><h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">Seu espaço de trabalho</h1><p className="mt-2 max-w-2xl text-sm text-brand-muted">Crie disciplinas, organize suas turmas, publique atividades e acompanhe o desempenho dos alunos.</p></section>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Turmas" value={c.data?.length||0} icon={Users}/><Metric label="Alunos" value={(s.data||[]).filter(x=>!!x.classroom_id&&(c.data||[]).some(item=>item.id===x.classroom_id)).length} icon={Users}/><Metric label="Disciplinas" value={subjects.data?.length||0} icon={BookOpen}/><Metric label="Próximos eventos" value={e.data?.length||0} icon={CalendarDays}/></div>
    <section className="sina-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Ações</p><h2 className="mt-1 text-lg font-semibold">O que você precisa fazer?</h2></div><Link to="/professor/atividades" className="text-sm font-medium text-primary">Publicar atividade →</Link></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{links.map(([to,label,Icon])=><Link key={to} to={to} className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-muted/50"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4"/></span><span className="font-medium">{label}</span></Link>)}</div></section>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="sina-card p-5"><h2 className="font-semibold">Próximos eventos</h2><div className="mt-3 space-y-2">{(e.data||[]).slice(0,5).map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.classroom_name||"Institucional"}</p></div><span className="text-xs text-muted-foreground">{new Date(item.start_at).toLocaleDateString("pt-BR")}</span></div>)}{!e.data?.length&&<p className="text-sm text-muted-foreground">Nenhum evento próximo. Seus próximos compromissos aparecerão aqui.</p>}</div></section>
      <section className="sina-card p-5"><h2 className="font-semibold">Disciplinas e turmas</h2><div className="mt-3 space-y-2">{(subjects.data||[]).slice(0,5).map(item=><div key={item.id} className="flex items-center justify-between rounded-xl border border-border p-3"><span className="font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{item.code||"Sem código"}</span></div>)}{!subjects.data?.length&&<p className="text-sm text-muted-foreground">Crie sua primeira disciplina.</p>}</div></section>
    </div>
  </div>
}
function Metric({label,value,icon:Icon}:{label:string;value:number;icon:typeof Users}){return <div className="sina-card p-5"><Icon className="size-5 text-primary"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p></div>}
export function TeacherModulePage({module}:{module:TeacherModule}){return <Guard><AcademicShell title={meta[module].title} subtitle={meta[module].subtitle}><ModuleContent module={module}/></AcademicShell></Guard>}
function ModuleContent({module}:{module:TeacherModule}){const qc=useQueryClient();const classes=useQuery({queryKey:["teacher-module-classes"],queryFn:loadTeacherClassrooms});const [classId,setClassId]=useState("");const active=classId||(classes.data?.[0]?.id||"");const students=useQuery({queryKey:["teacher-module-students"],queryFn:loadStudents,enabled:["turmas","notas"].includes(module)});
const registeredStudents=useQuery({queryKey:["teacher-registered-students"],queryFn:loadTeacherInstitutionStudents,enabled:module==="turmas"});const [studentId,setStudentId]=useState("");const student=(students.data||[]).find(x=>x.id===studentId)||(students.data||[]).find(x=>!!x.teacher_id);const grades=useQuery({queryKey:["teacher-module-grades",student?.id],queryFn:()=>loadGrades(student?.id||""),enabled:module==="notas"&&!!student?.id});const day=new Date().toISOString().slice(0,10);const report=useQuery({queryKey:["teacher-class-report",active],queryFn:()=>loadTeacherClassReport(active),enabled:module==="turmas"&&!!active});const attendance=useQuery({queryKey:["teacher-module-attendance",active,day],queryFn:()=>loadAttendance(active,day),enabled:module==="frequencia"&&!!active});
if(classes.isPending)return <div className="sina-card mt-6 p-6">Carregando dados…</div>;
const noClasses=!classes.data?.length;
if(module==="disciplinas")return <div className="space-y-5"><NoClassroomBanner visible={noClasses} onCreated={()=>void classes.refetch()}/><SubjectBox/></div>;
if(module==="turmas")return <div className="mt-6 space-y-5"><NoClassroomBanner visible={noClasses} onCreated={()=>void classes.refetch()}/>
  <ClassSelect classes={classes.data||[]} value={active} onChange={setClassId}/>
  <section className="sina-card p-6">
    <h2 className="font-semibold">Alunos da turma</h2>
    <div className="mt-4 divide-y divide-border">
      {(students.data||[]).filter(x=>x.teacher_id&&(!active||x.classroom_id===active)).map(x=>
        <div key={x.id} className="flex items-center justify-between gap-3 py-3">
          <div><p className="font-medium">{x.full_name}</p><p className="text-xs text-muted-foreground">{x.enrollment} · {x.classroom}</p></div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{x.attendance==null?"Freq. —":"Freq. "+formatScore(x.attendance)+"%"}</span>
        </div>
      )}
      {!students.isPending && !(students.data||[]).some(x=>x.teacher_id&&(!active||x.classroom_id===active)) &&
        <p className="py-4 text-sm text-muted-foreground">Nenhum aluno vinculado ainda. Quando a escola vincular alunos a esta turma, eles aparecerão aqui.</p>}
    </div>
  </section>
  <TeacherRegisteredStudents students={registeredStudents.data||[]} classes={classes.data||[]} onChanged={async()=>{await registeredStudents.refetch();await students.refetch();}}/>
  <section className="sina-card p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Desempenho da turma</h2><p className="text-sm text-muted-foreground">Visão rápida de frequência, média e avaliações.</p></div><span className="text-xs text-muted-foreground">{report.data?.length||0} aluno(s)</span></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b border-border text-left"><th className="py-2">Aluno</th><th className="py-2">Matrícula</th><th className="py-2">Frequência</th><th className="py-2">Média</th><th className="py-2">Avaliações</th></tr></thead><tbody>{(report.data||[]).map(row=><tr key={row.student_id} className="border-b border-border"><td className="py-2 font-medium">{row.student_name}</td><td className="py-2">{row.enrollment}</td><td className="py-2">{row.attendance_percent==null?"—":row.attendance_percent+"%"}</td><td className="py-2">{formatScore(row.grade_average)}</td><td className="py-2">{row.assessment_count}</td></tr>)}</tbody></table></div>
  </section>
</div>;
if(module==="notas")return <div className="mt-6 space-y-5"><section className="sina-card p-5"><label className="text-sm font-medium">Aluno<select value={student?.id||""} onChange={e=>setStudentId(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione</option>{(students.data||[]).filter(x=>x.teacher_id).map(x=><option key={x.id} value={x.id}>{x.full_name} · {x.classroom}</option>)}</select></label></section>{student&&<><GradeForm student={student} qc={qc}/><BulkGradeForm students={(students.data||[]).filter(x=>x.teacher_id&&(!active||x.classroom_id===active))} qc={qc}/><section className="sina-card p-6"><h2 className="font-semibold">Histórico de notas</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="py-2">Disciplina</th><th className="py-2">Período</th><th className="py-2">Nota</th><th className="py-2">Faltas</th></tr></thead><tbody>{(grades.data||[]).map(g=><tr key={g.id} className="border-b border-border"><td className="py-2">{g.subject}</td><td className="py-2">{g.period}º</td><td className="py-2 font-semibold">{formatScore(g.score)}</td><td className="py-2">{g.absences}</td></tr>)}</tbody></table></div></section></>}</div>;
if(noClasses)return <div className="mt-6"><NoClassroomBanner visible onCreated={()=>void classes.refetch()}/></div>;
if(module==="frequencia")return <AttendanceBox classes={classes.data||[]} active={active} onChange={setClassId} data={attendance.data||[]} qc={qc}/>;
if(module==="avaliacoes")return <AssessmentsBox classes={classes.data||[]} active={active} onChange={setClassId}/>;
if(module==="agenda")return <AgendaBox classes={classes.data||[]}/>;
if(module==="atividades")return <PublishBox kind="task" classes={classes.data||[]}/>;
return <PublishBox kind="notice" classes={classes.data||[]}/>;
}
function NoClassroomBanner({visible,onCreated}:{visible:boolean;onCreated:()=>void}){
  const [name,setName]=useState("");
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  if(!visible)return null;
  async function create(){
    if(!name.trim())return;
    setBusy(true);
    try{await createTeacherClassroom(name,code);setName("");setCode("");onCreated();}
    catch(error){window.alert(errorText(error));}
    finally{setBusy(false);}
  }
  return <section className="sina-card mt-6 border-primary/20 bg-primary/5 p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wide text-primary">Primeiro passo</p><h2 className="mt-1 text-lg font-semibold">Você ainda não tem uma turma</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Crie sua primeira turma para liberar alunos, notas, frequência, atividades, avaliações, agenda e comunicação.</p><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da turma"/><Input value={code} onChange={e=>setCode(e.target.value)} placeholder="Código (opcional)"/><Button disabled={busy||!name.trim()} onClick={()=>void create()}>{busy?"Criando…":"Criar turma"}</Button></div></section>;
}

function SubjectBox(){
  const q=useQuery({queryKey:["teacher-subjects"],queryFn:loadTeacherSubjects});
  const classes=useQuery({queryKey:["teacher-subject-classrooms"],queryFn:loadTeacherClassrooms});
  const assignments=useQuery({queryKey:["teacher-subject-assignments"],queryFn:loadTeacherSubjectAssignments});
  const [name,setName]=useState(""); const [code,setCode]=useState(""); const [editing,setEditing]=useState<TeacherSubject|null>(null);
  const [assignSubject,setAssignSubject]=useState(""); const [assignClass,setAssignClass]=useState("");
  const save=async()=>{if(!name.trim())return;if(editing) await updateTeacherSubject(editing.id,name,code); else await createTeacherSubject(name,code);setName("");setCode("");setEditing(null);await q.refetch();};
  const assign=async()=>{if(!assignSubject||!assignClass)return;await assignTeacherSubjectToClass(assignSubject,assignClass);setAssignSubject("");await assignments.refetch();};
  return <div className="mt-6 space-y-5">
    <section className="rounded-3xl bg-brand p-6 text-brand-foreground md:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-brand-muted">Gestão docente</p><h1 className="mt-1 font-display text-2xl font-bold">Minhas disciplinas</h1><p className="mt-2 max-w-2xl text-sm text-brand-muted">Crie suas disciplinas e associe cada uma às turmas em que você leciona.</p></section>
    <section className="sina-card p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">{editing?"Editar disciplina":"Nova disciplina"}</h2><p className="text-sm text-muted-foreground">A disciplina fica vinculada à sua instituição.</p></div>{editing&&<Button variant="outline" onClick={()=>{setEditing(null);setName("");setCode("")}}>Cancelar</Button>}</div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da disciplina"/><Input value={code} onChange={e=>setCode(e.target.value)} placeholder="Código (opcional)"/><Button disabled={!name.trim()} onClick={()=>void save()}>{editing?"Salvar alterações":"Criar disciplina"}</Button></div></section>
    <section className="sina-card p-6"><h2 className="font-semibold">Associar disciplina a uma turma</h2><p className="mt-1 text-sm text-muted-foreground">Depois da associação, a disciplina passa a aparecer nos fluxos de atividades, avaliações e para os alunos.</p><div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><select value={assignSubject} onChange={e=>setAssignSubject(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Disciplina</option>{(q.data||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={assignClass} onChange={e=>setAssignClass(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Turma</option>{(classes.data||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><Button disabled={!assignSubject||!assignClass} onClick={()=>void assign()}>Associar</Button></div><div className="mt-5 grid gap-2 md:grid-cols-2">{(assignments.data||[]).map(x=><div key={x.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="font-medium">{x.subject_name}</p><p className="text-xs text-muted-foreground">{x.classroom_name}</p></div><Button size="sm" variant="ghost" onClick={async()=>{await unassignTeacherSubjectFromClass(x.id);await assignments.refetch()}}>Remover</Button></div>)}</div></section>
    <section className="sina-card p-6"><h2 className="font-semibold">Disciplinas disponíveis</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{(q.data||[]).map(subject=><article key={subject.id} className="rounded-2xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{subject.name}</p><p className="mt-1 text-xs text-muted-foreground">{subject.code||"Sem código"}{subject.created_by?" · criada por você":""}</p></div>{subject.created_by&&<div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>{setEditing(subject);setName(subject.name);setCode(subject.code||"")}}>Editar</Button><Button size="sm" variant="ghost" onClick={async()=>{await archiveTeacherSubject(subject.id);await q.refetch()}}>Arquivar</Button></div>}</div></article>)}</div>{!q.isPending&&!q.data?.length&&<p className="mt-4 text-sm text-muted-foreground">Nenhuma disciplina disponível ainda. Crie uma disciplina ou aguarde a escola disponibilizar uma para sua instituição.</p>}</section>
  </div>;
}
function TeacherRegisteredStudents({students,classes,onChanged}:{students:TeacherInstitutionStudent[];classes:TeacherClassroom[];onChanged:()=>Promise<void>}){
  const [search,setSearch]=useState("");
  const [enrollments,setEnrollments]=useState<Record<string,string>>({});
  const [classrooms,setClassrooms]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const unassigned=useQuery({queryKey:["teacher-unassigned-students"],queryFn:loadTeacherUnassignedStudents});
  const visible=students.filter(student=>{
    const q=search.trim().toLowerCase();
    if(!q)return true;
    return student.full_name.toLowerCase().includes(q)||(student.enrollment||"").toLowerCase().includes(q)||(student.classroom||"").toLowerCase().includes(q);
  });
  async function link(student:TeacherInstitutionStudent){
    const classroomId=classrooms[student.id]||student.classroom_id||classes[0]?.id||"";
    const classroom=classes.find(x=>x.id===classroomId);
    const enrollment=(enrollments[student.id]??student.enrollment??"").trim();
    if(!classroom||!enrollment)return;
    setBusy(student.id);
    try{
      const {error}=await supabase.rpc("teacher_link_roster_student",{_student_id:student.id,_enrollment:enrollment,_classroom:classroom.name});
      if(error)throw error;
      await onChanged();
    }catch(error){window.alert(errorText(error));}
    finally{setBusy(null);}
  }
  async function linkSchool(studentId:string){
    setBusy(studentId);
    try{
      await teacherLinkStudentToSchool(studentId);
      await Promise.all([onChanged(),unassigned.refetch()]);
      window.alert("Aluno vinculado à escola. Agora ele pode ser colocado em uma turma.");
    }catch(error){window.alert(errorText(error));}
    finally{setBusy(null);}
  }
  async function remove(student:TeacherInstitutionStudent){
    if(!window.confirm("Remover "+student.full_name+" da sua turma? O aluno continuará cadastrado no SINA."))return;
    setBusy(student.id);
    try{await teacherRemoveStudentFromClassroom(student.id);await onChanged();}
    catch(error){window.alert(errorText(error));}
    finally{setBusy(null);}
  }
  return <section className="sina-card p-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Gestão de alunos</p><h2 className="mt-1 font-semibold">Alunos cadastrados</h2><p className="mt-1 text-sm text-muted-foreground">Consulte os alunos da sua escola, vincule alunos sem escola à instituição ativa e depois coloque-os nas suas turmas.</p></div>
      <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, matrícula ou turma" className="md:max-w-sm"/>
    </div>

    <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <School className="mt-0.5 size-5 text-primary"/>
        <div>
          <h3 className="font-semibold">Alunos sem escola</h3>
          <p className="mt-1 text-sm text-muted-foreground">O professor pode vincular um aluno sem escola à <strong>escola ativa do próprio professor</strong>. Ele não pode escolher outra instituição.</p>
        </div>
      </div>
      {unassigned.isPending ? <p className="mt-4 text-sm text-muted-foreground">Verificando alunos sem escola…</p> :
       unassigned.error ? <p className="mt-4 text-sm text-destructive">{errorText(unassigned.error)}</p> :
       unassigned.data?.length ? <div className="mt-4 space-y-2">
         {unassigned.data.map(student=><div key={student.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
           <div><p className="font-medium">{student.full_name}</p><p className="text-xs text-muted-foreground">{student.enrollment||"Sem matrícula"} · Ainda sem escola</p></div>
           <Button disabled={busy===student.id} onClick={()=>void linkSchool(student.id)}>{busy===student.id?"Vinculando…":"Vincular à minha escola"}</Button>
         </div>)}
       </div> :
       <p className="mt-4 text-sm text-muted-foreground">Não há alunos aguardando vínculo escolar.</p>}
    </section>

    <div className="mt-5 grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Cadastrados</p><p className="mt-1 text-xl font-semibold">{students.length}</p></div>
      <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Sem turma</p><p className="mt-1 text-xl font-semibold">{students.filter(x=>x.class_status==="sem_turma").length}</p></div>
      <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Nas suas turmas</p><p className="mt-1 text-xl font-semibold">{students.filter(x=>x.class_status==="minha_turma").length}</p></div>
    </div>
    <div className="mt-5 divide-y divide-border">
      {visible.map(student=>{
        const selectedClass=classrooms[student.id]||student.classroom_id||classes[0]?.id||"";
        const enrollment=(enrollments[student.id]??student.enrollment??"");
        return <div key={student.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_180px_200px_auto] lg:items-center">
          <div><p className="font-medium">{student.full_name}</p><p className="text-xs text-muted-foreground">{student.enrollment||"Sem matrícula"}{student.classroom?" · "+student.classroom:""}</p></div>
          {student.class_status==="outra_turma" ? <div className="lg:col-span-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">Já vinculado a outra turma</span></div> : <>
            <Input value={enrollment} onChange={e=>setEnrollments(v=>({...v,[student.id]:e.target.value}))} placeholder="Matrícula"/>
            <select value={selectedClass} onChange={e=>setClassrooms(v=>({...v,[student.id]:e.target.value}))} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione a turma</option>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <div className="flex gap-2"><Button disabled={busy===student.id||!selectedClass||!enrollment.trim()} onClick={()=>void link(student)}>{busy===student.id?"Salvando…":student.class_status==="minha_turma"?"Mover":"Vincular"}</Button>{student.class_status==="minha_turma"&&<Button variant="outline" disabled={busy===student.id} onClick={()=>void remove(student)}>Remover</Button>}</div>
          </>}
        </div>;
      })}
      {!visible.length&&<p className="py-5 text-sm text-muted-foreground">Nenhum aluno encontrado.</p>}
    </div>
  </section>;
}
function ClassSelect({classes,value,onChange}:{classes:any[];value:string;onChange:(v:string)=>void}){return <div className="sina-card p-5"><label className="text-sm font-medium">Turma<select value={value} onChange={e=>onChange(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.code?" · "+c.code:""} · {c.student_count} aluno(s)</option>)}</select></label></div>}
function BulkGradeForm({students,qc}:{students:TeacherStudent[];qc:any}){
  const subjects=useQuery({queryKey:["teacher-grade-subjects"],queryFn:loadTeacherSubjects});
  const [subject,setSubject]=useState("");const [period,setPeriod]=useState("1");const [scores,setScores]=useState<Record<string,string>>({});const [saving,setSaving]=useState(false);
  async function save(){
    setSaving(true);
    try{
      for(const s of students){
        const raw=scores[s.id];if(raw==null||raw==="")continue;
        const score=Number(raw);if(score<0||score>10)throw new Error("As notas devem estar entre 0 e 10.");
        const {error}=await supabase.rpc("teacher_upsert_grade",{_student_id:s.id,_subject:subject,_period:Number(period),_score:score,_absences:0});
        if(error)throw error;
      }
      await qc.invalidateQueries({queryKey:["teacher-module-grades"]});setScores({});
    }catch(error){window.alert(errorText(error));}
    finally{setSaving(false);}
  }
  return <section className="sina-card p-6"><div><h2 className="font-semibold">Lançamento rápido da turma</h2><p className="mt-1 text-sm text-muted-foreground">Lance a mesma disciplina e período para vários alunos de uma vez.</p></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_150px_auto]"><select value={subject} onChange={e=>setSubject(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Disciplina</option>{(subjects.data||[]).map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select><select value={period} onChange={e=>setPeriod(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{[1,2,3,4].map(n=><option key={n} value={n}>{n}º período</option>)}</select><Button disabled={!subject||!Object.values(scores).some(Boolean)||saving} onClick={()=>void save()}>{saving?"Salvando…":"Salvar notas"}</Button></div><div className="mt-4 grid gap-2 md:grid-cols-2">{students.map(s=><div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="font-medium">{s.full_name}</p><p className="text-xs text-muted-foreground">{s.enrollment}</p></div><Input className="max-w-28" type="number" min="0" max="10" step=".01" value={scores[s.id]??""} onChange={e=>setScores(v=>({...v,[s.id]:e.target.value}))} placeholder="Nota"/></div>)}</div></section>;
}
function GradeForm({student,qc}:{student:TeacherStudent;qc:any}){
  const subjects=useQuery({queryKey:["teacher-single-grade-subjects"],queryFn:loadTeacherSubjects});
  const [subject,setSubject]=useState("");const [period,setPeriod]=useState("1");const [score,setScore]=useState("");const [absences,setAbsences]=useState("");const [saving,setSaving]=useState(false);
  async function save(){
    const n=Number(score),f=Number(absences||0);
    if(!subject||Number.isNaN(n)||n<0||n>10||Number.isNaN(f)||f<0)return;
    setSaving(true);
    try{
      const {error}=await supabase.rpc("teacher_upsert_grade",{_student_id:student.id,_subject:subject,_period:Number(period),_score:n,_absences:f});
      if(error)throw error;
      await qc.invalidateQueries({queryKey:["teacher-module-grades",student.id]});
      setScore("");setAbsences("");
    }catch(error){window.alert(errorText(error));}
    finally{setSaving(false);}
  }
  return <section className="sina-card p-6"><h2 className="font-semibold">Lançar nota — {student.full_name}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={subject} onChange={e=>setSubject(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Disciplina</option>{(subjects.data||[]).map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select><select value={period} onChange={e=>setPeriod(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{[1,2,3,4].map(n=><option key={n} value={n}>{n}º período</option>)}</select><Input value={score} onChange={e=>setScore(e.target.value)} type="number" min="0" max="10" step=".01" placeholder="Nota"/><Input value={absences} onChange={e=>setAbsences(e.target.value)} type="number" min="0" step="1" placeholder="Faltas"/><Button className="sm:col-span-2" disabled={!subject||!score||saving} onClick={()=>void save()}>{saving?"Salvando…":"Salvar nota"}</Button></div></section>;
}
function AttendanceBox({classes,active,onChange,data,qc}:{classes:any[];active:string;onChange:(v:string)=>void;data:AttendanceRow[];qc:any}){const [draft,setDraft]=useState<Record<string,{status:AttendanceRow["status"];note:string}>>({});return <div className="mt-6 space-y-5"><ClassSelect classes={classes} value={active} onChange={onChange}/><section className="sina-card p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Diário de frequência</h2><p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("pt-BR")}</p></div><Button onClick={async()=>{await saveAttendance(active,new Date().toISOString().slice(0,10),Object.entries(draft).map(([student_id,v])=>({student_id,...v})));await qc.invalidateQueries({queryKey:["teacher-module-attendance",active]})}}>Salvar frequência</Button></div><div className="mt-4 divide-y divide-border">{data.map(r=>{const v=draft[r.student_id]||{status:r.status,note:r.note||""};return <div key={r.student_id} className="grid gap-2 py-3 sm:grid-cols-[1fr_170px_1fr] sm:items-center"><div><p className="font-medium">{r.full_name}</p><p className="text-xs text-muted-foreground">{r.enrollment}</p></div><select value={v.status} onChange={e=>setDraft(d=>({...d,[r.student_id]:{...v,status:e.target.value as AttendanceRow["status"]}}))} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="present">Presente</option><option value="late">Atrasado</option><option value="absent">Falta</option><option value="excused">Justificada</option></select><Input value={v.note} onChange={e=>setDraft(d=>({...d,[r.student_id]:{...v,note:e.target.value}}))} placeholder="Observação"/></div>})}</div></section></div>}
function AssessmentsBox({classes,active,onChange}:{classes:any[];active:string;onChange:(v:string)=>void}){
  const o=useQuery({queryKey:["teacher-options"],queryFn:loadTeacherAcademicOptions});
  const subjects=useQuery({queryKey:["teacher-assessment-subjects"],queryFn:loadTeacherSubjects});
  const a=useQuery({queryKey:["teacher-assessments",active],queryFn:()=>loadTeacherAssessments(active),enabled:!!active});
  const s=useQuery({queryKey:["teacher-assessment-students",active],queryFn:loadStudents,enabled:!!active});
  const [title,setTitle]=useState("");
  const [subjectId,setSubjectId]=useState("");
  const [termId,setTermId]=useState("");
  const [type,setType]=useState("prova");
  const [weight,setWeight]=useState("1");
  const [maxScore,setMaxScore]=useState("10");
  const [dueAt,setDueAt]=useState("");
  const [selected,setSelected]=useState("");
  const [scores,setScores]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);

  async function create(){
    if(!title.trim()||!active)return;
    setBusy(true);
    try{
      await createAssessment({
        classroomId:active,
        subjectId:subjectId||null,
        termId:termId||null,
        title:title.trim(),
        type,
        weight:Number(weight)||1,
        maxScore:Number(maxScore)||10,
        dueAt:dueAt?new Date(dueAt).toISOString():null,
      });
      setTitle("");setSubjectId("");setTermId("");setDueAt("");
      await a.refetch();
    }catch(error){window.alert(errorText(error));}
    finally{setBusy(false);}
  }

  const selectedAssessment=(a.data||[]).find(x=>x.id===selected);
  const classStudents=(s.data||[]).filter(x=>x.classroom_id===active);

  async function saveScore(studentId:string){
    const raw=scores[studentId];
    if(raw==null||raw==="")return;
    const max=Number(selectedAssessment?.max_score??10);
    const score=Number(raw);
    if(score<0||score>max){window.alert("A nota deve estar entre 0 e "+max+".");return;}
    try{
      const {error}=await supabase.rpc("teacher_upsert_assessment_score",{_assessment_id:selected,_student_id:studentId,_score:score,_feedback:""});
      if(error)throw error;
      await a.refetch();
    }catch(error){window.alert(errorText(error));}
  }

  return <div className="mt-6 space-y-5">
    <section className="sina-card p-6">
      <h2 className="font-semibold">Nova avaliação</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ClassSelect classes={classes} value={active} onChange={v=>{onChange(v);setSelected("");}}/>
        <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título da avaliação"/>
        <select value={subjectId} onChange={e=>setSubjectId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Disciplina (opcional)</option>{(subjects.data||o.data?.subjects||[]).map((x:any)=><option key={x.id} value={x.id}>{x.name}{x.code?" · "+x.code:""}</option>)}
        </select>
        <select value={termId} onChange={e=>setTermId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Período letivo (opcional)</option>{(o.data?.terms||[]).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select value={type} onChange={e=>setType(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="prova">Prova</option><option value="trabalho">Trabalho</option><option value="atividade">Atividade</option><option value="seminario">Seminário</option>
        </select>
        <Input type="number" min="0.1" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="Peso"/>
        <Input type="number" min="0.1" step="0.1" value={maxScore} onChange={e=>setMaxScore(e.target.value)} placeholder="Nota máxima"/>
        <Input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/>
        <Button disabled={!title.trim()||!active||busy} onClick={()=>void create()}>{busy?"Criando…":"Criar avaliação"}</Button>
      </div>
    </section>
    <section className="sina-card p-6">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Avaliações da turma</h2><p className="text-sm text-muted-foreground">Selecione uma avaliação para lançar as notas.</p></div><span className="text-xs text-muted-foreground">{a.data?.length||0} avaliação(ões)</span></div>
      <div className="mt-4 space-y-2">{(a.data||[]).map(x=><article key={x.id} className={"rounded-xl border p-4 "+(selected===x.id?"border-primary bg-primary/5":"border-border")}><button type="button" onClick={()=>setSelected(x.id)} className="w-full text-left"><div className="flex items-center justify-between gap-3"><p className="font-medium">{x.title}</p><span className="text-xs text-muted-foreground">máx. {x.max_score}</span></div><p className="mt-1 text-xs text-muted-foreground">{x.subject_name||"Sem disciplina"} · {x.term_name||"Sem período"} · peso {x.weight}</p></button></article>)}</div>
      {!a.isPending&&!a.data?.length&&<p className="mt-4 text-sm text-muted-foreground">Nenhuma avaliação cadastrada ainda. Crie uma avaliação para começar a lançar os resultados.</p>}
    </section>
    {selected&&selectedAssessment&&<section className="sina-card p-6">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Lançar resultados — {selectedAssessment.title}</h2><p className="text-sm text-muted-foreground">Nota máxima: {selectedAssessment.max_score}</p></div></div>
      <div className="mt-4 divide-y divide-border">{classStudents.map(student=><div key={student.id} className="grid gap-2 py-3 md:grid-cols-[1fr_120px_auto] md:items-center"><div><p className="font-medium">{student.full_name}</p><p className="text-xs text-muted-foreground">{student.enrollment}</p></div><Input type="number" min="0" max={selectedAssessment.max_score} step=".01" value={scores[student.id]??""} onChange={e=>setScores(v=>({...v,[student.id]:e.target.value}))} placeholder={"0–"+selectedAssessment.max_score}/><Button disabled={scores[student.id]===undefined||scores[student.id]===""} onClick={()=>void saveScore(student.id)}>Salvar</Button></div>)}</div>
      {!classStudents.length&&<p className="mt-4 text-sm text-muted-foreground">Nenhum aluno vinculado ainda. Os alunos aparecerão aqui depois que forem associados à turma.</p>}
    </section>}
  </div>;
}

function AgendaBox({classes}:{classes:any[]}){
  const q=useQuery({queryKey:["teacher-agenda-module"],queryFn:()=>{const a=new Date(),b=new Date();b.setMonth(b.getMonth()+2);return loadTeacherCalendar(a.toISOString(),b.toISOString())}});
  const [title,setTitle]=useState("");const [start,setStart]=useState("");const [classroom,setClassroom]=useState("");const [type,setType]=useState("aula");
  return <div className="mt-6 space-y-5"><section className="sina-card p-6"><h2 className="font-semibold">Novo evento</h2><p className="mt-1 text-sm text-muted-foreground">Crie aulas, provas, trabalhos e outros eventos para suas turmas.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título"/><Input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/><select value={classroom} onChange={e=>setClassroom(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Evento institucional</option>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={type} onChange={e=>setType(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="aula">Aula</option><option value="prova">Prova</option><option value="trabalho">Trabalho</option><option value="evento">Evento</option><option value="outro">Outro</option></select><Button className="md:col-span-2" onClick={async()=>{if(!title||!start)return;await createTeacherCalendarEvent({classroomId:classroom||null,title,description:"",startAt:new Date(start).toISOString(),endAt:null,eventType:type});setTitle("");setStart("");await q.refetch()}}>Adicionar à agenda</Button></div></section><div className="grid gap-3 md:grid-cols-2">{(q.data||[]).map(x=><article key={x.id} className="sina-card p-5"><p className="font-semibold">{x.title}</p><p className="mt-1 text-xs text-muted-foreground">{x.classroom_name||"Institucional"} · {new Date(x.start_at).toLocaleString("pt-BR")} · {x.event_type}</p></article>)}</div></div>}

function PublishBox({kind,classes}:{kind:"notice"|"task";classes:any[]}){
  const q=useQuery({queryKey:["teacher-publish",kind],queryFn:async()=>{const {data,error}=await supabase.rpc(kind==="notice"?"teacher_list_announcements":"teacher_list_tasks");if(error)throw error;return data||[]}});
  const subjects=useQuery({queryKey:["teacher-subjects"],queryFn:loadTeacherSubjects,enabled:kind==="task"});
  const [classroom,setClassroom]=useState("");const [title,setTitle]=useState("");const [subject,setSubject]=useState("");const [content,setContent]=useState("");const [due,setDue]=useState("");const [selectedTask,setSelectedTask]=useState("");const [editing,setEditing]=useState<any>(null);const [saving,setSaving]=useState(false);
  const submissions=useQuery({queryKey:["task-submissions",selectedTask],queryFn:()=>loadTaskSubmissions(selectedTask),enabled:kind==="task"&&!!selectedTask});
  function startEdit(item:any){setEditing(item);setClassroom(item.classroom||"");setTitle(item.title||"");setContent(item.content||item.description||"");setSubject(item.subject||"");setDue(item.due_at?new Date(item.due_at).toISOString().slice(0,16):"");}
  function clearForm(){setEditing(null);setTitle("");setContent("");setSubject("");setDue("");setClassroom("");}
  async function publish(){
    if(!classroom||!title.trim()||(kind==="task"&&!subject))return;
    setSaving(true);
    try{
      if(editing){
        if(kind==="notice") await updateTeacherAnnouncement({id:editing.id,classroom,title:title.trim(),content});
        else await updateTeacherTask({id:editing.id,classroom,subject,title:title.trim(),description:content,dueAt:due?new Date(due).toISOString():null});
      }else{
        const {error}=kind==="notice"?await supabase.rpc("teacher_create_announcement",{_classroom:classroom,_title:title.trim(),_content:content}):await supabase.rpc("teacher_create_task",{_classroom:classroom,_subject:subject,_title:title.trim(),_description:content,_due_at:due?new Date(due).toISOString():null});
        if(error)throw error;
      }
      clearForm();await q.refetch();
    }catch(error){window.alert(errorText(error));}
    finally{setSaving(false);}
  }
  async function remove(item:any){
    if(!window.confirm("Excluir este "+(kind==="notice"?"aviso":"atividade")+"? Essa ação não pode ser desfeita."))return;
    try{if(kind==="notice")await deleteTeacherAnnouncement(item.id);else await deleteTeacherTask(item.id);if(editing?.id===item.id)clearForm();await q.refetch();}catch(error){window.alert(errorText(error));}
  }
  return <div className="mt-6 grid gap-5 lg:grid-cols-2">
    <section className="sina-card p-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{kind==="task"?<ClipboardList className="size-5"/>:<Megaphone className="size-5"/>}</span><div><h2 className="font-semibold">{kind==="notice"?"Publicar aviso":"Publicar atividade"}</h2><p className="mt-1 text-sm text-muted-foreground">{kind==="notice"?"Envie um comunicado para uma turma.":"Crie uma atividade, defina a disciplina e o prazo para os alunos."}</p></div></div>
      <div className="mt-5 space-y-3">
        <select value={classroom} onChange={e=>setClassroom(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione a turma</option>{classes.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select>
        {kind==="task"&&<select value={subject} onChange={e=>setSubject(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione a disciplina</option>{(subjects.data||[]).map(x=><option key={x.id} value={x.name}>{x.name}{x.code?" · "+x.code:""}</option>)}</select>}
        <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind==="notice"?"Título do aviso":"Título da atividade"}/>
        <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder={kind==="notice"?"Escreva o comunicado":"Descreva o que os alunos devem fazer"} className="min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm"/>
        {kind==="task"&&<Input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/>}
        <Button disabled={!classroom||!title.trim()||(kind==="task"&&!subject)||saving} onClick={()=>void publish()}>{saving?"Salvando…":editing?"Salvar alterações":kind==="notice"?"Publicar aviso":"Publicar atividade"}</Button>
      </div>
    </section>
    <section className="sina-card p-6"><h2 className="font-semibold">{kind==="notice"?"Meus avisos":"Minhas atividades"}</h2><div className="mt-4 space-y-2">{(q.data||[]).slice(0,10).map((x:any)=><article key={x.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><button type="button" className="min-w-0 flex-1 text-left" onClick={()=>kind==="task"&&setSelectedTask(x.id)}><div className="flex items-center justify-between gap-3"><p className="font-medium">{x.title}</p>{kind==="task"&&<span className="text-xs text-muted-foreground">{x.due_at?new Date(x.due_at).toLocaleDateString("pt-BR"):"Sem prazo"}</span>}</div><p className="mt-1 text-xs text-muted-foreground">{x.classroom}{x.subject?" · "+x.subject:""}</p><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{x.content||x.description}</p></button><div className="flex shrink-0 gap-1"><Button size="sm" variant="ghost" onClick={()=>startEdit(x)}>Editar</Button><Button size="sm" variant="ghost" onClick={()=>void remove(x)}>Excluir</Button></div></div></article>)}</div>
      {kind==="task"&&selectedTask&&<div className="mt-5 border-t border-border pt-5"><h3 className="font-semibold">Entregas da atividade</h3><div className="mt-3 space-y-3">{(submissions.data||[]).map((s:TaskSubmission)=><div key={s.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{s.student_name}</p><p className="text-xs text-muted-foreground">{s.enrollment} · {s.status}</p></div><span className="text-sm font-semibold">{s.score==null?"Sem nota":s.score}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{s.content||"Sem texto"}</p><div className="mt-3 flex gap-2"><Input id={"score-"+s.id} type="number" min="0" max="10" step=".01" placeholder="Nota"/><Button onClick={async()=>{const el=document.getElementById("score-"+s.id) as HTMLInputElement;await gradeTaskSubmission(s.id,Number(el.value),"" );await submissions.refetch()}}>Corrigir</Button></div>{s.feedback&&<p className="mt-2 text-sm text-muted-foreground">Feedback: {s.feedback}</p>}</div>)}</div></div>}
    </section>
  </div>;
}
// SINA teacher workspace sync marker
// Complete teacher workspace: roster, classes, subjects, grades, attendance, assessments, tasks, calendar and communication.
