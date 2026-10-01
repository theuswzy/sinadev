import { createFileRoute } from "@tanstack/react-router";
import { StudentModulePage } from "@/components/student-module-page";
export const Route = createFileRoute("/_authenticated/aluno/disciplinas")({
  head: () => ({ meta: [{ title: "Disciplinas — SINA" }] }),
  component: () => <StudentModulePage module="disciplinas" />,
});
