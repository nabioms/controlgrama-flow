import { useMemo, useState } from "react";
import { AlertTriangle, Award, ChevronDown, ChevronUp } from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionTitle, StatCard } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { brl, toISO } from "@/lib/format";
import { evaluateWeeks, isPending, type WeekBonusEval, type WorkerBonusEval } from "@/lib/bonus";

const fm = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const monthName = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export function useBonusEvaluations() {
  const { productionGoalWeeks, serviceOrders, serviceTypes, attendance, workers, teams, weeklyBonuses, bonusAmount, bonusRequirePresence, bonusEnabled } = useStore();
  return useMemo(
    () => evaluateWeeks({ weeks: productionGoalWeeks, orders: serviceOrders, types: serviceTypes, attendance, workers, teams, bonuses: weeklyBonuses, today: toISO(new Date()), bonusAmount, requirePresence: bonusRequirePresence, bonusEnabled }),
    [productionGoalWeeks, serviceOrders, serviceTypes, attendance, workers, teams, weeklyBonuses, bonusAmount, bonusRequirePresence, bonusEnabled],
  );
}

/** Totais por diarista: acumulado (com direito, semanas encerradas), pago e pendente. */
export function bonusByWorker(evals: WeekBonusEval[]) {
  const map = new Map<string, { name: string; earned: number; paid: number; pending: number }>();
  evals.forEach((w) =>
    w.workers.forEach((e) => {
      const cur = map.get(e.worker.id) || { name: e.worker.full_name, earned: 0, paid: 0, pending: 0 };
      if (w.finished) cur.earned += e.amount;
      if (e.paid) cur.paid += Number(e.paid.amount);
      if (isPending(w, e)) cur.pending += e.amount;
      map.set(e.worker.id, cur);
    }),
  );
  return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name));
}

function PayButton({ w, e }: { w: WeekBonusEval; e: WorkerBonusEval }) {
  const { markBonusAwarded, role, bonusTableMissing } = useStore();
  const [busy, setBusy] = useState(false);
  if (e.paid?.status === "pago") return <Badge tone="success">Bônus pago</Badge>;
  if (e.paid?.status === "bonificado") return <Badge tone="info">Bônus incluído</Badge>;
  if (e.paid?.status === "dispensado") return <Badge tone="warning">Não bonificado</Badge>;
  if (!e.amount) return null;
  if (!w.finished) return <Badge tone="info">Semana em andamento</Badge>;
  if (role !== "admin" || bonusTableMissing) return <Badge tone="warning">Pendente</Badge>;
  return (
    <Button
      variant="outline"
      onClick={async () => {
        setBusy(true);
        try {
          await markBonusAwarded({
            worker_id: e.worker.id, team_id: e.teamId, goal_week_id: w.week.id, week_number: w.week.week_number,
            week_start: w.week.start_date, week_end: w.week.end_date, week_target_m2: w.target, realized_m2: w.realized,
            percent: Math.round(w.percent * 100) / 100, goal_met: w.goalMet, presence_ok: e.presenceOk, amount: e.amount, method: null, notes: "Bônus selecionado para inclusão no próximo pagamento.",
          });
        } catch (err: any) {
          window.alert(err?.message || "Não foi possível registrar o bônus.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Salvando..." : "Pagar bônus"}
    </Button>
  );
}

export function BonusDecisionModal({ w, onClose }: { w: WeekBonusEval; onClose: () => void }) {
  const { markBonusAwarded, markBonusDismissed, role, bonusTableMissing } = useStore();
  const eligible = w.workers.filter(e => e.amount > 0 && !e.paid);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSelected(x => x.includes(id) ? x.filter(v => v !== id) : [...x, id]);
  if (!w.goalMet || !eligible.length || role !== "admin" || bonusTableMissing) return null;
  const base = (e: WorkerBonusEval) => ({ worker_id:e.worker.id, team_id:e.teamId, goal_week_id:w.week.id, week_number:w.week.week_number, week_start:w.week.start_date, week_end:w.week.end_date, week_target_m2:w.target, realized_m2:w.realized, percent:Math.round(w.percent*100)/100, goal_met:w.goalMet, presence_ok:e.presenceOk, amount:e.amount, method:null, notes:"Bônus selecionado para inclusão no próximo pagamento." });
  const save = async () => { setBusy(true); try { for (const e of eligible.filter(x=>selected.includes(x.worker.id))) await markBonusAwarded(base(e)); onClose(); } catch(err:any) { window.alert(err?.message || "Não foi possível registrar o bônus."); } finally { setBusy(false); } };
  const dismiss = async () => { setBusy(true); try { for (const e of eligible) await markBonusDismissed(base(e)); onClose(); } catch(err:any) { window.alert(err?.message || "Não foi possível registrar a decisão."); } finally { setBusy(false); } };
  const bonusValue = eligible[0]?.amount ?? 0;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-4"><Card className="w-full max-w-md p-5"><p className="text-lg font-bold">Parabéns, você atingiu a meta!</p><p className="mt-1 text-sm text-muted-foreground">A meta da semana foi atingida. Selecione os diaristas que vão receber o bônus de <strong>{brl(bonusValue)}</strong>. O valor será somado às diárias e entrará no próximo pagamento.</p><div className="mt-4 space-y-2">{eligible.map(e=><button key={e.worker.id} type="button" onClick={()=>toggle(e.worker.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${selected.includes(e.worker.id)?"border-primary bg-primary/10":"border-border"}`}><span><strong>{e.worker.full_name}</strong><span className="block text-xs text-muted-foreground">Presença OK · Bônus {brl(e.amount)}</span></span><span className="text-sm font-bold">{selected.includes(e.worker.id)?"✓":"○"}</span></button>)}</div><div className="mt-4 grid grid-cols-1 gap-2"><Button disabled={!selected.length||busy} onClick={save}>{busy?"Salvando...":`Pagar bônus selecionado(s) (${selected.length})`}</Button><Button variant="outline" disabled={busy} onClick={dismiss}>Não pagar bônus para ninguém</Button><Button variant="ghost" disabled={busy} onClick={onClose}>Decidir depois</Button></div></Card></div>;
}

export function WeekBonusCard({ w }: { w: WeekBonusEval }) {
  const [open, setOpen] = useState(false);
  const divergent = w.workers.some((e) => e.divergent);
  return (
    <div className="rounded-xl border p-3">
      <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOpen(!open)}>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Semana {w.week.week_number} <span className="font-normal text-muted-foreground">{dm(w.week.start_date)} a {dm(w.week.end_date)}</span></p>
          <p className="text-xs text-muted-foreground">Meta {fm(w.target)} m² · Realizado {fm(w.realized)} m² · {w.percent.toFixed(0)}%</p>
          <p className="mt-1 text-xs"><Award className="mr-1 inline size-3.5 text-primary" />{w.goalMet ? `${w.eligible} diarista(s) elegível(is) · ${brl(w.total)} em bônus` : `Bônus: ${brl(0)}`}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={w.goalMet ? "success" : "warning"}>{w.goalMet ? "META BATIDA" : "NÃO BATIDA"}</Badge>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>
      {divergent ? <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-destructive"><AlertTriangle className="size-3.5" />Divergência: um bônus pago não corresponde mais ao cálculo atual. Revise manualmente.</p> : null}
      {open ? (
        <div className="mt-3 space-y-2">
          {w.workers.length ? w.workers.map((e) => (
            <div key={e.worker.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-muted/40 p-2 text-xs">
              <div className="min-w-0">
                <p className="break-words font-semibold">{e.worker.full_name}</p>
                <p className="text-muted-foreground">
                  {e.presenceOk ? "Presença OK" : e.absences ? `${e.absences} falta(s)` : "Sem presença"} · {w.goalMet ? "Meta batida" : "Meta não batida"} · <strong>{brl(e.amount)}</strong>{e.paid?.status === "bonificado" ? " · Bônus selecionado" : ""}
                  {e.teamName ? ` · ${e.teamName}` : ""}
                </p>
                {e.divergent ? <p className="font-semibold text-destructive">Pago {brl(Number(e.paid?.amount))}, cálculo atual {brl(e.amount)}</p> : null}
              </div>
              <PayButton w={w} e={e} />
            </div>
          )) : <p className="text-xs text-muted-foreground">Nenhum diarista com ponto nesta semana.</p>}
        </div>
      ) : null}
    </div>
  );
}

export function BonusHistory() {
  const evals = useBonusEvaluations();
  const { bonusTableMissing } = useStore();
  const months = useMemo(() => {
    const g = new Map<string, WeekBonusEval[]>();
    evals.forEach((w) => { const m = w.week.start_date.slice(0, 7); g.set(m, [...(g.get(m) || []), w]); });
    return [...g.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [evals]);
  const byWorker = bonusByWorker(evals);
  return (
    <>
      {bonusTableMissing ? <Card className="mb-4"><p className="text-xs text-destructive">A tabela de bônus ainda não existe no banco. O cálculo aparece normalmente, mas para marcar como pago é preciso rodar o SQL do bônus no Supabase.</p></Card> : null}
      <Card className="mb-4">
        <SectionTitle title="Bônus por diarista" hint="Acumulado de semanas encerradas" />
        {byWorker.length ? <div className="space-y-1.5">{byWorker.map((x) => (
          <div key={x.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 break-words font-semibold">{x.name}</span><span className="shrink-0 text-right">Acumulado {brl(x.earned)} · <span className={x.pending ? "font-bold text-destructive" : ""}>Pendente {brl(x.pending)}</span></span></div>
        ))}</div> : <EmptyState text="Nenhum bônus ainda." />}
      </Card>
      <Card className="mb-4">
        <SectionTitle title="Histórico de bônus" hint="Todos os meses com meta" />
        {months.length ? <div className="space-y-3">{months.map(([m, ws]) => (
          <div key={m}>
            <p className="text-sm font-bold capitalize">{monthName(m)}</p>
            {ws.map((w) => <p key={w.week.id} className="flex justify-between text-xs"><span>Semana {w.week.week_number}{w.finished ? "" : " (em andamento)"}</span><span>{brl(w.total)}</span></p>)}
            <p className="mt-1 flex justify-between border-t pt-1 text-xs font-bold"><span>Total de bônus</span><span>{brl(ws.reduce((s, w) => s + w.total, 0))}</span></p>
          </div>
        ))}</div> : <EmptyState text="Sem histórico." />}
      </Card>
    </>
  );
}

export function DashboardBonus() {
  const evals = useBonusEvaluations();
  const month = toISO(new Date()).slice(0, 7);
  const monthWeeks = evals.filter((w) => w.week.start_date.startsWith(month));
  const total = monthWeeks.reduce((s, w) => s + w.total, 0);
  const met = monthWeeks.filter((w) => w.goalMet).length;
  const awarded = new Set(monthWeeks.flatMap((w) => w.workers.filter((e) => e.amount > 0).map((e) => e.worker.id))).size;
  const byWorker = bonusByWorker(evals).slice(0, 6);
  return (
    <Card className="mb-4">
      <SectionTitle title="Bônus de metas" hint="Mês atual" />
      <div className="mb-3 grid grid-cols-3 gap-2">
        <StatCard label="Bônus no mês" value={brl(total)} tone="success" icon={<Award className="size-4" />} />
        <StatCard label="Metas batidas" value={String(met)} tone="info" icon={<Award className="size-4" />} />
        <StatCard label="Premiados" value={String(awarded)} tone="info" icon={<Award className="size-4" />} />
      </div>
      {byWorker.map((x) => <p key={x.id} className="flex justify-between gap-2 text-xs"><span className="min-w-0 break-words">{x.name}</span><span className="shrink-0">Acumulado {brl(x.earned)} · pendente {brl(x.pending)}</span></p>)}
    </Card>
  );
}
