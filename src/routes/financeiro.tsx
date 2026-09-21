import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, SectionTitle, Select, StatCard } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { cashFlowHistory, contracts, expenseCategories, invoices } from "@/lib/mock-data";
import { brl, formatDate, monthLabel, shortBrl, toISO } from "@/lib/format";
import type { ExpenseCategoryKey } from "@/lib/types";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — ControlGrama" },
      {
        name: "description",
        content: "Contas a receber da prefeitura, contas a pagar, fluxo de caixa, notas fiscais e DRE simplificado.",
      },
      { property: "og:title", content: "Financeiro — ControlGrama" },
      { property: "og:description", content: "Caixa, medições, despesas por categoria e resultado do mês." },
    ],
  }),
  component: FinanceiroPage,
});

const tabs = ["Resumo", "Receber", "Pagar", "Notas"] as const;

function FinanceiroPage() {
  const { receivables, payables, markReceived, markPayablePaid, addPayable, cashBalance } = useStore();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Resumo");
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "combustivel" as ExpenseCategoryKey,
    due_date: toISO(new Date()),
    contract_id: "",
  });

  const month = toISO(new Date()).slice(0, 7);
  const toReceive = receivables.filter((r) => r.status === "pendente");
  const toPay = payables.filter((p) => p.status === "pendente");
  const monthIn = receivables
    .filter((r) => r.status === "recebido" && r.expected_date.startsWith(month))
    .reduce((s, r) => s + r.expected_amount, 0);
  const monthOut = payables
    .filter((p) => p.status === "pago" && p.due_date.startsWith(month))
    .reduce((s, p) => s + p.amount, 0);

  const chartData = cashFlowHistory.map((c) => ({
    name: monthLabel(c.month),
    Entradas: c.inflow,
    Saídas: c.outflow,
    Resultado: c.inflow - c.outflow,
  }));

  const byCategory = expenseCategories.map((c) => ({
    ...c,
    total: payables.filter((p) => p.category === c.key).reduce((s, p) => s + p.amount, 0),
  }));

  const byContract = contracts.map((c) => {
    const revenue = receivables.filter((r) => r.contract_id === c.id).reduce((s, r) => s + r.expected_amount, 0);
    const cost = payables.filter((p) => p.contract_id === c.id).reduce((s, p) => s + p.amount, 0);
    return { contract: c, revenue, cost, result: revenue - cost };
  });

  const submit = () => {
    if (!form.description || !form.amount) return;
    addPayable({
      id: `pb-${Date.now()}`,
      description: form.description,
      category: form.category,
      supplier: null,
      amount: Number(form.amount),
      due_date: form.due_date,
      status: "pendente",
      paid_at: null,
      contract_id: form.contract_id || null,
      payment_period_id: null,
    });
    setForm({ ...form, description: "", amount: "" });
  };

  return (
    <AppShell title="Financeiro" subtitle="Caixa, medições e despesas">
      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Resumo" ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <StatCard label="Saldo atual" value={brl(cashBalance)} tone="success" />
            <StatCard label="A receber no mês" value={brl(toReceive.reduce((s, r) => s + r.expected_amount, 0))} tone="info" />
            <StatCard label="A pagar no mês" value={brl(toPay.reduce((s, p) => s + p.amount, 0))} tone="warning" />
            <StatCard
              label="Resultado do mês"
              value={brl(monthIn - monthOut)}
              sub="recebido - pago"
              tone={monthIn - monthOut >= 0 ? "success" : "danger"}
            />
          </div>

          <Card className="mb-4">
            <SectionTitle title="Fluxo de caixa mensal" hint="Entradas x saídas" />
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickFormatter={(v) => shortBrl(Number(v))} fontSize={10} tickLine={false} axisLine={false} width={52} />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Bar dataKey="Entradas" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Saídas" fill="var(--warning)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="mb-4">
            <SectionTitle title="Evolução do resultado" hint="DRE simplificado por mês" />
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickFormatter={(v) => shortBrl(Number(v))} fontSize={10} tickLine={false} axisLine={false} width={52} />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Line type="monotone" dataKey="Resultado" stroke="var(--primary-deep)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <SectionTitle title="Despesas por categoria" />
          <div className="mb-5 space-y-2">
            {byCategory.map((c) => (
              <div key={c.key} className="card-surface flex items-center justify-between p-3">
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="text-sm">{brl(c.total)}</p>
              </div>
            ))}
          </div>

          <SectionTitle title="Rentabilidade por contrato" hint="Centro de custo por frente de serviço" />
          <div className="space-y-2">
            {byContract.map((r) => (
              <div key={r.contract.id} className="card-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{r.contract.number}</p>
                  <Badge tone={r.result >= 0 ? "success" : "danger"}>{brl(r.result)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Receita {brl(r.revenue)} · Custo direto {brl(r.cost)}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "Receber" ? (
        <div className="space-y-2">
          {receivables.map((r) => {
            const c = contracts.find((x) => x.id === r.contract_id);
            return (
              <div key={r.id} className="card-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{c?.number}</p>
                    <p className="text-xs text-muted-foreground">
                      Medição {r.reference_period} · previsto {formatDate(r.expected_date)}
                    </p>
                    {r.commitment_note ? (
                      <p className="text-xs text-muted-foreground">Empenho {r.commitment_note}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{brl(r.expected_amount)}</p>
                    <Badge tone={r.status === "recebido" ? "success" : "warning"}>{r.status}</Badge>
                  </div>
                </div>
                {r.status === "pendente" ? (
                  <Button size="sm" className="mt-2.5 w-full" onClick={() => markReceived(r.id)}>
                    Registrar recebimento
                  </Button>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Recebido em {formatDate(r.received_at)}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "Pagar" ? (
        <>
          <Card className="mb-4 space-y-3">
            <SectionTitle title="Nova conta a pagar" />
            <Field label="Descrição">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Diesel S10" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor (R$)">
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </Field>
              <Field label="Vencimento">
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </Field>
              <Field label="Categoria">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategoryKey })}>
                  {expenseCategories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Centro de custo">
                <Select value={form.contract_id} onChange={(e) => setForm({ ...form, contract_id: e.target.value })}>
                  <option value="">Sem vínculo</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.number}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button className="w-full" onClick={submit}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </Card>

          <div className="space-y-2">
            {payables.map((p) => (
              <div key={p.id} className="card-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {expenseCategories.find((c) => c.key === p.category)?.label} · vence {formatDate(p.due_date)}
                      {p.supplier ? ` · ${p.supplier}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{brl(p.amount)}</p>
                    <Badge tone={p.status === "pago" ? "success" : "warning"}>{p.status}</Badge>
                  </div>
                </div>
                {p.status === "pendente" ? (
                  <Button size="sm" variant="soft" className="mt-2.5 w-full" onClick={() => markPayablePaid(p.id)}>
                    Marcar como paga
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "Notas" ? (
        <div className="space-y-2">
          {invoices.length === 0 ? <EmptyState text="Nenhuma nota registrada." /> : null}
          {invoices.map((n) => (
            <div key={n.id} className="card-surface flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-semibold">{n.number}</p>
                <p className="text-xs text-muted-foreground">
                  {contracts.find((c) => c.id === n.contract_id)?.number} · emitida {formatDate(n.issue_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{brl(n.amount)}</p>
                <Badge tone={n.status === "paga" ? "success" : n.status === "cancelada" ? "danger" : "info"}>
                  {n.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
