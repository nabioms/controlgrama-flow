import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Minus, Plus, Settings2, Trash2, UsersRound, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, SectionTitle, StatCard } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import type { ServiceUnit } from "@/lib/types";
import { brl, formatDate, toISO } from "@/lib/format";

export const Route = createFileRoute("/os")({ component: ServiceOrdersPage });

const unitLabel: Record<ServiceUnit, string> = { m2: "m²", km: "km", hora: "hora", unidade: "unidade" };

type DraftService = { service_type_id: string; planned_quantity: string };

function ServiceOrdersPage() {
  const { serviceTypes, serviceOrders, contracts, teams, receivables, addServiceType, updateServiceType, addServiceOrder, finalizeServiceOrder } = useStore();
  const today = toISO(new Date());

  const [date, setDate] = useState(today);
  const [contractId, setContractId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [services, setServices] = useState<DraftService[]>([{ service_type_id: "", planned_quantity: "" }]);
  const [notes, setNotes] = useState("");
  const [showTypes, setShowTypes] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeUnit, setTypeUnit] = useState<ServiceUnit>("m2");
  const [typePrice, setTypePrice] = useState("");
  const [filterMonth, setFilterMonth] = useState(today.slice(0, 7));
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState<string | null>(null);
  const [realizedInputs, setRealizedInputs] = useState<Record<string, string>>({});

  const activeTypes = serviceTypes.filter((x) => x.active);
  const activeTeams = teams.filter((x) => x.active);
  const selectedTeam = activeTeams.find((x) => x.id === teamId);

  const draftTotal = services.reduce((sum, row) => {
    const type = activeTypes.find((x) => x.id === row.service_type_id);
    return sum + (type ? Number(row.planned_quantity || 0) * Number(type.unit_price) : 0);
  }, 0);

  const filteredOrders = useMemo(
    () =>
      serviceOrders.filter(
        (o) =>
          o.service_date.slice(0, 7) === filterMonth &&
          (filterType === "all" || o.service_type_id === filterType || o.items?.some((i) => i.service_type_id === filterType)) &&
          (filterStatus === "all" || o.status === filterStatus) &&
          (filterTeam === "all" || o.team_id === filterTeam),
      ),
    [serviceOrders, filterMonth, filterType, filterStatus, filterTeam],
  );

  const monthOrders = useMemo(() => serviceOrders.filter((o) => o.service_date.slice(0, 7) === filterMonth), [serviceOrders, filterMonth]);
  const realized = monthOrders.filter((o) => o.status === "realizada").reduce((s, o) => s + Number(o.realized_amount), 0);
  const pending = monthOrders.filter((o) => o.status === "aberta").length;
  const notDone = monthOrders.filter((o) => o.status === "nao_realizada").length;

  function addServiceRow() {
    setServices((rows) => [...rows, { service_type_id: "", planned_quantity: "" }]);
  }

  function removeServiceRow(index: number) {
    setServices((rows) => rows.length === 1 ? rows : rows.filter((_, i) => i !== index));
  }

  async function createOrder() {
    setError("");
    setSaving(true);
    try {
      const valid = services
        .map((s) => ({ service_type_id: s.service_type_id, planned_quantity: Number(s.planned_quantity) }))
        .filter((s) => s.service_type_id && s.planned_quantity > 0);

      if (!valid.length) throw new Error("Adicione pelo menos um serviço com quantidade maior que zero.");

      await addServiceOrder({
        service_date: date,
        service_type_id: valid[0].service_type_id,
        contract_id: contractId || null,
        team_id: teamId,
        planned_quantity: valid[0].planned_quantity,
        services: valid,
        notes: notes || null,
      });

      setServices([{ service_type_id: "", planned_quantity: "" }]);
      setNotes("");
      setTeamId("");
      setContractId("");
    } catch (e: any) {
      setError(e?.message || "Não foi possível abrir a O.S.");
    } finally {
      setSaving(false);
    }
  }

  async function createType() {
    setError("");
    try {
      await addServiceType(typeName, typeUnit, Number(typePrice));
      setTypeName("");
      setTypePrice("");
    } catch (e: any) {
      setError(e?.message || "Não foi possível cadastrar o serviço.");
    }
  }

  function openFinish(orderId: string) {
    const order = serviceOrders.find((o) => o.id === orderId);
    if (!order) return;
    const items = order.items || [];
    setRealizedInputs(Object.fromEntries(items.map((item) => [item.id, String(item.planned_quantity)])));
    setFinishing(orderId);
    setError("");
  }

  async function finish(status: "realizada" | "nao_realizada") {
    if (!finishing) return;
    try {
      if (status === "nao_realizada") {
        if (!window.confirm("Marcar esta O.S. como NÃO realizada? Ela ficará registrada, mas não entrará na produção.")) return;
        await finalizeServiceOrder(finishing, status);
      } else {
        const order = serviceOrders.find((o) => o.id === finishing);
        const items = order?.items || [];
        if (!items.length) throw new Error("Esta O.S. não possui linhas de serviço carregadas. Atualize a página e tente novamente.");
        const quantities = items.map((item) => ({ item_id: item.id, quantity: Number(realizedInputs[item.id] ?? item.planned_quantity) }));
        if (quantities.some((x) => !Number.isFinite(x.quantity) || x.quantity < 0)) throw new Error("Informe quantidades realizadas válidas.");
        await finalizeServiceOrder(finishing, status, quantities);
      }
      setFinishing(null);
    } catch (e: any) {
      setError(e?.message || "Não foi possível finalizar a O.S.");
    }
  }

  return (
    <AppShell title="Ordens de serviço" subtitle="Produção, histórico e equipe executora">
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Produção do mês" value={brl(realized)} sub="somente O.S. realizadas" tone="success" icon={<CheckCircle2 className="size-4" />} />
        <StatCard label="Total de O.S." value={String(monthOrders.length)} sub={filterMonth} tone="info" icon={<ClipboardList className="size-4" />} />
        <StatCard label="Em aberto" value={String(pending)} sub="aguardando execução" tone="warning" icon={<ClipboardList className="size-4" />} />
        <StatCard label="Não realizadas" value={String(notDone)} sub="fora da produção" tone="info" icon={<XCircle className="size-4" />} />
      </div>

      <Card className="mb-5">
        <SectionTitle title="Abrir O.S." hint="Uma O.S. pode ter vários serviços para a mesma equipe e contrato." />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Data<input className="input mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="text-xs font-semibold">Equipe responsável<select className="input mt-1" value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">Selecione a equipe...</option>{activeTeams.map((t) => <option key={t.id} value={t.id}>{t.name}{t.foreman ? ` — Enc.: ${t.foreman.full_name}` : " — sem encarregado"}</option>)}</select></label>
          <label className="text-xs font-semibold sm:col-span-2">Contrato (opcional)<select className="input mt-1" value={contractId} onChange={(e) => setContractId(e.target.value)}><option value="">Sem contrato</option>{contracts.filter((c) => c.status === "vigente").map((c) => <option key={c.id} value={c.id}>{c.number} — {c.agency}</option>)}</select></label>
        </div>

        {selectedTeam ? (
          <div className="mt-3 rounded-xl border p-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="size-4" /> {selectedTeam.name}</div>
            <p className="mt-1 text-xs text-muted-foreground">Encarregado: {selectedTeam.foreman?.full_name || "não definido"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{(selectedTeam.members || []).map((w) => <span key={w.id} className="rounded-full bg-muted px-2 py-1 text-[11px]">{w.full_name}</span>)}</div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Serviços desta O.S.</p>
              <p className="text-xs text-muted-foreground">Você pode adicionar quantos serviços forem necessários.</p>
            </div>
            <Button variant="outline" onClick={addServiceRow}><Plus className="size-4" /> Serviço</Button>
          </div>

          <div className="space-y-2">
            {services.map((row, index) => {
              const type = activeTypes.find((x) => x.id === row.service_type_id);
              const amount = type ? Number(row.planned_quantity || 0) * Number(type.unit_price) : 0;
              return (
                <div key={index} className="grid gap-2 rounded-xl bg-muted/50 p-2 sm:grid-cols-[1fr_150px_130px_auto] sm:items-end">
                  <label className="text-xs font-semibold">Serviço<select className="input mt-1" value={row.service_type_id} onChange={(e) => setServices((rows) => rows.map((x, i) => i === index ? { ...x, service_type_id: e.target.value } : x))}><option value="">Selecione...</option>{activeTypes.map((t) => <option key={t.id} value={t.id}>{t.name} — {brl(Number(t.unit_price))}/{unitLabel[t.unit]}</option>)}</select></label>
                  <label className="text-xs font-semibold">Quantidade<input className="input mt-1" type="number" min="0" step="0.01" value={row.planned_quantity} onChange={(e) => setServices((rows) => rows.map((x, i) => i === index ? { ...x, planned_quantity: e.target.value } : x))} placeholder={type ? unitLabel[type.unit] : "ex.: 10000"} /></label>
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs"><span className="text-muted-foreground">Subtotal</span><div className="font-semibold">{brl(amount)}</div></div>
                  <Button variant="outline" disabled={services.length === 1} onClick={() => removeServiceRow(index)} aria-label="Remover serviço"><Trash2 className="size-4" /></Button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2">
            <span className="text-sm font-semibold">Valor total previsto da O.S.</span>
            <span className="text-lg font-bold">{brl(draftTotal)}</span>
          </div>
        </div>

        <label className="mt-3 block text-xs font-semibold">Observação<textarea className="input mt-1 min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Frente, local ou observação da execução..." /></label>
        {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
        <Button className="mt-3 w-full" disabled={saving || !teamId || !services.some((s) => s.service_type_id && Number(s.planned_quantity) > 0)} onClick={createOrder}><Plus className="size-4" /> Abrir O.S. com {services.filter((s) => s.service_type_id && Number(s.planned_quantity) > 0).length || 0} serviço(s)</Button>
      </Card>

      <Card className="mb-5">
        <SectionTitle title="Consultar O.S." hint="Consulte meses anteriores e filtre por serviço, equipe ou situação." />
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs font-semibold">Mês<input className="input mt-1" type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} /></label>
          <label className="text-xs font-semibold">Serviço<select className="input mt-1" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="all">Todos</option>{serviceTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="text-xs font-semibold">Equipe<select className="input mt-1" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}><option value="all">Todas</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="text-xs font-semibold">Situação<select className="input mt-1" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="all">Todas</option><option value="realizada">Realizada</option><option value="nao_realizada">Não realizada</option><option value="aberta">Aberta</option></select></label>
        </div>
      </Card>

      <div className="mb-4 flex items-center justify-between gap-3"><SectionTitle title="Serviços cadastrados" hint="Valores unitários usados nas O.S." /><Button variant="outline" onClick={() => setShowTypes((v) => !v)}><Settings2 className="size-4" /> {showTypes ? "Fechar" : "Gerenciar"}</Button></div>
      {showTypes && <Card className="mb-5"><div className="grid gap-2 sm:grid-cols-[1fr_130px_150px_auto]"><input className="input" value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="Nome do serviço" /><select className="input" value={typeUnit} onChange={(e) => setTypeUnit(e.target.value as ServiceUnit)}><option value="m2">m²</option><option value="km">km</option><option value="hora">hora</option><option value="unidade">unidade</option></select><input className="input" type="number" step="0.0001" min="0" value={typePrice} onChange={(e) => setTypePrice(e.target.value)} placeholder="Valor unitário" /><Button disabled={!typeName.trim() || Number(typePrice) < 0} onClick={createType}>Adicionar</Button></div><div className="mt-3 space-y-2">{serviceTypes.map((t) => <div key={t.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{brl(Number(t.unit_price))}/{unitLabel[t.unit]}</p></div><Button variant="outline" onClick={() => updateServiceType(t.id, { active: !t.active })}>{t.active ? "Desativar" : "Ativar"}</Button></div>)}</div></Card>}

      <SectionTitle title={`O.S. de ${filterMonth}`} hint={`${filteredOrders.length} ordem(ns) encontrada(s)`} />
      <div className="space-y-2">
        {filteredOrders.map((o) => {
          const team = o.team || teams.find((t) => t.id === o.team_id);
          const items = o.items || [];
          return (
            <Card key={o.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">O.S. #{o.order_number} · {items.length ? `${items.length} serviço(s)` : o.service_type?.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(o.service_date)} · equipe {team?.name || "não informada"}</p>
                  {items.length ? <div className="mt-2 space-y-1">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-xs"><span>{item.service_type?.name || serviceTypes.find((t) => t.id === item.service_type_id)?.name || "Serviço"} · {Number(item.planned_quantity).toLocaleString("pt-BR")} {item.service_type ? unitLabel[item.service_type.unit] : ""}</span><strong>{brl(Number(item.planned_amount))}</strong></div>)}</div> : <p className="text-xs text-muted-foreground">Serviço legado · {Number(o.planned_quantity).toLocaleString("pt-BR")} × {brl(Number(o.unit_price))}</p>}
                  {o.notes && <p className="mt-1 text-xs text-muted-foreground">{o.notes}</p>}
                </div>
                <Badge tone={o.status === "realizada" ? "success" : o.status === "nao_realizada" ? "danger" : "warning"}>{o.status === "realizada" ? "REALIZADA" : o.status === "nao_realizada" ? "NÃO REALIZADA" : "ABERTA"}</Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><p className="text-[11px] text-muted-foreground">Encarregado</p><p className="font-semibold text-xs">{team?.foreman?.full_name || "Sem encarregado"}</p></div>
                <div className="text-right"><p className="text-[11px] text-muted-foreground">{o.status === "realizada" ? "Valor realizado" : "Valor previsto"}</p><p className="font-semibold">{brl(Number(o.status === "realizada" ? o.realized_amount : o.planned_amount))}</p></div>
              </div>
              {o.status === "realizada" ? (() => {
                const receivable = receivables.find((r) => r.service_order_id === o.id);
                return (
                  <div className="mt-3 flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Financeiro</span>
                    <span className="font-semibold">
                      {receivable ? (receivable.status === "recebido" ? "Recebida" : "A receber") : "Sem lançamento financeiro"}
                    </span>
                  </div>
                );
              })() : null}
              {o.status === "aberta" && <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => openFinish(o.id)}><CheckCircle2 className="size-4" /> OK — realizada</Button><Button variant="outline" onClick={() => { setFinishing(o.id); setRealizedInputs({}); }}><XCircle className="size-4" /> Não OK</Button></div>}
            </Card>
          );
        })}
        {!filteredOrders.length && <EmptyState title="Nenhuma O.S. encontrada" description="Altere o mês ou os filtros para consultar outros registros." />}
      </div>

      {finishing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <Card className="max-h-[85vh] w-full max-w-xl overflow-auto p-4">
            {(() => {
              const order = serviceOrders.find((o) => o.id === finishing);
              const items = order?.items || [];
              const total = items.reduce((sum, item) => sum + Number(realizedInputs[item.id] || 0) * Number(item.unit_price), 0);
              return (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-lg font-semibold">Finalizar O.S. #{order?.order_number}</p><p className="text-xs text-muted-foreground">Informe quanto foi realmente executado em cada serviço.</p></div>
                    <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setFinishing(null)} aria-label="Fechar">×</button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {items.map((item) => {
                      const type = item.service_type || serviceTypes.find((t) => t.id === item.service_type_id);
                      return <div key={item.id} className="grid grid-cols-[1fr_130px] items-end gap-2 rounded-xl bg-muted/50 p-3"><div><p className="text-sm font-semibold">{type?.name || "Serviço"}</p><p className="text-xs text-muted-foreground">Previsto: {Number(item.planned_quantity).toLocaleString("pt-BR")} {type ? unitLabel[type.unit] : ""} · {brl(Number(item.unit_price))}/{type ? unitLabel[type.unit] : ""}</p></div><label className="text-xs font-semibold">Realizado<input className="input mt-1" type="number" min="0" step="0.01" value={realizedInputs[item.id] ?? ""} onChange={(e) => setRealizedInputs((x) => ({ ...x, [item.id]: e.target.value }))} /></label></div>;
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2"><span className="text-sm font-semibold">Valor realizado</span><span className="text-lg font-bold">{brl(total)}</span></div>
                  {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
                  <div className="mt-4 grid grid-cols-2 gap-2"><Button onClick={() => finish("realizada")}><CheckCircle2 className="size-4" /> Finalizar realizada</Button><Button variant="outline" onClick={() => setFinishing(null)}>Cancelar</Button></div>
                </>
              );
            })()}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
