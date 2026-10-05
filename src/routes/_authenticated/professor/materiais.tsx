import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";

export const Route = createFileRoute("/_authenticated/professor/materiais")({
  head: () => ({ meta: [{ title: "Materiais — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="materiais" />,
});
