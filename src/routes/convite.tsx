import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/convite")({
  head: () => ({
    meta: [
      { title: "Convite institucional — SINA" },
      { name: "description", content: "Aceite seu convite para uma instituição no SINA." },
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
        <h1 className="text-xl font-semibold">Convite institucional</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button className="mt-5" onClick={() => void navigate({ to: "/auth", replace: true })}>Ir para o acesso</Button>
      </section>
    </main>
  );
}
