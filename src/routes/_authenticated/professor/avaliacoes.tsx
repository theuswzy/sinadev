import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";
export const Route = createFileRoute("/_authenticated/professor/avaliacoes")({
  head: () => ({ meta: [{ title: "Avaliações — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="avaliacoes" />,
});