import { createFileRoute } from "@tanstack/react-router";
import { TeacherModulePage } from "@/components/teacher-module-page";

export const Route = createFileRoute("/_authenticated/professor/disciplinas")({
  head: () => ({ meta: [{ title: "Disciplinas — SINA" }, { name: "description", content: "Crie e organize as disciplinas do professor." }] }),
  component: () => <TeacherModulePage module="disciplinas" />,
});
