import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";

export const Route = createFileRoute("/_authenticated/avaliacoes")({
  head: () => ({ meta: [{ title: "Avaliacoes — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="avaliacoes" />,
});
