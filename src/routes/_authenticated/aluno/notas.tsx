import { createFileRoute } from "@tanstack/react-router";
import { StudentModulePage } from "@/components/student-module-page";
export const Route = createFileRoute("/_authenticated/aluno/notas")({
  head: () => ({ meta: [{ title: "Notas — SINA" }] }),
  component: () => <StudentModulePage module="notas" />,
});
