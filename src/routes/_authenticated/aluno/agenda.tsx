import { createFileRoute } from "@tanstack/react-router";
import { StudentModulePage } from "@/components/student-module-page";
export const Route = createFileRoute("/_authenticated/aluno/agenda")({
  head: () => ({ meta: [{ title: "Agenda — SINA" }] }),
  component: () => <StudentModulePage module="agenda" />,
});
