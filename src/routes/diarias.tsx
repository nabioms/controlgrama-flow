import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Banknote, Paperclip } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Badge, Button, Card, EmptyState, SectionTitle, Select } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { brl, formatDate, initials } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

export const Route = createFileRoute("/diarias")({
  head: () => ({
    meta: [
      { title: "Diárias e folha — ControlGrama" },
      {
        name: "description",
        content: "Fechamento de diárias no 5º dia útil e adiantamento no dia 20, com cálculo automático por dias trabalhados.",
      },
      { property: "og:title", content: "Diárias e folha — ControlGrama" },
      { property: "og:description", content: "Cálculo, fechamento e baixa de pagamentos de diaristas e CLT." },
    ],
  }),
  component: DiariasPage,
});

const methods: PaymentMethod[] = ["pix", "dinheiro", "transferencia"];

function DiariasPage() {
  const { paymentPeriods, payments, workers, closePeriod, markPaymentPaid, attendance } = useStore();
  const [periodId, setPeriodId] = useState<string>(paymentPeriods[0]?.id ?? "");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [month, setMonth] = useState("");

  useEffect(() => {
    const now = new Date();
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }, []);

  const monthlyAccrual = useMemo(() => {
    if (!month) return [];
    return workers
      .filter((w) => w.status !== "desligado" && w.employment_type === "diarista")
      .map((w) => {
        const workedDays = attendance
          .filter((a) => a.worker_id === w.id && a.status === "presente" && a.date.startsWith(month))
          .reduce((sum, a) => sum + Number(a.work_fraction ?? 1), 0);
        return {
          worker: w,
          workedDays,
          amount: Math.round(workedDays * (w.daily_rate ?? 0) * 100) / 100,
        };
      });
  }, [month, workers, attendance]);

  const monthlyTotal = monthlyAccrual.reduce((sum, r) => sum + r.amount, 0);

  const selectedPeriodId = periodId || paymentPeriods[0]?.id || "";
  const period = paymentPeriods.find((p) => p.id === selectedPeriodId);
  if (!period) {
    return (
      <AppShell title="Diárias e folha" subtitle="Fechamento e pagamentos">
        <Card className="mb-4">
          <p className="text-[11px] font-semibold uppercase text-primary-deep">Acumulado de diárias</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-semibold">{brl(monthlyTotal)}</p>
              <p className="text-xs text-muted-foreground">Presenças registradas no mês</p>
            </div>
            <Badge tone="warning">Período ainda não aberto</Badge>
          </div>
        </Card>

        <SectionTitle
          title="Acumulado por diarista"
          hint="Presença gera valor; falta, justificada e atestado geram R$ 0. Meio período vale 50% da diária."
        />
        {monthlyAccrual.length === 0 ? (
          <EmptyState text="Nenhum diarista ativo cadastrado." />
        ) : (
          <div className="space-y-2">
            {monthlyAccrual.map((r) => (
              <div key={r.worker.id} className="card-surface flex items-center gap-3 p-3">
                <Avatar text={initials(r.worker.full_name)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.worker.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.workedDays.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias × {brl(r.worker.daily_rate ?? 0)}
                  </p>
                </div>
                <p className="text-sm font-semibold">{brl(r.amount)}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          O valor fica apenas acumulado até o fechamento. Depois do fechamento vira pagamento pendente; só entra no caixa quando for marcado como pago.
        </p>
      </AppShell>
    );
  }
  const rows = payments.filter((p) => p.period_id === selectedPeriodId);
  const preview = workers
    .filter((w) => w.status !== "desligado")
    .map((w) => {
      const days = attendance
        .filter(
          (a) =>
            a.worker_id === w.id &&
            a.status === "presente" &&
            a.date >= period.start_date &&
            a.date <= period.end_date,
        )
        .reduce((sum, a) => sum + Number(a.work_fraction ?? 1), 0);
      const rate = w.employment_type === "diarista" ? (w.daily_rate ?? 0) : (w.salary ?? 0) / 30;
      return { worker: w, days, amount: Math.round(days * rate * 100) / 100 };
    })
    .filter((r) => r.days > 0);

  const total = (rows.length ? rows.map((r) => r.gross_amount) : preview.map((p) => p.amount)).reduce(
    (a, b) => a + b,
    0,
  );
  const pending = rows.filter((r) => r.status === "pendente");

  return (
    <AppShell title="Diárias e folha" subtitle="Dois ciclos de pagamento por mês">
      <Card className="mb-4 space-y-3">
        <Select value={selectedPeriodId} onChange={(e) => setPeriodId(e.target.value)}>
          {paymentPeriods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — paga em {formatDate(p.pay_date)}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Período</p>
            <p className="text-xs font-semibold">
              {formatDate(period.start_date)} a {formatDate(period.end_date)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Ciclo</p>
            <p className="text-xs font-semibold">
              {period.cycle === "quinto_dia_util" ? "5º dia útil" : "Dia 20"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Status</p>
            <Badge tone={period.status === "pago" ? "success" : period.status === "fechado" ? "warning" : "neutral"}>
              {period.status}
            </Badge>
          </div>
        </div>
        <div className="rounded-xl bg-primary-soft p-3">
          <p className="text-[11px] font-semibold uppercase text-primary-deep">Total do período</p>
          <p className="font-display text-2xl font-semibold text-primary-deep">{brl(total)}</p>
        </div>
        {period.status === "aberto" ? (
          <Button className="w-full" onClick={() => closePeriod(period.id)}>
            <Banknote className="size-4" /> Fechar período e gerar pagamentos
          </Button>
        ) : null}
      </Card>

      {rows.length > 0 ? (
        <>
          <SectionTitle
            title="Pagamentos"
            hint={`${pending.length} pendentes de ${rows.length}`}
            action={
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="w-auto py-1.5 text-xs">
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            }
          />
          <div className="space-y-2">
            {rows.map((p) => {
              const w = workers.find((x) => x.id === p.worker_id);
              return (
                <div key={p.id} className="card-surface p-3">
                  <div className="flex items-center gap-3">
                    <Avatar text={initials(w?.full_name ?? "?")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{w?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.worked_days} dias{p.daily_rate ? ` × ${brl(p.daily_rate)}` : " (proporcional CLT)"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{brl(p.gross_amount)}</p>
                      <Badge tone={p.status === "pago" ? "success" : "warning"}>{p.status}</Badge>
                    </div>
                  </div>
                  {p.status === "pendente" ? (
                    <div className="mt-2.5 flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => markPaymentPaid(p.id, method)}>
                        Marcar como pago ({method})
                      </Button>
                      <Button size="sm" variant="outline">
                        <Paperclip className="size-3.5" /> Comprovante
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Pago em {formatDate(p.paid_at)} · {p.method}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <SectionTitle title="Prévia do cálculo" hint="Dia integral = 1 diária · meio período = 0,5 diária" />
          {preview.length === 0 ? (
            <EmptyState text="Nenhum dia trabalhado registrado neste período." />
          ) : (
            <div className="space-y-2">
              {preview.map((r) => (
                <div key={r.worker.id} className="card-surface flex items-center gap-3 p-3">
                  <Avatar text={initials(r.worker.full_name)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.worker.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.days.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias ·{" "}
                      {r.worker.employment_type === "diarista"
                        ? brl(r.worker.daily_rate ?? 0) + "/dia"
                        : "CLT proporcional"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{brl(r.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
