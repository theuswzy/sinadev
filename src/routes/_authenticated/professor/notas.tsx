import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({ meta: [{ title: "Notas — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="notas" />,
});
