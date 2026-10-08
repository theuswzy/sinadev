import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, ChevronRight, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import {
  errorText,
  loadTeacherNotifications,
  markAllTeacherNotificationsRead,
  markTeacherNotificationRead,
} from "@/lib/sina-data";
import { toast } from "sonner";

export function TeacherNotifications() {
  const notifications = useQuery({
    queryKey: ["teacher-notifications-center"],
    queryFn: () => loadTeacherNotifications(false),
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  async function read(id: string) {
    try {
      await markTeacherNotificationRead(id);
      await notifications.refetch();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function readAll() {
    try {
      const count = await markAllTeacherNotificationsRead();
      await notifications.refetch();
      toast.success(count ? `${count} notificação(ões) marcada(s) como lida(s).` : "Não havia notificações pendentes.");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  const unread = (notifications.data ?? []).filter((item) => !item.read_at).length;

  return (
    <AcademicShell title="Notificações" subtitle="Entregas e acontecimentos que exigem sua atenção">
      <section className="mt-6 space-y-5">
        <div className="flex flex-col gap-3 rounded-3xl bg-brand p-6 text-brand-foreground sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-muted">Central do professor</p>
            <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Acompanhe o que aconteceu sem abrir atividade por atividade.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">Novas entregas e entregas em atraso aparecem aqui, com acesso direto para a área de Atividades.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-brand-border bg-brand-panel/70 px-3 py-2 text-xs font-semibold">{unread} não lida{unread === 1 ? "" : "s"}</span>
            <Button variant="outline" onClick={() => void readAll()} disabled={!unread} className="border-brand-border bg-transparent text-brand-foreground hover:bg-brand-panel">
              <CheckCheck className="mr-2 size-4" /> Marcar todas
            </Button>
          </div>
        </div>

        {notifications.isPending && <div className="sina-card p-6 text-sm text-muted-foreground">Carregando notificações…</div>}

        {notifications.error && (
          <div className="sina-card p-6">
            <p className="text-sm text-destructive">{errorText(notifications.error)}</p>
            <Button className="mt-4" variant="outline" onClick={() => void notifications.refetch()}>Tentar novamente</Button>
          </div>
        )}

        {!notifications.isPending && !notifications.error && !(notifications.data ?? []).length && (
          <div className="sina-card p-10 text-center">
            <Bell className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Tudo em dia</h2>
            <p className="mt-1 text-sm text-muted-foreground">Nenhuma nova ocorrência chegou para sua conta.</p>
            <Link to="/professor/atividades" className="mt-4 inline-flex items-center text-sm font-semibold text-primary">
              <ClipboardList className="mr-1.5 size-4" /> Abrir atividades
            </Link>
          </div>
        )}

        {(notifications.data ?? []).map((item) => (
          <article key={item.id} className={item.read_at ? "sina-card p-5" : "sina-card border-primary/30 bg-primary/5 p-5"}>
            <div className="flex gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{item.type} · {new Date(item.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  {!item.read_at && <span className="w-fit rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">Nova</span>}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!item.read_at && <Button size="sm" variant="outline" onClick={() => void read(item.id)}>Marcar como lida</Button>}
                  {item.link && (
                    <a
                      href={item.link}
                      onClick={() => { if (!item.read_at) void read(item.id); }}
                      className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
                    >
                      Abrir relacionado <ChevronRight className="ml-1 size-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </AcademicShell>
  );
}
