import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText, loadAdminAcademicSetup } from "@/lib/sina-data";
import { adminDeleteClassroomTimetable, adminUpsertClassroomTimetable, loadAdminClassroomTimetable, type ClassroomTimetableEntry } from "@/lib/timetable-data";

const weekdays = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
];

const emptyForm = { classroomSubjectId: "", weekday: "1", startTime: "07:00", endTime: "07:50", room: "", notes: "" };

export function AdminClassroomTimetable() {
  const qc = useQueryClient();
  const setup = useQuery({ queryKey: ["admin-academic-setup"], queryFn: loadAdminAcademicSetup });
  const classrooms = (setup.data?.classrooms ?? []).filter(item => item.status === "active");
  const [classroomId, setClassroomId] = useState("");
  const [editing, setEditing] = useState<ClassroomTimetableEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!classroomId && classrooms[0]?.id) setClassroomId(classrooms[0].id);
  }, [classroomId, classrooms]);

  const timetable = useQuery({
    queryKey: ["admin-classroom-timetable", classroomId],
    queryFn: () => loadAdminClassroomTimetable(classroomId),
    enabled: !!classroomId,
    refetchOnWindowFocus: true,
  });
  const subjects = (setup.data?.matrix ?? []).filter(item => item.classroom_id === classroomId && item.classroom_subject_id && item.classroom_status === "active");

  function resetForm() {
    setEditing(null);
    setForm({ ...emptyForm, classroomSubjectId: subjects[0]?.classroom_subject_id ?? "" });
  }

  function startEdit(item: ClassroomTimetableEntry) {
    setEditing(item);
    setForm({
      classroomSubjectId: item.classroom_subject_id,
      weekday: String(item.weekday),
      startTime: item.start_time.slice(0, 5),
      endTime: item.end_time.slice(0, 5),
      room: item.room ?? "",
      notes: item.notes ?? "",
    });
  }

  async function save() {
    if (!classroomId || !form.classroomSubjectId) {
      toast.error("Selecione a turma e uma disciplina vinculada a ela.");
      return;
    }
    if (!form.startTime || !form.endTime || form.endTime <= form.startTime) {
      toast.error("O horário final precisa ser posterior ao horário inicial.");
      return;
    }
    setBusy(true);
    try {
      await adminUpsertClassroomTimetable({
        id: editing?.id ?? null,
        classroomId,
        classroomSubjectId: form.classroomSubjectId,
        weekday: Number(form.weekday),
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room.trim(),
        notes: form.notes.trim(),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-classroom-timetable", classroomId] }),
        qc.invalidateQueries({ queryKey: ["student-module-timetable"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-timetable"] }),
      ]);
      toast.success(editing ? "Horário atualizado." : "Horário cadastrado.");
      resetForm();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: ClassroomTimetableEntry) {
    if (!window.confirm(`Excluir o horário de ${item.subject_name} em ${weekdays.find(day => day.value === item.weekday)?.label ?? "dia não informado"}?`)) return;
    setBusy(true);
    try {
      await adminDeleteClassroomTimetable(item.id);
      await qc.invalidateQueries({ queryKey: ["admin-classroom-timetable", classroomId] });
      await qc.invalidateQueries({ queryKey: ["student-module-timetable"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-timetable"] });
      if (editing?.id === item.id) resetForm();
      toast.success("Horário excluído.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sina-card mt-6 scroll-mt-28 p-5 sm:p-6" id="cronograma-aulas">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 size-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Cronograma de aulas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre os horários por turma. Os alunos verão automaticamente os dias, disciplinas, professores e salas no painel.</p>
        </div>
      </div>

      {setup.isPending ? <p className="mt-5 text-sm text-muted-foreground">Carregando turmas e disciplinas…</p> :
        setup.error ? <p className="mt-5 text-sm text-destructive">{errorText(setup.error)}</p> :
        <div className="mt-5 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="timetable-classroom">Turma</label>
            <select id="timetable-classroom" value={classroomId} onChange={e => { setClassroomId(e.target.value); setEditing(null); setForm(emptyForm); }} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
              <option value="">Selecione uma turma</option>
              {classrooms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          {classroomId && <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="font-semibold">{editing ? "Editar horário" : "Adicionar horário"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Escolha uma disciplina que já esteja vinculada à turma selecionada.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="timetable-subject">Disciplina</label>
              <select id="timetable-subject" value={form.classroomSubjectId} onChange={e => setForm(f => ({ ...f, classroomSubjectId: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Selecione a disciplina</option>
                {subjects.map(item => <option key={item.classroom_subject_id} value={item.classroom_subject_id!}>{item.subject_name}{item.teacher_name ? ` — ${item.teacher_name}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="timetable-weekday">Dia da semana</label>
              <select id="timetable-weekday" value={form.weekday} onChange={e => setForm(f => ({ ...f, weekday: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                {weekdays.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="timetable-start">Início</label>
              <Input id="timetable-start" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="timetable-end">Término</label>
              <Input id="timetable-end" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="timetable-room">Sala (opcional)</label>
              <Input id="timetable-room" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="Ex.: Sala 04" maxLength={80} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="timetable-notes">Observação (opcional)</label>
              <Input id="timetable-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex.: trazer material" maxLength={240} />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button onClick={() => void save()} disabled={busy || !form.classroomSubjectId}>{busy ? "Salvando…" : editing ? "Salvar alterações" : <><Plus className="mr-2 size-4" /> Cadastrar horário</>}</Button>
              {editing && <Button type="button" variant="outline" onClick={resetForm} disabled={busy}>Cancelar edição</Button>}
            </div>
            {!subjects.length && <p className="text-sm text-amber-700 dark:text-amber-300 md:col-span-2">Esta turma ainda não tem disciplinas vinculadas. Vincule uma disciplina antes de cadastrar horários.</p>}
          </div>}

          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            <div className="border-b border-border bg-muted/30 px-4 py-3"><h3 className="font-semibold">Grade semanal de aulas</h3><p className="mt-1 text-xs text-muted-foreground">Visualize e edite cada aula diretamente na grade.</p></div>
            {timetable.isPending && classroomId && <p className="p-4 text-sm text-muted-foreground">Carregando horários…</p>}
            {timetable.error && <div className="p-4 text-sm text-destructive">{errorText(timetable.error)} <Button size="sm" variant="outline" className="ml-2" onClick={() => void timetable.refetch()}>Tentar novamente</Button></div>}
            {!classroomId && <p className="p-4 text-sm text-muted-foreground">Selecione uma turma para consultar o cronograma.</p>}
            {classroomId && !timetable.isPending && !timetable.error && !(timetable.data ?? []).length && <p className="p-4 text-sm text-muted-foreground">Nenhum horário cadastrado para esta turma.</p>}
            {!!timetable.data?.length && <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[100px_repeat(5,minmax(145px,1fr))] border-b border-border bg-muted/40">
                  <div className="flex items-center px-3 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Horário</div>
                  {weekdays.map(day => <div key={day.value} className="border-l border-border px-3 py-3 text-center text-sm font-bold">{day.label.replace("-feira", "")}</div>)}
                </div>
                {Array.from(new Set((timetable.data ?? []).map(item => item.start_time.slice(0, 5)))).sort((a, b) => a.localeCompare(b)).map(start => {
                  const rowItems = (timetable.data ?? []).filter(item => item.start_time.slice(0, 5) === start);
                  const end = rowItems.map(item => item.end_time.slice(0, 5)).sort().at(-1) ?? "";
                  return <div key={start} className="grid grid-cols-[100px_repeat(5,minmax(145px,1fr))] border-b border-border last:border-b-0">
                    <div className="flex flex-col justify-center bg-muted/20 px-3 py-3"><span className="text-sm font-bold tabular-nums">{start}</span><span className="mt-1 text-[11px] text-muted-foreground tabular-nums">até {end}</span></div>
                    {weekdays.map(day => {
                      const items = rowItems.filter(item => item.weekday === day.value);
                      return <div key={day.value} className="min-h-[112px] border-l border-border p-2">
                        {items.length ? <div className="space-y-2">{items.map(item => <article key={item.id} className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3 shadow-sm">
                          <p className="text-[11px] font-semibold tabular-nums text-primary">{item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}</p>
                          <p className="mt-1 break-words text-sm font-bold leading-snug">{item.subject_name}</p>
                          <p className="mt-1 break-words text-xs text-muted-foreground">{item.teacher_name || "Professor não informado"}</p>
                          {item.room && <p className="mt-1 text-xs text-muted-foreground">Sala {item.room}</p>}
                          {item.notes && <p className="mt-1 break-words text-[11px] text-muted-foreground">{item.notes}</p>}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => startEdit(item)}><Pencil className="mr-1 size-3" />Editar</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" disabled={busy} onClick={() => void remove(item)}><Trash2 className="mr-1 size-3" />Excluir</Button>
                          </div>
                        </article>)}</div> : <div className="flex min-h-[90px] items-center justify-center rounded-lg border border-dashed border-border/70"><span className="text-[11px] text-muted-foreground/70">—</span></div>}
                      </div>;
                    })}
                  </div>;
                })}
              </div>
            </div>}
          </div>
        </div>}
    </section>
  );
}
