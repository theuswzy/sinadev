import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/apresentacao")({
  beforeLoad: () => { throw redirect({ to: "/", replace: true }); },
  head: () => ({ meta: [
    { title: "Conheça o SINA — Acompanhamento acadêmico" },
    { name: "description", content: "Conheça o SINA, o sistema digital para acompanhamento acadêmico." },
    { property: "og:title", content: "Conheça o SINA — Acompanhamento acadêmico" },
    { property: "og:description", content: "Acompanhe notas e frequência com o SINA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});