import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";

export const Route = createFileRoute("/_authenticated/turmas")({
  head: () => ({ meta: [{ title: "Turmas — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="turmas" />,
});
