import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";

export const Route = createFileRoute("/_authenticated/professor/alunos")({
  head: () => ({ meta: [{ title: "Alunos — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="alunos" />,
});
