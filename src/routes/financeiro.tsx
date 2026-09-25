import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Plus, Trash2, WalletCards } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, SectionTitle, Select, StatCard } from "@/components/ui-kit";
import { useStore } from "@/lib/store";

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

const tabs = ["Resumo", "Receber", "Pagar", "Ajuda de custo", "Notas"] as const;

function FinanceiroPage() {
  const { receivables, payables, payments, dailyAllowances, workers, attendance, markReceived, markPayablePaid, addPayable, addDailyAllowance, deleteDailyAllowance, cashBalance, cashFlowHistory, contracts, expenseCategories, invoices } = useStore();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Resumo");
  const [allowanceDate, setAllowanceDate] = useState(toISO(new Date()));
  const [allowanceAmount, setAllowanceAmount] = useState("20");
  const [allowanceMethod, setAllowanceMethod] = useState<"pix" | "dinheiro" | "transferencia">("dinheiro");
  const [selectedAllowanceWorkers, setSelectedAllowanceWorkers] = useState<string[]>([]);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "combustivel" as ExpenseCategoryKey,
    due_date: toISO(new Date()),
    contract_id: "",
  });

  const month = toISO(new Date()).slice(0, 7);
  const presentDiaristas = workers.filter((w) => w.status === "ativo" && w.employment_type === "diarista" && attendance.some((a) => a.worker_id === w.id && a.date === allowanceDate && a.status === "presente"));
  const paidAllowanceIds = new Set(dailyAllowances.filter((a) => a.date === allowanceDate).map((a) => a.worker_id));
  const monthAllowanceTotal = dailyAllowances.filter((a) => a.date.startsWith(month)).reduce((s, a) => s + Number(a.amount || 0), 0);
  const dayAllowanceTotal = dailyAllowances.filter((a) => a.date === allowanceDate).reduce((s, a) => s + Number(a.amount || 0), 0);
  const unpaidPresentDiaristas = presentDiaristas.filter((w) => !paidAllowanceIds.has(w.id));
  useEffect(() => {
    setSelectedAllowanceWorkers(unpaidPresentDiaristas.map((w) => w.id));
  }, [allowanceDate, dailyAllowances.length, attendance.length, workers.length]);
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

  // Mão de obra é calculada automaticamente pelas diárias/presenças do mês.
  // O cálculo segue a mesma regra usada no fechamento da folha:
  // diarista = dias trabalhados × diária; contratado = salário × dias/30.
  const automaticLabor = attendance
    .filter((a) => a.date.startsWith(month) && a.status === "presente")
    .reduce((total, a) => {
      const worker = workers.find((w) => w.id === a.worker_id);
      if (!worker || worker.status === "desligado") return total;
      const fraction = Number(a.work_fraction ?? 1);
      const amount =
        worker.employment_type === "diarista"
          ? fraction * Number(worker.daily_rate ?? 0)
          : (fraction * Number(worker.salary ?? 0)) / 30;
      return total + amount;
    }, 0);

  const manualLabor = payables
    .filter((p) => p.category === "mao_de_obra")
    .reduce((s, p) => s + p.amount, 0);

  const byCategory = expenseCategories.map((c) => ({
    ...c,
    total:
      c.key === "mao_de_obra"
        ? manualLabor + automaticLabor
        : payables.filter((p) => p.category === c.key).reduce((s, p) => s + p.amount, 0),
  }));

  const byContract = contracts.map((c) => {
    const revenue = receivables.filter((r) => r.contract_id === c.id).reduce((s, r) => s + r.expected_amount, 0);
    const cost = payables.filter((p) => p.contract_id === c.id).reduce((s, p) => s + p.amount, 0);
    return { contract: c, revenue, cost, result: revenue - cost };
  });

  const registerAllowances = async () => {
    const ids = selectedAllowanceWorkers.filter((id) => !paidAllowanceIds.has(id));
    if (!ids.length) return;
    const amount = Number(allowanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Informe um valor válido para a ajuda de custo.");
      return;
    }
    try {
      for (const workerId of ids) {
        await addDailyAllowance({ worker_id: workerId, date: allowanceDate, amount, method: allowanceMethod });
      }
      setSelectedAllowanceWorkers([]);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível registrar a ajuda de custo.");
    }
  };

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
                    <p className="text-sm font-semibold">{c?.number || (r.service_order_id ? "Receita de O.S." : "Receita")}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.reference_period} · previsto {formatDate(r.expected_date)}
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

      {tab === "Ajuda de custo" ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <StatCard label="Hoje" value={brl(dayAllowanceTotal)} sub={`${dailyAllowances.filter((a) => a.date === allowanceDate).length} pagos`} tone="success" icon={<WalletCards className="size-4" />} />
            <StatCard label="No mês" value={brl(monthAllowanceTotal)} sub="Ajuda de custo paga" tone="info" icon={<WalletCards className="size-4" />} />
          </div>

          <Card className="mb-4 space-y-3">
            <SectionTitle title="Registrar ajuda de custo" hint="Separada do pagamento das diárias" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <Input type="date" value={allowanceDate} onChange={(e) => setAllowanceDate(e.target.value)} />
              </Field>
              <Field label="Valor por diarista (R$)">
                <Input type="number" min="0.01" step="0.01" value={allowanceAmount} onChange={(e) => setAllowanceAmount(e.target.value)} />
              </Field>
            </div>
            <Field label="Forma de pagamento">
              <Select value={allowanceMethod} onChange={(e) => setAllowanceMethod(e.target.value as typeof allowanceMethod)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">
              O valor padrão é R$ 20,00. Este lançamento não altera nem antecipa a diária do 5º dia útil.
            </p>
            <Button className="w-full" onClick={registerAllowances} disabled={!selectedAllowanceWorkers.length}>
              <WalletCards className="size-4" /> Registrar para os selecionados ({selectedAllowanceWorkers.length})
            </Button>
          </Card>

          <SectionTitle title="Diaristas presentes" hint={`${unpaidPresentDiaristas.length} ainda sem ajuda registrada em ${formatDate(allowanceDate)}`} />
          <div className="mb-5 space-y-2">
            {presentDiaristas.length === 0 ? <EmptyState text="Nenhum diarista com presença registrada nesta data." /> : null}
            {presentDiaristas.map((w) => {
              const paid = paidAllowanceIds.has(w.id);
              return (
                <div key={w.id} className="card-surface flex items-center gap-3 p-3">
                  {!paid ? (
                    <input
                      type="checkbox"
                      checked={selectedAllowanceWorkers.includes(w.id)}
                      onChange={(e) => setSelectedAllowanceWorkers((current) => e.target.checked ? [...new Set([...current, w.id])] : current.filter((id) => id !== w.id))}
                      className="size-4 accent-primary"
                    />
                  ) : <span className="size-4" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{w.full_name}</p>
                    <p className="text-xs text-muted-foreground">{paid ? "Ajuda de custo registrada" : "Presença confirmada"}</p>
                  </div>
                  {paid ? <Badge tone="success">Pago</Badge> : <span className="text-sm font-semibold">{brl(Number(allowanceAmount || 20))}</span>}
                </div>
              );
            })}
          </div>

          <SectionTitle title="Últimos pagamentos" hint="Histórico da ajuda de custo" />
          <div className="space-y-2">
            {dailyAllowances.slice(0, 20).map((a) => (
              <div key={a.id} className="card-surface flex items-center gap-3 p-3">
                <WalletCards className="size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{workers.find((w) => w.id === a.worker_id)?.full_name ?? "Diarista"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(a.date)} · {a.method === "dinheiro" ? "Dinheiro" : a.method === "pix" ? "PIX" : "Transferência"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{brl(Number(a.amount))}</p>
                  <button type="button" aria-label="Excluir registro" className="mt-1 inline-flex items-center gap-1 text-[11px] text-destructive" onClick={() => deleteDailyAllowance(a.id)}>
                    <Trash2 className="size-3" /> Excluir
                  </button>
                </div>
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
