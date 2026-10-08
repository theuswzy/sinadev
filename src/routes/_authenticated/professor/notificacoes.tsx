import { createFileRoute } from "@tanstack/react-router";
import { TeacherNotifications } from "@/components/teacher-notifications";

export const Route = createFileRoute("/_authenticated/professor/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — Professor — SINA" }] }),
  component: TeacherNotifications,
});
