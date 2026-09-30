import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getRole, routeForRole } from "@/lib/sina-data";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — SINA" },
      { name: "description", content: "Entrada para a área acadêmica do SINA." },
    ],
  }),
  component: PanelRedirect,
});

function PanelRedirect() {
  const navigate = useNavigate();
  const account = useQuery({ queryKey: ["my-role"], queryFn: getRole });

  if (account.data) {
    void navigate({ to: routeForRole(account.data), replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">SINA</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {account.error ? "Não foi possível identificar sua área." : "Abrindo sua área acadêmica…"}
        </p>
      </div>
    </div>
  );
}
