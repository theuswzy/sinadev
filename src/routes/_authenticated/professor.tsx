import { createFileRoute } from "@tanstack/react-router";
import { TeacherDashboard } from "@/components/teacher-module-page";
export const Route = createFileRoute("/_authenticated/professor")({
  head: () => ({ meta: [{ title: "Dashboard do professor — SINA" }, { name: "description", content: "Visão geral da atividade docente." }] }),
  component: TeacherDashboard,
});