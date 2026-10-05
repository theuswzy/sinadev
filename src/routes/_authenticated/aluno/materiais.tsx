import { createFileRoute } from "@tanstack/react-router";
import { StudentModulePage } from "@/components/student-module-page";

export const Route = createFileRoute("/_authenticated/aluno/materiais")({
  head: () => ({ meta: [{ title: "Materiais — SINA" }] }),
  component: () => <StudentModulePage module="materiais" />,
});
