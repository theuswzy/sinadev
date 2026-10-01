import { createFileRoute } from "@tanstack/react-router";
import { TeacherModulePage } from "@/components/teacher-module-page";
export const Route = createFileRoute("/_authenticated/professor/comunicacao")({ component:()=> <TeacherModulePage module="comunicacao"/> });