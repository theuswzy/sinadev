import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";

export const Route = createFileRoute("/_authenticated/frequencia")({
  head: () => ({ meta: [{ title: "Frequencia — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="frequencia" />,
});
