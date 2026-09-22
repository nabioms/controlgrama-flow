import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CalendarClock, Landmark, PiggyBank, Users, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, ProgressBar, SectionTitle, StatCard } from "@/components/ui-kit";
import { useStore } from "@/lib/store";

import { brl, daysUntil, formatDate, formatLongDate, toISO } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — ControlGrama" },
      {
        name: "description",
        content: "Visão do dia: presença, próxima data de pagamento de diárias, contas a receber da prefeitura e saldo de caixa.",
      },
      { property: "og:title", content: "Painel — ControlGrama" },
      { property: "og:description", content: "Equipe, ponto, diárias e financeiro da sua operação de roçagem." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { workers, teams, attendance, receivables, payables, nextPayDate, cashBalance, contracts, workerDocuments, serviceOrders } = useStore();
  const today = toISO(new Date());
  const month = today.slice(0, 7);
  const closureDate = (() => { const d = new Date(`${nextPayDate.date}T12:00:00`); d.setDate(d.getDate() - 1); return toISO(d); })();

  const active = workers.filter((w) => w.status === "ativo");
  const diaristas = active.filter((w) => w.employment_type === "diarista");
  const clt = active.filter((w) => w.employment_type === "contratado");
  const activeTeams = teams.filter((t) => t.active);

  const dayRows = attendance.filter((a) => a.date === today);
  const presentToday = dayRows.filter((a) => a.status === "presente").length;

  const nextPaymentStart = (() => {
    const payDate = new Date(`${nextPayDate.date}T12:00:00`);
    const payYear = payDate.getFullYear();
    const payMonth = payDate.getMonth() + 1;
    const currentMonthFifth = (() => {
      let count = 0;
      const lastDay = new Date(payYear, payMonth, 0).getDate();
      for (let day = 1; day <= lastDay; day += 1) {
        const weekday = new Date(payYear, payMonth - 1, day).getDay();
        if (weekday === 0 || weekday === 6) continue;
        count += 1;
        if (count === 5) return `${payYear}-${String(payMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
      return nextPayDate.date;
    })();

    if (nextPayDate.label.includes("Dia 20")) {
      return `${payYear}-${String(payMonth).padStart(2, "0")}-${String(currentMonthFifth.slice(8, 10)).padStart(2, "0")}`;
    }

    if (nextPayDate.date.slice(0, 7) === month) {
      const previousMonthDate = new Date(payYear, payMonth - 2, 21);
      return toISO(previousMonthDate);
    }

    const currentMonthDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 20);
    return toISO(currentMonthDate);
  })();

  const estimated = diaristas.reduce((sum, w) => {
    const worked = attendance
      .filter(
        (a) =>
          a.worker_id === w.id &&
          a.status === "presente" &&
          a.date >= nextPaymentStart &&
          a.date < nextPayDate.date,
      )
      .reduce((days, a) => days + Number(a.work_fraction ?? 1), 0);

    return sum + worked * (w.daily_rate ?? 0);
  }, 0);

  const openReceivables = receivables.filter((r) => r.status === "pendente");
  const monthPayables = payables.filter((p) => p.status === "pendente" && p.due_date.startsWith(month));
  const monthProduction = serviceOrders.filter((o) => o.service_date.startsWith(month) && o.status === "realizada").reduce((sum,o)=>sum+Number(o.realized_amount),0);
  const todayProduction = serviceOrders.filter((o) => o.service_date === today && o.status === "realizada").reduce((sum,o)=>sum+Number(o.realized_amount),0);

  const docAlerts = workerDocuments
    .filter((d) => d.expires_at && daysUntil(d.expires_at) <= 45)
    .map((d) => ({
      ...d,
      worker: workers.find((w) => w.id === d.worker_id)?.full_name ?? "—",
      days: daysUntil(d.expires_at!),
    }));

  const vacationAlerts = active
    .filter((w) => w.vacation && daysUntil(w.vacation.due_date) <= 60)
    .map((w) => ({ name: w.full_name, date: w.vacation!.due_date }));

  const recurrentAbsences = active
    .map((w) => ({
      name: w.full_name,
      count: attendance.filter((a) => a.worker_id === w.id && a.status === "falta" && a.date.startsWith(month)).length,
    }))
    .filter((r) => r.count >= 2);

  return (
    <AppShell title="Painel geral" subtitle={formatLongDate(today)}>
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <StatCard label="Produção hoje" value={brl(todayProduction)} sub="O.S. realizadas" tone="success" icon={<ClipboardList className="size-4" />} />
        <StatCard label="Produção no mês" value={brl(monthProduction)} sub="O.S. realizadas" tone="info" icon={<ClipboardList className="size-4" />} />
        <StatCard
          label="Equipe ativa"
          value={String(activeTeams.length)}
          sub={`${active.length} trabalhadores · ${diaristas.length} diaristas · ${clt.length} CLT`}
          tone="primary"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Presença hoje"
          value={`${presentToday}/${active.length}`}
          sub={dayRows.length ? "Chamada iniciada" : "Chamada não feita"}
          tone={dayRows.length ? "success" : "warning"}
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Saldo de caixa"
          value={brl(cashBalance)}
          sub="Saldo real consolidado"
          tone="success"
          icon={<PiggyBank className="size-4" />}
        />
        <StatCard
          label="A receber (prefeitura)"
          value={brl(openReceivables.reduce((s, r) => s + r.expected_amount, 0))}
          sub={`${openReceivables.length} medições em aberto`}
          tone="info"
          icon={<Landmark className="size-4" />}
        />
      </div>

      <Card className="mb-4 grass-gradient border-none">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Próximo pagamento de diárias
            </p>
            <p className="font-display mt-1 text-2xl font-semibold">{brl(estimated)}</p>
            <p className="mt-0.5 text-xs opacity-85">
              {nextPayDate.label} · {formatDate(nextPayDate.date)}
            </p>
            <p className="mt-0.5 text-[11px] opacity-75">
              Fechamento · {formatDate(closureDate)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-3 py-2 text-center">
            <p className="font-display text-2xl font-semibold">{nextPayDate.days}</p>
            <p className="text-[10px] font-semibold uppercase">dias</p>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={100 - Math.min(100, nextPayDate.days * 6)} />
        </div>
        <Link to="/diarias" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">
          Abrir fechamento <ArrowRight className="size-3.5" />
        </Link>
      </Card>

      <Card className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produção</p><p className="font-display mt-1 text-2xl font-semibold">{brl(monthProduction)}</p><p className="text-xs text-muted-foreground">Somente O.S. marcadas como realizadas neste mês.</p></div>
          <Link to="/os" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">Abrir O.S. <ArrowRight className="size-3.5" /></Link>
        </div>
      </Card>

      <SectionTitle title="Contas a pagar do mês" hint={`${monthPayables.length} em aberto`} />
      <div className="mb-5 space-y-2">
        {monthPayables.slice(0, 4).map((p) => (
          <div key={p.id} className="card-surface flex items-center justify-between p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{p.description}</p>
              <p className="text-xs text-muted-foreground">vence {formatDate(p.due_date)}</p>
            </div>
            <span className="text-sm font-semibold">{brl(p.amount)}</span>
          </div>
        ))}
      </div>

      <SectionTitle title="Alertas" hint="Documentos, faltas e prazos" />
      <div className="space-y-2">
        {docAlerts.map((d) => (
          <div key={d.id} className="card-surface flex items-start gap-3 p-3">
            <AlertTriangle className="mt-0.5 size-4 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {d.kind.toUpperCase().replace("_", " ")} de {d.worker}
              </p>
              <p className="text-xs text-muted-foreground">
                {d.days < 0 ? "vencido" : `vence em ${d.days} dias`} · {formatDate(d.expires_at)}
              </p>
            </div>
            <Badge tone={d.days < 0 ? "danger" : "warning"}>{d.days < 0 ? "vencido" : "atenção"}</Badge>
          </div>
        ))}
        {vacationAlerts.map((v) => (
          <div key={v.name} className="card-surface flex items-center gap-3 p-3">
            <CalendarClock className="size-4 text-info" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Férias de {v.name}</p>
              <p className="text-xs text-muted-foreground">limite {formatDate(v.date)}</p>
            </div>
            <Badge tone="info">férias</Badge>
          </div>
        ))}
        {recurrentAbsences.map((r) => (
          <div key={r.name} className="card-surface flex items-center gap-3 p-3">
            <AlertTriangle className="size-4 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.count} faltas neste mês</p>
            </div>
            <Badge tone="danger">faltas</Badge>
          </div>
        ))}
      </div>

      <SectionTitle
        title="Contratos vigentes"
        hint="Rentabilidade por frente de serviço no financeiro"
        action={
          <Link to="/financeiro" className="text-xs font-semibold text-primary">
            Ver financeiro
          </Link>
        }
      />
      <div className="mt-3 space-y-2">
        {contracts.map((c) => (
          <div key={c.id} className="card-surface p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{c.number}</p>
              <Badge tone="primary">{c.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
            <p className="mt-1 text-xs font-semibold">{brl(c.total_value)} / 12 meses</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
