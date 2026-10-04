import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";
export const Route = createFileRoute("/_authenticated/professor/atividades")({
  head: () => ({ meta: [{ title: "Atividades — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="atividades" />,
});