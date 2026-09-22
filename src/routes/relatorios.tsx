import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, Field, Input, SectionTitle, Select } from "@/components/ui-kit";
import { useStore } from "@/lib/store";

import { brl, formatDate, toISO } from "@/lib/format";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — ControlGrama" },
      {
        name: "description",
        content: "Folha de ponto mensal, pagamentos de diárias, receitas x despesas e relatório por contrato da prefeitura.",
      },
      { property: "og:title", content: "Relatórios — ControlGrama" },
      { property: "og:description", content: "Exporte folha de ponto, diárias e financeiro por período." },
    ],
  }),
  component: RelatoriosPage,
});

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RelatoriosPage() {
  const { workers, attendance, payments, payables, receivables, contracts, expenseCategories } = useStore();
  const today = toISO(new Date());
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [contractId, setContractId] = useState("");

  const inRange = (d: string) => d >= from && d <= to;

  const pontoRows = () => {
    const rows: (string | number)[][] = [["Funcionário", "Vínculo", "Presenças", "Faltas", "Justificadas", "Atestados"]];
    workers.forEach((w) => {
      const r = attendance.filter((a) => a.worker_id === w.id && inRange(a.date));
      if (!r.length) return;
      rows.push([
        w.full_name,
        w.employment_type,
        r.filter((x) => x.status === "presente").length,
        r.filter((x) => x.status === "falta").length,
        r.filter((x) => x.status === "falta_justificada").length,
        r.filter((x) => x.status === "atestado").length,
      ]);
    });
    return rows;
  };

  const diariasRows = () => {
    const rows: (string | number)[][] = [["Funcionário", "Dias", "Valor diária", "Total", "Status", "Pago em", "Forma"]];
    payments.forEach((p) => {
      const w = workers.find((x) => x.id === p.worker_id);
      rows.push([
        w?.full_name ?? "—",
        p.worked_days,
        p.daily_rate ?? "-",
        p.gross_amount,
        p.status,
        p.paid_at ?? "-",
        p.method ?? "-",
      ]);
    });
    return rows;
  };

  const financeiroRows = () => {
    const rows: (string | number)[][] = [["Tipo", "Descrição", "Categoria/Contrato", "Data", "Valor", "Status"]];
    receivables.filter((r) => inRange(r.expected_date)).forEach((r) =>
      rows.push([
        "Receita",
        `Medição ${r.reference_period}`,
        contracts.find((c) => c.id === r.contract_id)?.number ?? "-",
        r.expected_date,
        r.expected_amount,
        r.status,
      ]),
    );
    payables.filter((p) => inRange(p.due_date)).forEach((p) =>
      rows.push([
        "Despesa",
        p.description,
        expenseCategories.find((c) => c.key === p.category)?.label ?? "-",
        p.due_date,
        p.amount,
        p.status,
      ]),
    );
    return rows;
  };

  const contractRows = () => {
    const list = contractId ? contracts.filter((c) => c.id === contractId) : contracts;
    const rows: (string | number)[][] = [["Contrato", "Receita prevista", "Custo direto", "Resultado"]];
    list.forEach((c) => {
      const rev = receivables.filter((r) => r.contract_id === c.id).reduce((s, r) => s + r.expected_amount, 0);
      const cost = payables.filter((p) => p.contract_id === c.id).reduce((s, p) => s + p.amount, 0);
      rows.push([c.number, rev, cost, rev - cost]);
    });
    return rows;
  };

  const reports = [
    { key: "folha-de-ponto", title: "Folha de ponto mensal", hint: "Presenças, faltas e justificativas por trabalhador", build: pontoRows },
    { key: "pagamentos-diarias", title: "Pagamentos de diárias", hint: "Por período, com forma de pagamento", build: diariasRows },
    { key: "financeiro", title: "Receitas x despesas", hint: "Todas as movimentações do período", build: financeiroRows },
    { key: "por-contrato", title: "Relatório por contrato", hint: "Rentabilidade por frente de serviço", build: contractRows },
  ];

  const totalPeriodo = payments.reduce((s, p) => s + p.gross_amount, 0);

  return (
    <AppShell title="Relatórios" subtitle="Exportação em CSV (abre no Excel)">
      <Card className="mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="De">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Até">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="Contrato / frente de serviço">
          <Select value={contractId} onChange={(e) => setContractId(e.target.value)}>
            <option value="">Todos os contratos</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.number}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted-foreground">
          Período: {formatDate(from)} a {formatDate(to)} · diárias lançadas {brl(totalPeriodo)}
        </p>
      </Card>

      <SectionTitle title="Relatórios disponíveis" />
      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.key} className="card-surface flex items-center gap-3 p-3">
            <FileSpreadsheet className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.hint}</p>
            </div>
            <Button size="sm" variant="soft" onClick={() => downloadCsv(`${r.key}-${from}-a-${to}`, r.build())}>
              <Download className="size-3.5" /> CSV
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
        <Badge tone="primary">PDF</Badge>{" "}
        A geração de PDF usa a impressão do navegador enquanto os dados ainda são locais.
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => window.print()}>
          Imprimir / salvar em PDF
        </Button>
      </div>
    </AppShell>
  );
}
