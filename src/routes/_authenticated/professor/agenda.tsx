import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";
export const Route = createFileRoute("/_authenticated/professor/agenda")({
  head: () => ({ meta: [{ title: "Agenda — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="agenda" />,
});