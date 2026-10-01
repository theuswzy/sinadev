import { createFileRoute } from "@tanstack/react-router";
import { StudentModulePage } from "@/components/student-module-page";
export const Route = createFileRoute("/_authenticated/aluno/frequencia")({
  head: () => ({ meta: [{ title: "Frequencia — SINA" }] }),
  component: () => <StudentModulePage module="frequencia" />,
});
