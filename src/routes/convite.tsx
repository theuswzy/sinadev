import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/convite")({
  head: () => ({
    meta: [
      { title: "Convite institucional — SINA" },
      { name: "description", content: "Aceite seu convite para uma instituição no SINA." },
      { property: "og:title", content: "Convite institucional — SINA" },
      { property: "og:description", content: "Acesse sua instituição com um convite do SINA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InvitationPage,
});

function InvitationPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Preparando seu convite…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token")?.trim();
    if (!token) {
      setMessage("Este link de convite está incompleto.");
      return;
    }
    localStorage.setItem("sina-institution-invite-token", token);
    setMessage("Convite guardado. Entre ou crie sua conta com o mesmo e-mail que recebeu o convite.");
    const timer = window.setTimeout(() => {
      void navigate({ to: "/auth", replace: true });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="sina-card w-full max-w-md p-6 text-center">
        <p className="mb-4 font-display text-2xl font-bold">SINA</p>
        <h1 className="text-xl font-semibold">Convite institucional</h1>
        <p role="status" className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button className="mt-5" onClick={() => void navigate({ to: "/auth", replace: true })}>Ir para o acesso</Button>
      </section>
    </main>
  );
}
