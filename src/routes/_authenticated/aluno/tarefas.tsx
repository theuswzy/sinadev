import { createFileRoute } from "@tanstack/react-router";
import { StudentModulePage } from "@/components/student-module-page";
export const Route = createFileRoute("/_authenticated/aluno/tarefas")({
  head: () => ({ meta: [{ title: "Tarefas — SINA" }] }),
  component: () => <StudentModulePage module="tarefas" />,
});
