import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Package, RotateCcw, Trash2, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, SectionTitle, Select, StatCard } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { formatDate, toISO } from "@/lib/format";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — ControlGrama" },
      { name: "description", content: "Controle de estoque: entradas, saídas, retiradas por trabalhador e devoluções." },
      { property: "og:title", content: "Estoque — ControlGrama" },
      { property: "og:description", content: "Saiba o que entrou, o que saiu, quem pegou e se devolveu." },
    ],
  }),
  component: EstoquePage,
});

// Estrutura esperada para futuras tabelas: stock_items e stock_movements.
type StockItem = { id: string; name: string; category: string; unit: string; min_quantity: number; created_at: string };
type MovementKind = "entrada" | "saida" | "retirada" | "devolucao";
type StockMovement = {
  id: string; item_id: string; kind: MovementKind; quantity: number; date: string;
  person: string | null; notes: string | null; loan_id: string | null; // devolução aponta para a retirada
};

const KEY = "controlgrama-estoque-v1";
const CATEGORIES = ["Ferramentas", "Equipamentos", "EPIs", "Combustível", "Peças", "Material de limpeza", "Outros"];
const UNITS = ["un", "L", "kg", "m", "cx", "par"];
const kindLabel: Record<MovementKind, string> = { entrada: "Entrada", saida: "Saída (consumo)", retirada: "Retirada (empréstimo)", devolucao: "Devolução" };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function EstoquePage() {
  const { workers } = useStore();
  const [items, setItems] = useState<StockItem[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"itens" | "movimentar" | "emprestimos" | "historico">("itens");
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); setItems(d.items ?? []); setMoves(d.moves ?? []); }
    } catch { /* ignora dados inválidos */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify({ items, moves })); }, [items, moves, loaded]);

  const returnedByLoan = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of moves) if (mv.kind === "devolucao" && mv.loan_id) m.set(mv.loan_id, (m.get(mv.loan_id) ?? 0) + mv.quantity);
    return m;
  }, [moves]);

  const balance = useMemo(() => {
    const b = new Map<string, number>();
    for (const mv of moves) {
      const sign = mv.kind === "entrada" || mv.kind === "devolucao" ? 1 : -1;
      b.set(mv.item_id, (b.get(mv.item_id) ?? 0) + sign * mv.quantity);
    }
    return b;
  }, [moves]);

  const openLoans = moves
    .filter((m) => m.kind === "retirada")
    .map((m) => ({ ...m, pending: m.quantity - (returnedByLoan.get(m.id) ?? 0) }))
    .filter((m) => m.pending > 0);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
  const unitOf = (id: string) => items.find((i) => i.id === id)?.unit ?? "";
  const low = items.filter((i) => (balance.get(i.id) ?? 0) <= i.min_quantity);

  // Formulário de item
  const [itemForm, setItemForm] = useState({ name: "", category: CATEGORIES[0]!, unit: "un", min_quantity: "0", initial: "0" });
  function addItem() {
    if (!itemForm.name.trim()) return;
    const item: StockItem = { id: uid(), name: itemForm.name.trim(), category: itemForm.category, unit: itemForm.unit, min_quantity: Number(itemForm.min_quantity) || 0, created_at: toISO(new Date()) };
    setItems((p) => [...p, item]);
    const initial = Number(itemForm.initial) || 0;
    if (initial > 0) setMoves((p) => [...p, { id: uid(), item_id: item.id, kind: "entrada", quantity: initial, date: item.created_at, person: null, notes: "Estoque inicial", loan_id: null }]);
    setItemForm({ ...itemForm, name: "", min_quantity: "0", initial: "0" });
  }
  function removeItem(id: string) {
    if (!confirm("Excluir este item e todo o seu histórico?")) return;
    setItems((p) => p.filter((i) => i.id !== id));
    setMoves((p) => p.filter((m) => m.item_id !== id));
  }

  // Formulário de movimentação
  const [mv, setMv] = useState({ item_id: "", kind: "entrada" as MovementKind, quantity: "1", date: toISO(new Date()), person: "", notes: "" });
  const [mvError, setMvError] = useState("");
  function addMove() {
    setMvError("");
    const qty = Number(mv.quantity);
    if (!mv.item_id) return setMvError("Escolha um item.");
    if (!(qty > 0)) return setMvError("Informe uma quantidade maior que zero.");
    if ((mv.kind === "saida" || mv.kind === "retirada") && qty > (balance.get(mv.item_id) ?? 0)) return setMvError("Quantidade maior que o saldo disponível.");
    if (mv.kind === "retirada" && !mv.person.trim()) return setMvError("Informe quem pegou.");
    setMoves((p) => [...p, { id: uid(), item_id: mv.item_id, kind: mv.kind, quantity: qty, date: mv.date, person: mv.person.trim() || null, notes: mv.notes.trim() || null, loan_id: null }]);
    setMv({ ...mv, quantity: "1", person: "", notes: "" });
  }
  function giveBack(loanId: string, pending: number) {
    const input = prompt("Quantidade devolvida:", String(pending));
    const qty = Number(input);
    if (!input || !(qty > 0) || qty > pending) return;
    const loan = moves.find((m) => m.id === loanId)!;
    setMoves((p) => [...p, { id: uid(), item_id: loan.item_id, kind: "devolucao", quantity: qty, date: toISO(new Date()), person: loan.person, notes: null, loan_id: loanId }]);
  }

  const people = workers.filter((w) => w.status === "ativo").map((w) => w.full_name);
  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()));
  const tabs = [
    ["itens", "Itens"], ["movimentar", "Movimentar"], ["emprestimos", `Com pessoas (${openLoans.length})`], ["historico", "Histórico"],
  ] as const;

  return (
    <AppShell title="Estoque" subtitle="Entradas, saídas, retiradas e devoluções">
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Itens" value={String(items.length)} tone="primary" icon={<Boxes className="size-4" />} />
        <StatCard label="Estoque baixo" value={String(low.length)} tone="warning" icon={<AlertTriangle className="size-4" />} />
        <StatCard label="Com pessoas" value={String(openLoans.length)} sub="não devolvidos" tone="info" icon={<UserRound className="size-4" />} />
        <StatCard label="Movimentações" value={String(moves.length)} tone="success" icon={<Package className="size-4" />} />
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "itens" && (
        <>
          <Card className="mb-4">
            <SectionTitle title="Cadastrar item" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome"><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Ex.: Roçadeira, fio de nylon" /></Field>
              <Field label="Categoria"><Select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Unidade"><Select value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
              <Field label="Estoque mínimo"><Input type="number" min={0} value={itemForm.min_quantity} onChange={(e) => setItemForm({ ...itemForm, min_quantity: e.target.value })} /></Field>
              <Field label="Quantidade inicial"><Input type="number" min={0} value={itemForm.initial} onChange={(e) => setItemForm({ ...itemForm, initial: e.target.value })} /></Field>
            </div>
            <Button className="mt-3 w-full" onClick={addItem}>Adicionar item</Button>
          </Card>

          <Input className="mb-3" placeholder="Buscar item ou categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="space-y-2">
            {filtered.length === 0 ? <EmptyState text="Nenhum item cadastrado." /> : filtered.map((i) => {
              const qty = balance.get(i.id) ?? 0;
              const out = openLoans.filter((l) => l.item_id === i.id).reduce((s, l) => s + l.pending, 0);
              return (
                <div key={i.id} className="card-surface flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.category} · mín. {i.min_quantity} {i.unit}{out ? ` · ${out} com pessoas` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={qty <= i.min_quantity ? "danger" : "success"}>{qty} {i.unit}</Badge>
                    <button type="button" aria-label="Excluir item" onClick={() => removeItem(i.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "movimentar" && (
        <Card>
          <SectionTitle title="Registrar movimentação" />
          {items.length === 0 ? <EmptyState text="Cadastre um item primeiro." /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo"><Select value={mv.kind} onChange={(e) => setMv({ ...mv, kind: e.target.value as MovementKind })}>{(["entrada", "saida", "retirada"] as const).map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}</Select></Field>
              <Field label="Item"><Select value={mv.item_id} onChange={(e) => setMv({ ...mv, item_id: e.target.value })}><option value="">Selecione…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} (saldo {balance.get(i.id) ?? 0} {i.unit})</option>)}</Select></Field>
              <Field label="Quantidade"><Input type="number" min={0} step="any" value={mv.quantity} onChange={(e) => setMv({ ...mv, quantity: e.target.value })} /></Field>
              <Field label="Data"><Input type="date" value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value })} /></Field>
              <Field label={mv.kind === "entrada" ? "Fornecedor / quem entregou" : "Quem pegou"}>
                <Input list="estoque-pessoas" value={mv.person} onChange={(e) => setMv({ ...mv, person: e.target.value })} placeholder="Nome" />
                <datalist id="estoque-pessoas">{people.map((p) => <option key={p} value={p} />)}</datalist>
              </Field>
              <Field label="Observação"><Input value={mv.notes} onChange={(e) => setMv({ ...mv, notes: e.target.value })} placeholder="Frente de serviço, motivo…" /></Field>
            </div>
          )}
          {mvError ? <p className="mt-3 text-sm font-semibold text-destructive">{mvError}</p> : null}
          {items.length > 0 && <Button className="mt-3 w-full" onClick={addMove}>Registrar</Button>}
          <p className="mt-3 text-xs text-muted-foreground">Use "Retirada" para itens que precisam voltar (ferramentas, equipamentos). A devolução é marcada na aba "Com pessoas".</p>
        </Card>
      )}

      {tab === "emprestimos" && (
        <div className="space-y-2">
          {openLoans.length === 0 ? <EmptyState text="Nenhum item pendente de devolução." /> : openLoans.map((l) => (
            <div key={l.id} className="card-surface flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{itemName(l.item_id)} · {l.pending} {unitOf(l.item_id)}</p>
                <p className="text-xs text-muted-foreground">{l.person} · retirado em {formatDate(l.date)}</p>
              </div>
              <Button size="sm" variant="soft" onClick={() => giveBack(l.id, l.pending)}><RotateCcw className="size-3.5" />Devolveu</Button>
            </div>
          ))}
        </div>
      )}

      {tab === "historico" && (
        <div className="space-y-2">
          {moves.length === 0 ? <EmptyState text="Nenhuma movimentação ainda." /> : [...moves].sort((a, b) => b.date.localeCompare(a.date)).map((m) => {
            const inbound = m.kind === "entrada" || m.kind === "devolucao";
            return (
              <div key={m.id} className="card-surface flex items-center gap-3 p-3">
                {inbound ? <ArrowDownToLine className="size-4 text-success" /> : <ArrowUpFromLine className="size-4 text-destructive" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{itemName(m.item_id)}</p>
                  <p className="truncate text-xs text-muted-foreground">{kindLabel[m.kind]} · {formatDate(m.date)}{m.person ? ` · ${m.person}` : ""}{m.notes ? ` · ${m.notes}` : ""}</p>
                </div>
                <span className={`text-sm font-semibold ${inbound ? "text-success" : "text-destructive"}`}>{inbound ? "+" : "−"}{m.quantity} {unitOf(m.item_id)}</span>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
