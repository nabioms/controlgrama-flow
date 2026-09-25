import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, Field, Input, SectionTitle, Select } from "@/components/ui-kit";
import { useStore } from "@/lib/store";

import { brl, formatDate, toISO } from "@/lib/format";

type StockItem = { id: string; name: string; category: string; unit: string; min_quantity: number; created_at: string };
type StockMovement = { id: string; item_id: string; kind: "entrada" | "saida" | "retirada" | "devolucao"; quantity: number; date: string; person: string | null; notes: string | null; loan_id: string | null };

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
  const { workers, attendance, payments, dailyAllowances, payables, receivables, contracts, expenseCategories } = useStore();
  const today = toISO(new Date());
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [contractId, setContractId] = useState("");
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockMoves, setStockMoves] = useState<StockMovement[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("controlgrama-estoque-v1");
      if (raw) {
        const data = JSON.parse(raw);
        setStockItems(data.items ?? []);
        setStockMoves(data.moves ?? []);
      }
    } catch { /* ignora dados inválidos */ }
  }, []);

  const stockBalance = useMemo(() => {
    const map = new Map<string, number>();
    stockMoves.forEach((m) => {
      const sign = m.kind === "entrada" || m.kind === "devolucao" ? 1 : -1;
      map.set(m.item_id, (map.get(m.item_id) ?? 0) + sign * Number(m.quantity));
    });
    return map;
  }, [stockMoves]);

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

  const ajudaCustoRows = () => {
    const rows: (string | number)[][] = [["Data", "Diarista", "Valor", "Forma de pagamento", "Observação"]];
    dailyAllowances
      .filter((a) => inRange(a.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((a) => {
        rows.push([
          a.date,
          workers.find((w) => w.id === a.worker_id)?.full_name ?? "—",
          Number(a.amount),
          a.method === "dinheiro" ? "Dinheiro" : a.method === "pix" ? "PIX" : "Transferência",
          a.notes ?? "",
        ]);
      });
    rows.push(["", "TOTAL", dailyAllowances.filter((a) => inRange(a.date)).reduce((s, a) => s + Number(a.amount), 0), "", ""]);
    return rows;
  };

  const estoqueRows = () => {
    const rows: (string | number)[][] = [["Item", "Categoria", "Unidade", "Quantidade atual", "Estoque mínimo", "Situação"]];
    stockItems
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .forEach((item) => {
        const quantity = stockBalance.get(item.id) ?? 0;
        rows.push([item.name, item.category, item.unit, quantity, item.min_quantity, quantity <= item.min_quantity ? "Estoque baixo" : "Normal"]);
      });
    rows.push(["", "", "", stockItems.reduce((s, item) => s + (stockBalance.get(item.id) ?? 0), 0), "", "TOTAL"]);
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
    { key: "ajuda-de-custo", title: "Ajuda de custo dos diaristas", hint: "Pagamentos diários separados das diárias do 5º dia útil", build: ajudaCustoRows },
    { key: "estoque", title: "Relatório de estoque", hint: "Itens, quantidade atual, estoque mínimo e situação", build: estoqueRows },
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
