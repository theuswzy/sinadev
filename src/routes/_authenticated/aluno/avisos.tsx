import { createFileRoute } from "@tanstack/react-router";
import { StudentModulePage } from "@/components/student-module-page";
export const Route = createFileRoute("/_authenticated/aluno/avisos")({
  head: () => ({ meta: [{ title: "Avisos — SINA" }] }),
  component: () => <StudentModulePage module="avisos" />,
});
