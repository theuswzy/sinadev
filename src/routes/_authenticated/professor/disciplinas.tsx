import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";
export const Route = createFileRoute("/_authenticated/professor/disciplinas")({
  head: () => ({ meta: [{ title: "Disciplinas — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="disciplinas" />,
});