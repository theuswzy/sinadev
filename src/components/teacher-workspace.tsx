import { useState, type ReactNode } from "react";
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
  loadTeacherClassrooms, loadTeacherInstitutionStudents, loadTeacherSubjects, loadTeacherTasks, loadTeacherUnassignedStudents,
  loadTeacherUnassignedClassrooms, teacherClaimClassroom,
  loadTeacherUnassignedStudents, saveAttendance, teacherEnrollStudentInClassroom, teacherLinkStudentToSchool,
  teacherRemoveStudentFromClassroom, type AttendanceRow
} from "@/lib/sina-data";

type Section = "inicio"|"turmas"|"alunos"|"disciplinas"|"notas"|"frequencia"|"avaliacoes"|"atividades"|"agenda"|"comunicacao";
const menu: {id:Section;label:string;Icon:typeof Users}[]=[
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

function useData(){
  const qc=useQueryClient();
  const classes=useQuery({queryKey:["teacher-new-classes"],queryFn:loadTeacherClassrooms,staleTime:30000});
  const students=useQuery({queryKey:["teacher-new-students"],queryFn:loadTeacherInstitutionStudents,staleTime:30000});
  const subjects=useQuery({queryKey:["teacher-new-subjects"],queryFn:loadTeacherSubjects,staleTime:30000});
  const assignments=useQuery({queryKey:["teacher-new-assignments"],queryFn:async()=>{const {data,error}=await supabase.rpc("teacher_list_subject_assignments");if(error)throw error;return data??[]},staleTime:30000});
  const unassignedClasses=useQuery({queryKey:["teacher-new-unassigned-classes"],queryFn:loadTeacherUnassignedClassrooms,staleTime:15000});
  async function refresh(){await Promise.all([qc.invalidateQueries({queryKey:["teacher-new-classes"]}),qc.invalidateQueries({queryKey:["teacher-new-unassigned-classes"]}),qc.invalidateQueries({queryKey:["teacher-new-students"]}),qc.invalidateQueries({queryKey:["teacher-new-subjects"]}),qc.invalidateQueries({queryKey:["teacher-new-assignments"]})])}
  return {classes,students,subjects,assignments,refresh};
}

function Overview({d}:{d:ReturnType<typeof useData>}){
  const classes=(d.classes.data??[]).filter(x=>x.status==="active").length;
  const students=(d.students.data??[]).filter(x=>x.class_status==="minha_turma").length;
  const subjects=(d.subjects.data??[]).filter(x=>x.status==="active").length;
  const pending=(d.students.data??[]).filter(x=>x.class_status==="sem_turma").length;
  return <div className="space-y-5">
    <section className="rounded-3xl bg-brand p-6 text-brand-foreground sm:p-8"><p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Área docente</p><h1 className="mt-1 font-display text-2xl font-bold">Meu espaço acadêmico</h1><p className="mt-2 max-w-2xl text-sm text-brand-muted">Gestão de turmas, alunos, disciplinas, notas, frequência e comunicação. Tudo limitado à instituição e às turmas autorizadas.</p></section>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[Users,"Turmas",classes],[GraduationCap,"Alunos",students],[BookOpen,"Disciplinas",subjects],[School,"Sem turma",pending]].map(([I,l,v])=><div key={String(l)} className="sina-card p-5"><I className="size-5 text-primary"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">{String(l)}</p><p className="mt-1 text-3xl font-semibold">{String(v)}</p></div>)}</div>
    <Card title="Fluxo docente" description="A mesma organização do administrador, mas com permissões acadêmicas restritas."><div className="grid gap-3 md:grid-cols-4">{["Turmas e alunos","Disciplinas","Notas e frequência","Avaliações, atividades e avisos"].map(x=><div key={x} className="rounded-xl border border-border bg-muted/30 p-4 text-sm font-medium">{x}</div>)}</div></Card>
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
    {selected&&<Card title="Relatório da turma"><div className="grid gap-2 md:grid-cols-2">{(report.data??[]).map(s=><div key={s.student_id} className="rounded-xl border border-border p-3"><b>{s.student_name}</b><p className="text-xs text-muted-foreground">{s.enrollment} · Média {s.grade_average.toFixed(1)} · Frequência {s.attendance_percent==null?"—":s.attendance_percent+"%"}</p></div>)}</div></Card>}
  </div>;
}

function Students({d}:{d:ReturnType<typeof useData>}){
  const [search,setSearch]=useState("");const [busy,setBusy]=useState("");const [targetClass,setTargetClass]=useState<Record<string,string>>({});const [enrollments,setEnrollments]=useState<Record<string,string>>({});
  const waiting=useQuery({queryKey:["teacher-new-unassigned"],queryFn:loadTeacherUnassignedStudents,staleTime:15000});
  const list=(d.students.data??[]).filter(s=>(s.full_name+" "+s.enrollment+" "+s.classroom).toLowerCase().includes(search.toLowerCase()));
  function classFor(id:string){return targetClass[id]??""}
  function enrollmentFor(s:{id:string;enrollment:string|null}){return enrollments[s.id]??s.enrollment??""}
  async function school(id:string){setBusy(id);try{await teacherLinkStudentToSchool(id);await Promise.all([waiting.refetch(),d.refresh()]);toast.success("Aluno vinculado à escola.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  async function enroll(id:string){const classroom=classFor(id);const enrollment=enrollmentFor({id,enrollment:((d.students.data??[]).find(s=>s.id===id)?.enrollment??"")});if(!classroom||!enrollment.trim())return;setBusy(id);try{await teacherEnrollStudentInClassroom(id,classroom,enrollment.trim());await d.refresh();toast.success("Aluno vinculado à turma.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  async function remove(id:string){setBusy(id);try{await teacherRemoveStudentFromClassroom(id);await d.refresh();toast.success("Aluno removido da turma.");}catch(e){toast.error(errorText(e))}finally{setBusy("")}}
  return <div className="space-y-5">
    <Card title="Alunos da instituição" description="Escolha a turma diretamente em cada aluno. Alunos em uma turma sem professor também podem ser reatribuídos.">
      <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, matrícula ou turma"/>
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
        {list.length===0&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum aluno encontrado nesta escola.</p>}
      </div>
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
  return <div className="space-y-5"><Card title="Disciplinas" description="Cadastre e distribua as disciplinas que você administra."><div className="grid gap-3 md:grid-cols-[1fr_160px_auto]"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome"/><Input value={code} onChange={e=>setCode(e.target.value)} placeholder="Código"/><Button disabled={!name.trim()} onClick={()=>void create()}><Plus className="mr-2 size-4"/>Criar</Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{(d.subjects.data??[]).map(s=><div key={s.id} className="rounded-xl border border-border p-3"><b>{s.name}</b><p className="text-xs text-muted-foreground">{s.code||"Sem código"} · {s.status}</p></div>)}</div></Card>
  <Card title="Vincular disciplina à turma"><div className="grid gap-3 md:grid-cols-3"><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Selecione</option>{(d.subjects.data??[]).filter(s=>s.status==="active").map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><div className="self-end"><Button disabled={!subject||!classroom} onClick={()=>void assign()}>Vincular</Button></div></div><div className="mt-4 space-y-2">{(d.assignments.data??[]).map((a:{id:string;subject_name:string;classroom_name:string})=><div key={a.id} className="rounded-xl border border-border p-3 text-sm">{a.subject_name} · {a.classroom_name}</div>)}</div></Card></div>;
}

function Grades({d}:{d:ReturnType<typeof useData>}){
  const [student,setStudent]=useState("");const [subject,setSubject]=useState("");const [period,setPeriod]=useState("1");const [score,setScore]=useState("");const [absences,setAbsences]=useState("0");const [busy,setBusy]=useState(false);
  const grades=useQuery({queryKey:["teacher-new-grades",student],queryFn:async()=>{const {data,error}=await supabase.rpc("teacher_list_grades",{_student_id:student});if(error)throw error;return data??[]},enabled:!!student,staleTime:15000});
  async function save(){const n=Number(score),f=Number(absences);if(!student||!subject||Number.isNaN(n)||n<0||n>10||f<0)return;setBusy(true);try{const {error}=await supabase.rpc("teacher_upsert_grade",{_student_id:student,_subject:subject,_period:Number(period),_score:n,_absences:f});if(error)throw error;setScore("");await grades.refetch();toast.success("Nota salva.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  return <Card title="Notas" description="Lance notas e faltas por aluno."><div className="grid gap-3 md:grid-cols-5"><Select label="Aluno" value={student} onChange={setStudent}><option value="">Selecione</option>{(d.students.data??[]).filter(s=>s.class_status==="minha_turma").map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</Select><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Selecione</option>{(d.subjects.data??[]).filter(s=>s.status==="active").map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</Select><Select label="Período" value={period} onChange={setPeriod}>{[1,2,3,4].map(n=><option key={n} value={String(n)}>{n}º período</option>)}</Select><Field label="Nota"><Input type="number" min="0" max="10" step=".01" value={score} onChange={e=>setScore(e.target.value)}/></Field><div className="flex items-end gap-2"><Field label="Faltas"><Input type="number" min="0" value={absences} onChange={e=>setAbsences(e.target.value)}/></Field><Button disabled={busy||!student||!subject||!score} onClick={()=>void save()}>{busy?"Salvando…":"Salvar"}</Button></div></div><div className="mt-4 space-y-2">{(grades.data??[]).map((g:{id:string;subject:string;period:number;score:number})=><div key={g.id} className="flex justify-between rounded-xl border border-border p-3 text-sm"><span>{g.subject} · {g.period}º período</span><b>{g.score}</b></div>)}</div></Card>;
}

function Attendance({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [rows,setRows]=useState<AttendanceRow[]>([]);const [busy,setBusy]=useState(false);
  async function load(){if(!classroom)return;try{setRows(await loadAttendance(classroom,date))}catch(e){toast.error(errorText(e))}}
  async function save(){setBusy(true);try{await saveAttendance(classroom,date,rows.map(r=>({student_id:r.student_id,status:r.status,note:r.note})));toast.success("Frequência salva.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  return <Card title="Frequência" description="Diário por turma e por data."><div className="grid gap-3 md:grid-cols-[1fr_180px_auto]"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Field label="Data"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><div className="self-end"><Button disabled={!classroom} onClick={()=>void load()}>Carregar diário</Button></div></div><div className="mt-4 space-y-2">{rows.map((r,i)=><div key={r.student_id} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[1fr_160px_1fr]"><div><b>{r.full_name}</b><p className="text-xs text-muted-foreground">{r.enrollment}</p></div><select value={r.status} onChange={e=>setRows(v=>v.map((x,j)=>j===i?{...x,status:e.target.value as AttendanceRow["status"]}:x))} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="present">Presente</option><option value="absent">Ausente</option><option value="late">Atrasado</option><option value="excused">Justificado</option></select><Input value={r.note} onChange={e=>setRows(v=>v.map((x,j)=>j===i?{...x,note:e.target.value}:x))} placeholder="Observação"/></div>)}{rows.length>0&&<Button disabled={busy} onClick={()=>void save()}>{busy?"Salvando…":"Salvar frequência"}</Button>}</div></Card>;
}

function Assessments({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [subject,setSubject]=useState("");const [term,setTerm]=useState("");const [title,setTitle]=useState("");const [type,setType]=useState("prova");const [weight,setWeight]=useState("1");const [max,setMax]=useState("10");const [due,setDue]=useState("");const [busy,setBusy]=useState(false);
  const options=useQuery({queryKey:["teacher-new-options"],queryFn:loadTeacherAcademicOptions,staleTime:30000});const list=useQuery({queryKey:["teacher-new-assessments",classroom],queryFn:()=>loadTeacherAssessments(classroom),enabled:!!classroom});
  async function create(){setBusy(true);try{await createAssessment({classroomId:classroom,subjectId:subject||null,termId:term||null,title:title.trim(),type,weight:Number(weight),maxScore:Number(max),dueAt:due?new Date(due).toISOString():null});setTitle("");setDue("");await list.refetch();toast.success("Avaliação criada.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  return <Card title="Avaliações" description="Crie avaliações e acompanhe o que já foi cadastrado."><div className="grid gap-3 md:grid-cols-3"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Opcional</option>{(options.data?.subjects??[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select label="Período" value={term} onChange={setTerm}><option value="">Opcional</option>{(options.data?.terms??[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Tipo"><Input value={type} onChange={e=>setType(e.target.value)}/></Field><Field label="Peso"><Input type="number" value={weight} onChange={e=>setWeight(e.target.value)}/></Field><Field label="Nota máxima"><Input type="number" value={max} onChange={e=>setMax(e.target.value)}/></Field><Field label="Prazo"><Input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></Field><div className="self-end"><Button disabled={busy||!classroom||!title.trim()} onClick={()=>void create()}>{busy?"Salvando…":"Criar avaliação"}</Button></div></div><div className="mt-4 space-y-2">{(list.data??[]).map(a=><div key={a.id} className="rounded-xl border border-border p-3"><b>{a.title}</b><p className="text-xs text-muted-foreground">{a.subject_name} · {a.term_name} · {a.max_score} pontos</p></div>)}</div></Card>;
}

function Tasks({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [subject,setSubject]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [due,setDue]=useState("");const [selected,setSelected]=useState("");const [busy,setBusy]=useState(false);
  const tasks=useQuery({queryKey:["teacher-new-tasks"],queryFn:loadTeacherTasks,staleTime:15000});const submissions=useQuery({queryKey:["teacher-new-submissions",selected],queryFn:()=>loadTaskSubmissions(selected),enabled:!!selected});
  async function create(){setBusy(true);try{await createTeacherTask({classroom,subject,title:title.trim(),description,dueAt:due?new Date(due).toISOString():null});setTitle("");setDescription("");setDue("");await tasks.refetch();toast.success("Atividade publicada.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  async function grade(id:string,value:string){const n=Number(value);if(Number.isNaN(n)||n<0||n>10)return;try{await gradeTaskSubmission(id,n,"");await submissions.refetch();toast.success("Entrega corrigida.")}catch(e){toast.error(errorText(e))}}
  return <Card title="Atividades e entregas" description="Publique atividades, veja entregas e corrija notas."><div className="grid gap-3 md:grid-cols-2"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</Select><Select label="Disciplina" value={subject} onChange={setSubject}><option value="">Selecione</option>{(d.subjects.data??[]).filter(s=>s.status==="active").map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</Select><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Prazo"><Input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></Field><Field label="Descrição"><textarea value={description} onChange={e=>setDescription(e.target.value)} className="min-h-24 rounded-md border border-input bg-background p-3 text-sm"/></Field><div className="self-end"><Button disabled={busy||!classroom||!subject||!title.trim()} onClick={()=>void create()}>{busy?"Publicando…":"Publicar atividade"}</Button></div></div><div className="mt-5 grid gap-2 md:grid-cols-2">{(tasks.data??[]).map(t=><button key={t.id} type="button" onClick={()=>setSelected(t.id)} className={"rounded-xl border p-3 text-left "+(selected===t.id?"border-primary bg-primary/5":"border-border")}><b>{t.title}</b><p className="text-xs text-muted-foreground">{t.classroom} · {t.subject}</p></button>)}</div>{selected&&<div className="mt-5 space-y-2">{(submissions.data??[]).map(s=><div key={s.id} className="rounded-xl border border-border p-4"><b>{s.student_name}</b><p className="text-xs text-muted-foreground">{s.enrollment} · {s.status}</p><p className="mt-2 text-sm">{s.content||"Sem resposta textual."}</p><div className="mt-3 flex gap-2"><Input id={"score-"+s.id} type="number" min="0" max="10" step=".01" placeholder="Nota"/><Button onClick={()=>{const el=document.getElementById("score-"+s.id) as HTMLInputElement|null;if(el)void grade(s.id,el.value)}}>Corrigir</Button></div></div>)}</div>}</Card>;
}

function Agenda({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [start,setStart]=useState("");const [type,setType]=useState("aula");const [busy,setBusy]=useState(false);
  const from=new Date().toISOString();const to=new Date(Date.now()+60*86400000).toISOString();const events=useQuery({queryKey:["teacher-new-calendar"],queryFn:()=>loadTeacherCalendar(from,to),staleTime:30000});
  async function create(){setBusy(true);try{await createTeacherCalendarEvent({classroomId:classroom||null,title:title.trim(),description,startAt:new Date(start).toISOString(),endAt:null,eventType:type});setTitle("");setDescription("");setStart("");await events.refetch();toast.success("Evento criado.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  return <Card title="Agenda" description="Organize aulas, reuniões e eventos acadêmicos."><div className="grid gap-3 md:grid-cols-2"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Todas</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Field label="Tipo"><Input value={type} onChange={e=>setType(e.target.value)}/></Field><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Quando"><Input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></Field><Field label="Descrição"><textarea value={description} onChange={e=>setDescription(e.target.value)} className="min-h-20 rounded-md border border-input bg-background p-3 text-sm"/></Field><div className="self-end"><Button disabled={busy||!title.trim()||!start} onClick={()=>void create()}>{busy?"Salvando…":"Adicionar evento"}</Button></div></div><div className="mt-5 space-y-2">{(events.data??[]).map(e=><div key={e.id} className="rounded-xl border border-border p-3"><b>{e.title}</b><p className="text-xs text-muted-foreground">{new Date(e.start_at).toLocaleString("pt-BR")} · {e.classroom_name||"Todas as turmas"} · {e.event_type}</p></div>)}</div></Card>;
}

function Communication({d}:{d:ReturnType<typeof useData>}){
  const [classroom,setClassroom]=useState("");const [title,setTitle]=useState("");const [content,setContent]=useState("");const [busy,setBusy]=useState(false);const notices=useQuery({queryKey:["teacher-new-notices"],queryFn:loadTeacherAnnouncements,staleTime:15000});
  async function create(){setBusy(true);try{await createTeacherAnnouncement({classroom,title:title.trim(),content});setTitle("");setContent("");await notices.refetch();toast.success("Aviso publicado.");}catch(e){toast.error(errorText(e))}finally{setBusy(false)}}
  return <Card title="Comunicação" description="Publique avisos apenas para suas turmas."><div className="grid gap-3"><Select label="Turma" value={classroom} onChange={setClassroom}><option value="">Selecione</option>{(d.classes.data??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</Select><Field label="Título"><Input value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Mensagem"><textarea value={content} onChange={e=>setContent(e.target.value)} className="min-h-28 rounded-md border border-input bg-background p-3 text-sm"/></Field><div><Button disabled={busy||!classroom||!title.trim()} onClick={()=>void create()}>{busy?"Publicando…":"Publicar aviso"}</Button></div></div><div className="mt-5 space-y-2">{(notices.data??[]).map(n=><div key={n.id} className="rounded-xl border border-border p-3"><b>{n.title}</b><p className="text-xs text-muted-foreground">{n.classroom}</p><p className="mt-1 text-sm text-muted-foreground">{n.content}</p></div>)}</div></Card>;
}

export function TeacherWorkspace({initialSection="inicio"}:{initialSection?:Section}){
  const [section,setSection]=useState<Section>(initialSection);const d=useData();const current=menu.find(x=>x.id===section)??menu[0];
  const body=section==="inicio"?<Overview d={d}/>:section==="turmas"?<Classes d={d}/>:section==="alunos"?<Students d={d}/>:section==="disciplinas"?<Subjects d={d}/>:section==="notas"?<Grades d={d}/>:section==="frequencia"?<Attendance d={d}/>:section==="avaliacoes"?<Assessments d={d}/>:section==="atividades"?<Tasks d={d}/>:section==="agenda"?<Agenda d={d}/>:<Communication d={d}/>;
  return <AcademicShell title={current.label} subtitle="Gestão acadêmica docente" requiredRole="teacher"><div className="space-y-5"><nav className="flex gap-2 overflow-x-auto pb-1">{menu.map(item=>{const Icon=item.Icon;return <button key={item.id} type="button" onClick={()=>setSection(item.id)} className={"inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold "+(item.id===section?"bg-primary text-primary-foreground":"border border-border bg-card text-muted-foreground hover:text-foreground")}><Icon className="size-4"/>{item.label}</button>})}</nav>{body}</div></AcademicShell>;
}
