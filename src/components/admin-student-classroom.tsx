import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText, loadAdminAcademicSetup, loadAdminStudents, adminAssignStudentToClassroom, adminRemoveStudentFromClassroom } from "@/lib/sina-data";

export function AdminStudentClassroom() {
  const qc=useQueryClient();
  const students=useQuery({queryKey:["admin-students"],queryFn:loadAdminStudents});
  const setup=useQuery({queryKey:["admin-academic-setup"],queryFn:loadAdminAcademicSetup});
  const [selected,setSelected]=useState<Record<string,string>>({});
  const [enrollments,setEnrollments]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);
  async function assign(id:string){
    const classroomId=selected[id]; if(!classroomId)return;
    setBusy(id); try{await adminAssignStudentToClassroom(id,classroomId,enrollments[id]??""); await qc.invalidateQueries({queryKey:["admin-students"]}); toast.success("Aluno vinculado à turma.");}catch(e){toast.error(errorText(e));}finally{setBusy(null);}
  }
  async function remove(id:string){
    setBusy(id); try{await adminRemoveStudentFromClassroom(id); await qc.invalidateQueries({queryKey:["admin-students"]}); toast.success("Aluno retirado da turma.");}catch(e){toast.error(errorText(e));}finally{setBusy(null);}
  }
  const classes=(setup.data?.classrooms??[]).filter(c=>c.status==="active");
  return <section className="sina-card sina-card-hover p-6">
    <div><h2 className="font-semibold">Alunos e turmas</h2><p className="mt-1 text-sm text-muted-foreground">Matricule cada aluno em uma turma. Depois o professor consegue lançar notas, frequência, atividades e avaliações.</p></div>
    {students.isPending?<p className="mt-5 text-sm text-muted-foreground">Carregando alunos…</p>:students.error?<p className="mt-5 text-sm text-destructive">{errorText(students.error)}</p>:<div className="mt-5 space-y-3">
      {(students.data??[]).map(s=><div key={s.id} className="rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{s.full_name}</p><p className="text-xs text-muted-foreground">{s.enrollment||"Sem matrícula"} · {s.classroom_name||"Sem turma"}</p></div>{s.classroom_id&&<Button size="sm" variant="ghost" onClick={()=>void remove(s.id)} disabled={busy===s.id}>Retirar da turma</Button>}</div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_auto]">
          <select value={selected[s.id]??s.classroom_id??""} onChange={e=>setSelected(v=>({...v,[s.id]:e.target.value}))} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione uma turma</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <Input value={enrollments[s.id]??s.enrollment??""} onChange={e=>setEnrollments(v=>({...v,[s.id]:e.target.value}))} placeholder="Matrícula"/>
          <Button onClick={()=>void assign(s.id)} disabled={busy===s.id||!selected[s.id]}>{busy===s.id?"Salvando…":s.classroom_id?"Trocar turma":"Matricular"}</Button>
        </div>
      </div>)}
      {!students.data?.length&&<p className="text-sm text-muted-foreground">Nenhum perfil de aluno aprovado nesta instituição ainda.</p>}
    </div>}
  </section>;
}
