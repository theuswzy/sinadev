import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";
export const Route = createFileRoute("/_authenticated/professor/frequencia")({
  head: () => ({ meta: [{ title: "Frequência — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="frequencia" />,
});