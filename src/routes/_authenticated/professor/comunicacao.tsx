import { createFileRoute } from "@tanstack/react-router";
import { TeacherWorkspace } from "@/components/teacher-workspace";
export const Route = createFileRoute("/_authenticated/professor/comunicacao")({
  head: () => ({ meta: [{ title: "Comunicação — SINA" }] }),
  component: () => <TeacherWorkspace initialSection="comunicacao" />,
});