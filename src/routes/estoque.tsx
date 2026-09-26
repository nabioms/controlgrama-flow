import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Package, Pencil, RotateCcw, Trash2, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, SectionTitle, Select, StatCard } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
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
  person: string | null; person_worker_id?: string | null; notes: string | null; loan_id: string | null; // devolução aponta para a retirada
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
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"itens" | "movimentar" | "emprestimos" | "historico">("itens");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const raw = localStorage.getItem(KEY);
        const local = raw ? JSON.parse(raw) : { items: [], moves: [] };
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!uid) {
          if (!disposed) {
            setItems(local.items ?? []);
            setMoves(local.moves ?? []);
            setLoaded(true);
          }
          return;
        }
        setUserId(uid);
        const [{ data: cloudItems, error: itemsError }, { data: cloudMoves, error: movesError }] = await Promise.all([
          supabase.from("stock_items").select("*").order("created_at"),
          supabase.from("stock_movements").select("*").order("date").order("created_at"),
        ]);
        if (itemsError) throw itemsError;
        if (movesError) throw movesError;

        const localItems: StockItem[] = local.items ?? [];
        const localMoves: StockMovement[] = local.moves ?? [];
        const cloudItemIds = new Set((cloudItems ?? []).map((x: any) => x.id));
        const cloudMoveIds = new Set((cloudMoves ?? []).map((x: any) => x.id));

        // Migra automaticamente o estoque que já estava salvo no celular para o Supabase.
        const missingItems = localItems.filter(x => !cloudItemIds.has(x.id));
        const missingMoves = localMoves.filter(x => !cloudMoveIds.has(x.id));
        if (missingItems.length) {
          const { error } = await supabase.from("stock_items").insert(missingItems.map(x => ({ ...x, user_id: uid })));
          if (error) throw error;
        }
        if (missingMoves.length) {
          const { error } = await supabase.from("stock_movements").insert(missingMoves.map(x => ({ ...x, user_id: uid })));
          if (error) throw error;
        }

        const finalItems = missingItems.length ? [...(cloudItems ?? []), ...missingItems.map(x => ({ ...x, user_id: uid }))] : (cloudItems ?? []);
        const finalMoves = missingMoves.length ? [...(cloudMoves ?? []), ...missingMoves.map(x => ({ ...x, user_id: uid }))] : (cloudMoves ?? []);
        if (!disposed) {
          setItems(finalItems as StockItem[]);
          setMoves(finalMoves as StockMovement[]);
          setLoaded(true);
        }
      } catch (error) {
        console.error("Falha ao carregar estoque:", error);
        try {
          const raw = localStorage.getItem(KEY);
          const local = raw ? JSON.parse(raw) : { items: [], moves: [] };
          if (!disposed) {
            setItems(local.items ?? []);
            setMoves(local.moves ?? []);
          }
        } catch {}
        if (!disposed) setLoaded(true);
      }
    };
    void load();
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ items, moves }));
  }, [items, moves, loaded]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("controlgrama-stock-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_items" }, async () => {
        const { data } = await supabase.from("stock_items").select("*").order("created_at");
        if (data) setItems(data as StockItem[]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, async () => {
        const { data } = await supabase.from("stock_movements").select("*").order("date").order("created_at");
        if (data) setMoves(data as StockMovement[]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

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
  function resetItemForm() {
    setEditingItemId(null);
    setShowItemForm(false);
    setItemForm({ name: "", category: CATEGORIES[0]!, unit: "un", min_quantity: "0", initial: "0" });
  }

  async function addItem() {
    if (!itemForm.name.trim()) return;
    if (editingItemId) {
      const initial = Number(itemForm.initial) || 0;
      const patch = {
        name: itemForm.name.trim(),
        category: itemForm.category,
        unit: itemForm.unit,
        min_quantity: Number(itemForm.min_quantity) || 0,
      };

      // A quantidade inicial é registrada como uma movimentação própria.
      // Ao editar, ajustamos essa movimentação em vez de criar uma nova,
      // evitando duplicar o estoque inicial no saldo.
      const initialMove = moves.find((m) => m.item_id === editingItemId && m.kind === "entrada" && m.notes === "Estoque inicial");

      setItems((p) => p.map((item) => item.id === editingItemId ? { ...item, ...patch } : item));

      if (initial > 0) {
        if (initialMove) {
          const updatedMove = { ...initialMove, quantity: initial };
          setMoves((p) => p.map((m) => m.id === initialMove.id ? updatedMove : m));
          if (userId) {
            const { error } = await supabase.from("stock_movements").update({ quantity: initial }).eq("id", initialMove.id);
            if (error) console.error("Falha ao atualizar estoque inicial:", error);
          }
        } else {
          const newInitialMove: StockMovement = {
            id: uid(),
            item_id: editingItemId,
            kind: "entrada",
            quantity: initial,
            date: toISO(new Date()),
            person: null,
            person_worker_id: null,
            notes: "Estoque inicial",
            loan_id: null,
          };
          setMoves((p) => [...p, newInitialMove]);
          if (userId) {
            const { error } = await supabase.from("stock_movements").insert({ ...newInitialMove, user_id: userId });
            if (error) console.error("Falha ao criar estoque inicial:", error);
          }
        }
      } else if (initialMove) {
        setMoves((p) => p.filter((m) => m.id !== initialMove.id));
        if (userId) {
          const { error } = await supabase.from("stock_movements").delete().eq("id", initialMove.id);
          if (error) console.error("Falha ao remover estoque inicial:", error);
        }
      }

      if (userId) {
        const { error } = await supabase.from("stock_items").update(patch).eq("id", editingItemId);
        if (error) console.error("Falha ao atualizar item:", error);
      }

      resetItemForm();
      return;
    }

    const item: StockItem = { id: uid(), name: itemForm.name.trim(), category: itemForm.category, unit: itemForm.unit, min_quantity: Number(itemForm.min_quantity) || 0, created_at: toISO(new Date()) };
    setItems((p) => [...p, item]);
    const initial = Number(itemForm.initial) || 0;
    const initialMove: StockMovement | null = initial > 0 ? { id: uid(), item_id: item.id, kind: "entrada", quantity: initial, date: item.created_at, person: null, person_worker_id: null, notes: "Estoque inicial", loan_id: null } : null;
    if (userId) {
      void supabase.from("stock_items").insert({ ...item, user_id: userId });
      if (initialMove) void supabase.from("stock_movements").insert({ ...initialMove, user_id: userId });
    }
    if (initialMove) setMoves((p) => [...p, initialMove]);
    resetItemForm();
  }

  function editItem(item: StockItem) {
    const initialMove = moves.find((m) => m.item_id === item.id && m.kind === "entrada" && m.notes === "Estoque inicial");
    setEditingItemId(item.id);
    setShowItemForm(true);
    setItemForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      min_quantity: String(item.min_quantity),
      initial: String(initialMove?.quantity ?? 0),
    });
    setTab("itens");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function removeItem(id: string) {
    if (!confirm("Excluir este item e todo o seu histórico?")) return;
    setItems((p) => p.filter((i) => i.id !== id));
    setMoves((p) => p.filter((m) => m.item_id !== id));
    if (userId) void supabase.from("stock_items").delete().eq("id", id);
  }

  // Formulário de movimentação
  const [mv, setMv] = useState({ item_id: "", kind: "entrada" as MovementKind, quantity: "1", date: toISO(new Date()), person: "", person_worker_id: "", notes: "" });
  const [mvError, setMvError] = useState("");
  function addMove() {
    setMvError("");
    const qty = Number(mv.quantity);
    if (!mv.item_id) return setMvError("Escolha um item.");
    if (!(qty > 0)) return setMvError("Informe uma quantidade maior que zero.");
    if ((mv.kind === "saida" || mv.kind === "retirada") && qty > (balance.get(mv.item_id) ?? 0)) return setMvError("Quantidade maior que o saldo disponível.");
    if (mv.kind === "retirada" && !mv.person_worker_id) return setMvError("Selecione o funcionário ou diarista que pegou o item.");
    const selectedWorker = workers.find((w) => w.id === mv.person_worker_id);
    const movement: StockMovement = { id: uid(), item_id: mv.item_id, kind: mv.kind, quantity: qty, date: mv.date, person: selectedWorker?.full_name || mv.person.trim() || null, person_worker_id: selectedWorker?.id || null, notes: mv.notes.trim() || null, loan_id: null };
    setMoves((p) => [...p, movement]);
    if (userId) void supabase.from("stock_movements").insert({ ...movement, user_id: userId });
    setMv({ ...mv, quantity: "1", person: "", person_worker_id: "", notes: "" });
  }
  function giveBack(loanId: string, pending: number) {
    const input = prompt("Quantidade devolvida:", String(pending));
    const qty = Number(input);
    if (!input || !(qty > 0) || qty > pending) return;
    const loan = moves.find((m) => m.id === loanId)!;
    const movement: StockMovement = { id: uid(), item_id: loan.item_id, kind: "devolucao", quantity: qty, date: toISO(new Date()), person: loan.person, person_worker_id: loan.person_worker_id || null, notes: null, loan_id: loanId };
    setMoves((p) => [...p, movement]);
    if (userId) void supabase.from("stock_movements").insert({ ...movement, user_id: userId });
  }

  const people = workers.filter((w) => w.status === "ativo");
  const filtered = items.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "Todas" || i.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Itens do estoque</h2>
              <p className="text-xs text-muted-foreground">{items.length} cadastrado{items.length === 1 ? "" : "s"}</p>
            </div>
            <Button onClick={() => { resetItemForm(); setShowItemForm(true); }}>
              <Package className="size-4" /> Adicionar item
            </Button>
          </div>

          <Card className="mb-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <Field label="Buscar">
                <Input placeholder="Buscar por nome ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </Field>
              <Field label="Filtrar por categoria">
                <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="Todas">Todas as categorias</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
          </Card>

          {showItemForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title">
              <div className="w-full max-w-lg rounded-2xl bg-card p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 id="item-dialog-title" className="text-lg font-bold">{editingItemId ? "Editar item" : "Novo item"}</h2>
                    <p className="text-xs text-muted-foreground">{editingItemId ? "Atualize os dados do produto." : "Cadastre um novo produto no estoque."}</p>
                  </div>
                  <button type="button" aria-label="Fechar" onClick={resetItemForm} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nome"><Input autoFocus value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Ex.: Roçadeira, fio de nylon" /></Field>
                  <Field label="Categoria"><Select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
                  <Field label="Unidade"><Select value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
                  <Field label="Estoque mínimo"><Input type="number" min={0} value={itemForm.min_quantity} onChange={(e) => setItemForm({ ...itemForm, min_quantity: e.target.value })} /></Field>
                  <Field label="Quantidade inicial"><Input type="number" min={0} value={itemForm.initial} onChange={(e) => setItemForm({ ...itemForm, initial: e.target.value })} /></Field>
                </div>
                <div className="mt-5 flex gap-2">
                  <Button className="w-full" onClick={addItem}>{editingItemId ? "Salvar alterações" : "Adicionar item"}</Button>
                  <Button variant="soft" onClick={resetItemForm}>Cancelar</Button>
                </div>
              </div>
            </div>
          )}

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
                    <button type="button" aria-label={`Editar ${i.name}`} onClick={() => editItem(i)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="size-4" /></button>
                    <button type="button" aria-label={`Excluir ${i.name}`} onClick={() => removeItem(i.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><Trash2 className="size-4" /></button>
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
              <Field label={mv.kind === "entrada" ? "Fornecedor / quem entregou" : "Funcionário / diarista"}>
                {mv.kind === "entrada" ? (
                  <Input value={mv.person} onChange={(e) => setMv({ ...mv, person: e.target.value })} placeholder="Nome do fornecedor ou responsável" />
                ) : (
                  <Select value={mv.person_worker_id} onChange={(e) => {
                    const worker = people.find((w) => w.id === e.target.value);
                    setMv({ ...mv, person_worker_id: e.target.value, person: worker?.full_name || "" });
                  }}>
                    <option value="">Selecione o funcionário/diarista…</option>
                    {people.map((w) => <option key={w.id} value={w.id}>{w.full_name} — {w.employment_type === "diarista" ? "Diarista" : "Funcionário"}{w.job_role ? ` · ${w.job_role}` : ""}</option>)}
                  </Select>
                )}
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
