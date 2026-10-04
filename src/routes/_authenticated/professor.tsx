import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";

export const Route = createFileRoute("/_authenticated/professor")({
  head: () => ({ meta: [{ title: "Professor — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="inicio" />,
});
