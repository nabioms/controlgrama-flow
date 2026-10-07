import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Badge, Button, Card, EmptyState } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { brl, businessDay, formatDate, initials, toISO } from "@/lib/format";
import type { Attendance, PaymentMethod, Worker } from "@/lib/types";

export const Route = createFileRoute("/diarias")({
  head: () => ({
    meta: [
      { title: "Diárias — ControlGrama" },
      {
        name: "description",
        content: "Controle de dias trabalhados e valores a receber de cada diarista.",
      },
    ],
  }),
  component: DiariasPage,
});

const pad = (value: number) => String(value).padStart(2, "0");

const monthToDate = (month: string, day: number) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}-${pad(monthNumber)}-${pad(day)}`;
};

const shiftMonth = (month: string, amount: number) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const d = new Date(year, monthNumber - 1 + amount, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const monthTitle = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
};

const nextMonth = (month: string) => shiftMonth(month, 1);

const dateShift = (iso: string, amount: number) => {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + amount);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fifthBusinessDay = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return businessDay(year, monthNumber, 5);
};

/** Único ciclo: próximo 5º dia útil (a partir de hoje). Acumula tudo que está em aberto até o dia anterior. */
const nextPayCycle = () => {
  const today = toISO(new Date());
  let payDate = fifthBusinessDay(today.slice(0, 7));
  if (payDate < today) payDate = fifthBusinessDay(nextMonth(today.slice(0, 7)));
  return { key: "fifth", cycle: "quinto_dia_util" as const, label: "5º dia útil", payDate, end: dateShift(payDate, -1) };
};

const isWorked = (row?: Attendance) => row?.status === "presente";

function DiariasPage() {
  const { workers, attendance, payments, paymentPeriods, weeklyBonuses, setAttendanceStatus, updateAttendanceAmount, markAttendancePaid, deleteAttendance, closePaymentCycle, markPaymentPaid } = useStore();
  const [month, setMonth] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [payingPaymentId, setPayingPaymentId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [dailyPaymentMethod, setDailyPaymentMethod] = useState<PaymentMethod>("pix");
  const [payingAttendanceId, setPayingAttendanceId] = useState<string | null>(null);
  const [dailyAmountInput, setDailyAmountInput] = useState("");
  const [savingDailyAmount, setSavingDailyAmount] = useState(false);
  const calendarTouchStartX = useRef<number | null>(null);

  const availableMonths = useMemo(() => {
    const currentMonth = toISO(new Date()).slice(0, 7);
    const historicalMonths = [
      ...attendance.map((row) => String(row.date).slice(0, 7)),
      ...paymentPeriods.map((period) => String(period.start_date).slice(0, 7)),
    ].filter((value) => /^\d{4}-\d{2}$/.test(value) && value <= currentMonth);
    const startMonth = historicalMonths.sort()[0] ?? currentMonth;
    const months: string[] = [];
    let cursor = startMonth;
    while (cursor <= currentMonth) {
      months.push(cursor);
      cursor = shiftMonth(cursor, 1);
    }
    return months.reverse();
  }, [attendance, paymentPeriods]);

  useEffect(() => {
    const now = toISO(new Date());
    setMonth(now.slice(0, 7));
  }, []);

  // Situação de pagamento de cada diária: baixa individual ou incluída em um fechamento.
  const rowPaymentStatus = (workerId: string, row: Attendance) => {
    if (row.paid_at) return { paid: true, label: `Paga em ${formatDate(row.paid_at)}` };
    const covering = paymentPeriods
      .filter((p) => row.date >= p.start_date && row.date <= p.end_date)
      .map((p) => payments.find((x) => x.period_id === p.id && x.worker_id === workerId))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    const paidPayment = covering.find((x) => x.status === "pago");
    if (paidPayment) return { paid: true, label: paidPayment.paid_at ? `Paga em ${formatDate(paidPayment.paid_at)}` : "Paga" };
    const payment = covering[0];
    if (payment) return { paid: false, label: "Fechada · aguardando pagamento" };
    return { paid: false, label: "Pendente" };
  };

  const attendanceAmount = (worker: Worker, row: Attendance) => {
    const custom = row.daily_amount == null || String(row.daily_amount) === "" ? NaN : Number(row.daily_amount);
    return Number.isFinite(custom) ? custom : Number(worker.daily_rate ?? 0) * Number(row.work_fraction ?? 1);
  };

  const attendanceByWorker = useMemo(() => {
    const map = new Map<string, Attendance[]>();
    attendance.forEach((row) => {
      const rows = map.get(row.worker_id) ?? [];
      rows.push(row);
      map.set(row.worker_id, rows);
    });
    return map;
  }, [attendance]);

  const bonusByWorker = useMemo(() => {
    const map = new Map<string, number>();
    weeklyBonuses.filter((b) => b.status === "bonificado").forEach((b) => {
      map.set(b.worker_id, Math.round(((map.get(b.worker_id) ?? 0) + Number(b.amount || 0)) * 100) / 100);
    });
    return map;
  }, [weeklyBonuses]);

  const openBonusRows = (worker: Worker) =>
    weeklyBonuses.filter((b) => b.worker_id === worker.id && b.status === "bonificado");

  /** Todas as diárias trabalhadas e ainda não pagas, de qualquer mês. */
  const openRows = (worker: Worker) =>
    (attendanceByWorker.get(worker.id) ?? []).filter((row) => isWorked(row) && !rowPaymentStatus(worker.id, row).paid);
  const openByMonth = (worker: Worker) => {
    const map = new Map<string, number>();
    openRows(worker).forEach((row) => map.set(row.date.slice(0, 7), (map.get(row.date.slice(0, 7)) ?? 0) + attendanceAmount(worker, row)));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ month: m, amount: Math.round(v * 100) / 100 }));
  };

  // Mês em que cada trabalhador tem registro (pela data real da diária, nunca pela data do pagamento).
  const monthsByWorker = useMemo(() => {
    const map = new Map<string, Set<string>>();
    attendance.forEach((row) => {
      const set = map.get(row.worker_id) ?? new Set<string>();
      set.add(String(row.date).slice(0, 7));
      map.set(row.worker_id, set);
    });
    return map;
  }, [attendance]);
  const hasRecordIn = (workerId: string) => Boolean(month && monthsByWorker.get(workerId)?.has(month));

  const diaristas = useMemo(
    () =>
      workers.filter(
        (worker) =>
          worker.employment_type === "diarista" &&
          (worker.status !== "desligado" || hasRecordIn(worker.id) || (attendanceByWorker.get(worker.id) ?? []).some((row) => isWorked(row) && !rowPaymentStatus(worker.id, row).paid)),
      ),
    [workers, month, monthsByWorker, attendanceByWorker, payments, paymentPeriods],
  );

  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId) ?? null;

  const getMonthRows = (worker: Worker, targetMonth: string) =>
    (attendanceByWorker.get(worker.id) ?? []).filter(
      (row) => row.date.startsWith(targetMonth) && isWorked(row),
    );

  const monthData = useMemo(() => {
    if (!month) return [];
    return diaristas.map((worker) => {
      const rows = getMonthRows(worker, month);
      const days = rows.reduce((sum, row) => sum + Number(row.work_fraction ?? 1), 0);
      return {
        worker,
        rows,
        days,
        amount: Math.round((openRows(worker).reduce((sum, row) => sum + attendanceAmount(worker, row), 0) + (bonusByWorker.get(worker.id) ?? 0)) * 100) / 100,
        bonusAmount: bonusByWorker.get(worker.id) ?? 0,
        total: Math.round(rows.reduce((sum, row) => sum + attendanceAmount(worker, row), 0) * 100) / 100,
      };
    });
  }, [month, diaristas, attendanceByWorker, paymentPeriods, payments, bonusByWorker]);

  // Funcionários fixos com registro de ponto ou pagamento referente ao mês selecionado.
  const fixedData = useMemo(() => {
    if (!month) return [];
    return workers
      .filter((worker) => worker.employment_type === "contratado")
      .map((worker) => {
        const rows = (attendanceByWorker.get(worker.id) ?? []).filter((row) => row.date.startsWith(month));
        const monthPayments = payments.filter((payment) => {
          if (payment.worker_id !== worker.id) return false;
          const period = paymentPeriods.find((p) => p.id === payment.period_id);
          return period ? period.start_date.slice(0, 7) <= month && period.end_date.slice(0, 7) >= month : false;
        });
        return {
          worker,
          rows,
          monthPayments,
          worked: rows.filter(isWorked).reduce((sum, row) => sum + Number(row.work_fraction ?? 1), 0),
          absences: rows.filter((row) => row.status !== "presente").length,
        };
      })
      .filter((item) => item.worker.status !== "desligado" || item.rows.length > 0 || item.monthPayments.length > 0);
  }, [month, workers, attendanceByWorker, payments, paymentPeriods]);

  const renderMonthRecords = (worker: Worker, rows: Attendance[]) => {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    if (!sorted.length) return <p className="py-1 text-[11px] text-muted-foreground">Nenhuma diária lançada neste mês.</p>;
    return (
      <div className="divide-y divide-border">
        {sorted.map((row) => {
          const status = rowPaymentStatus(worker.id, row);
          const fraction = Number(row.work_fraction ?? 1);
          const custom = row.daily_amount != null && String(row.daily_amount) !== "";
          return (
            <div key={row.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
              <span className="w-12 shrink-0 font-semibold">{formatDate(row.date).slice(0, 5)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {fraction === 0.5 ? "½ diária" : "Diária"}{custom ? " · valor personalizado" : ""}
              </span>
              <span className="shrink-0 font-semibold">{brl(attendanceAmount(worker, row))}</span>
              <Badge tone={status.paid ? "success" : "warning"} className="shrink-0">{status.label}</Badge>
            </div>
          );
        })}
      </div>
    );
  };

  const totalOpen = monthData.reduce((sum, row) => sum + row.amount, 0);
  const fixedOpen = payments
    .filter((p) => p.status === "pendente" && workers.find((w) => w.id === p.worker_id)?.employment_type === "contratado")
    .reduce((sum, p) => sum + Number(p.gross_amount), 0);

  const detail = useMemo(() => {
    if (!selectedWorker || !month) return null;

    const allRows = (attendanceByWorker.get(selectedWorker.id) ?? []).filter(
      (row) => row.date.startsWith(month),
    );
    const rows = openRows(selectedWorker);
    const rowMap = new Map(allRows.map((row) => [row.date, row]));
    const next = nextPayCycle();
    const bonusRows = openBonusRows(selectedWorker);\n    const bonusAmount = bonusRows.reduce((sum,b) => sum + Number(b.amount || 0), 0);
    const earliest = [...rows].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? next.end;
    const cycles = [{ ...next, start: earliest < next.end ? earliest : next.end }];

    const sumRows = (items: Attendance[]) => {
      const days = items.reduce((sum, row) => sum + Number(row.work_fraction ?? 1), 0);
      return {
        days,
        amount: Math.round(items.reduce((sum, row) => sum + attendanceAmount(selectedWorker, row), 0) * 100) / 100,
      };
    };

    const cycleData = cycles
      .map((cycle) => ({
        ...cycle,
        rows: rows.filter((row) => row.date <= cycle.end),\n        bonusRows,
      }))
      .map((cycle) => ({
        ...cycle,
        ...sumRows(cycle.rows),\n        bonusAmount,\n        amount: Math.round((sumRows(cycle.rows).amount + bonusAmount) * 100) / 100,
      }));

    const daysInMonth = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0,
    ).getDate();

    const [year, monthNumber] = month.split("-").map(Number);
    const firstWeekday = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;

    return {
      rowMap,
      rows,
      cycles: cycleData,
      totalDays: sumRows(rows).days,
      totalAmount: Math.round((sumRows(rows).amount + bonusAmount) * 100) / 100,\n      bonusAmount,
      byMonth: openByMonth(selectedWorker),
      daysInMonth,
      firstWeekday,
    };
  }, [selectedWorker, month, attendanceByWorker, payments, paymentPeriods, weeklyBonuses]);

  if (!month) {
    return (
      <AppShell title="Diárias" subtitle="Carregando calendário...">
        <Card>{null}</Card>
      </AppShell>
    );
  }

  if (selectedWorker && detail) {
    return (
      <AppShell title="Diárias" subtitle={selectedWorker.full_name}>
        <button
          type="button"
          onClick={() => setSelectedWorkerId(null)}
          className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="size-4" /> Voltar para diaristas
        </button>

        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <Avatar text={initials(selectedWorker.full_name)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{selectedWorker.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedWorker.job_role} · {brl(selectedWorker.daily_rate ?? 0)} por dia
              </p>
            </div>
            <Badge tone="success">ativo</Badge>
          </div>
        </Card>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Card className="p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Dias em aberto</p>
            <p className="font-display text-2xl font-semibold">
              {detail.totalDays.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total a pagar</p>
            <p className="font-display text-2xl font-semibold text-primary-deep">{brl(detail.totalAmount)}</p>
          </Card>
        </div>
        {detail.bonusAmount > 0 ? (
          <Card className="mb-4 border-primary/30 bg-primary/5 p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Bônus de meta</p>
            <p className="mt-1 font-display text-xl font-semibold text-primary-deep">{brl(detail.bonusAmount)}</p>
            <p className="text-[11px] text-muted-foreground">Bônus selecionados e ainda não pagos. Entram no próximo pagamento.</p>
          </Card>
        ) : null}
        {detail.byMonth.length ? (
          <Card className="mb-4 p-3">
            <p className="text-xs font-semibold">Em aberto por mês (todos os meses)</p>
            <div className="mt-1 divide-y divide-border">
              {detail.byMonth.map((m) => (
                <div key={m.month} className="flex justify-between py-1.5 text-xs">
                  <span className="capitalize">{monthTitle(m.month)}</span>
                  <span className="font-semibold">{brl(m.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <div className="mb-4 space-y-2">
          {detail.cycles.map((cycle) => {
            const period = paymentPeriods.find(
              (p) =>
                p.cycle === "quinto_dia_util" && p.pay_date === cycle.payDate,
            );
            const workerPayment = period
              ? payments.find((p) => p.period_id === period.id && p.worker_id === selectedWorker.id)
              : null;
            const cyclePaid = workerPayment?.status === "pago";
            const cyclePending = workerPayment?.status === "pendente";

            return (
              <Card key={cycle.key} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {cycle.label} · {formatDate(cycle.payDate)}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      Período: {formatDate(cycle.start)} a {formatDate(cycle.end)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cycle.days.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias em aberto até {formatDate(cycle.end)}{cycle.bonusAmount > 0 ? ` · Bônus ${brl(cycle.bonusAmount)}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-xl font-semibold text-primary-deep">{brl(cycle.amount)}</p>
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  {!period ? (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Pagamento ainda não fechado</p>
                        <p className="text-[10px] text-muted-foreground">Gera o registro deste período para controlar a baixa.</p>
                      </div>
                      <Button
                        variant="soft"
                        className="shrink-0"
                        disabled={cycle.days <= 0}
                        onClick={async () => {
                          setPaymentError(null);
                          try {
                            await closePaymentCycle({
                              cycle: cycle.cycle,
                              label: cycle.label,
                              start_date: cycle.start,
                              end_date: cycle.end,
                              pay_date: cycle.payDate,
                            });
                          } catch (error) {
                            setPaymentError(error instanceof Error ? error.message : "Não foi possível fechar o pagamento.");
                          }
                        }}
                      >
                        Fechar pagamento
                      </Button>
                    </div>
                  ) : cyclePaid ? (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-primary">✓ Pago</p>
                        <p className="text-[10px] text-muted-foreground">
                          {workerPayment?.paid_at ? "Pago em " + formatDate(workerPayment.paid_at) : "Pagamento registrado"}
                          {workerPayment?.method ? " · " + (workerPayment.method === "pix" ? "PIX" : workerPayment.method === "dinheiro" ? "Dinheiro" : "Transferência") : ""}
                        </p>
                      </div>
                      <Badge tone="success">Pago</Badge>
                    </div>
                  ) : cyclePending ? (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-amber-700">Pagamento pendente</p>
                          <p className="text-[10px] text-muted-foreground">Marque como pago somente após realizar o pagamento.</p>
                        </div>
                        <Badge tone="warning">Pendente</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1">
                        {(["pix", "dinheiro", "transferencia"] as PaymentMethod[]).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${paymentMethod === method ? "border-primary bg-primary-soft text-primary-deep" : "border-border bg-card text-muted-foreground"}`}
                          >
                            {method === "pix" ? "PIX" : method === "dinheiro" ? "Dinheiro" : "Transferência"}
                          </button>
                        ))}
                      </div>
                      <Button
                        variant="primary"
                        className="mt-2 w-full"
                        disabled={payingPaymentId === workerPayment.id}
                        onClick={async () => {
                          setPaymentError(null);
                          setPayingPaymentId(workerPayment.id);
                          try {
                            await markPaymentPaid(workerPayment.id, paymentMethod);
                          } catch (error) {
                            setPaymentError(error instanceof Error ? error.message : "Não foi possível registrar o pagamento.");
                          } finally {
                            setPayingPaymentId(null);
                          }
                        }}
                      >
                        {payingPaymentId === workerPayment.id ? "Registrando..." : "Dar baixa — pagamento realizado"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Sem lançamento de pagamento para este período.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        {paymentError ? <p className="mb-4 text-xs font-medium text-destructive">{paymentError}</p> : null}

        <Card className="mb-4 p-3">
          <p className="text-sm font-semibold">Diárias de {monthTitle(month)}</p>
          <p className="mb-2 text-[11px] text-muted-foreground">Todas as diárias trabalhadas neste mês, pagas ou não.</p>
          {renderMonthRecords(selectedWorker, (attendanceByWorker.get(selectedWorker.id) ?? []).filter((row) => row.date.startsWith(month) && isWorked(row)))}
        </Card>

        <Card className="mb-4 p-3">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Calendário de trabalho</p>
              <p className="text-[11px] text-muted-foreground">Azul = realizada · Verde = paga · Vermelho = falta.</p>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 p-2">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition active:scale-95"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-bold capitalize">{monthTitle(month)}</p>
              <p className="text-[10px] text-muted-foreground">Deslize o calendário para trocar o mês</p>
            </div>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition active:scale-95"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div
            className="touch-pan-y"
            onTouchStart={(event) => {
              calendarTouchStartX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const startX = calendarTouchStartX.current;
              const endX = event.changedTouches[0]?.clientX;
              calendarTouchStartX.current = null;
              if (startX == null || endX == null) return;
              const deltaX = endX - startX;
              if (Math.abs(deltaX) < 50) return;
              setMonth((current) => shiftMonth(current, deltaX < 0 ? 1 : -1));
            }}
          >

          <div className="mb-2 grid grid-cols-7 text-center text-[9px] font-semibold uppercase text-muted-foreground">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: detail.firstWeekday }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-14 rounded-lg bg-muted/30" />
            ))}
            {Array.from({ length: detail.daysInMonth }, (_, index) => {
              const day = index + 1;
              const iso = monthToDate(month, day);
              const row = detail.rowMap.get(iso);
              const fraction = Number(row?.work_fraction ?? 1);
              const worked = isWorked(row);
              const absent = row?.status === "falta";
              const amount = worked ? attendanceAmount(selectedWorker, row!) : 0;
              const paidDay = Boolean(row && worked && rowPaymentStatus(selectedWorker.id, row).paid);

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => { setEditingDate(iso); setDailyAmountInput(row?.daily_amount != null ? String(row.daily_amount) : String((selectedWorker.daily_rate ?? 0) * fraction)); setDeleteError(null); }}
                  className={`min-h-14 min-w-0 overflow-hidden rounded-lg border p-1.5 text-left ${
                    worked
                      ? paidDay
                        ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30"
                        : "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                      : absent
                        ? "border-destructive bg-destructive/10"
                        : "border-border bg-card"
                  }`}
                  title={worked ? (paidDay ? "Diária paga" : "Diária realizada — pendente") : absent ? "Falta registrada" : "Lançar diária"}
                >
                  <p className="text-[10px] font-semibold">{day}</p>
                  {worked ? (
                    paidDay ? (
                      <>
                        <p className="mt-1 truncate text-[8px] font-bold text-emerald-700 dark:text-emerald-300">Pago</p>
                        <p className="max-w-full truncate text-[8px] font-semibold leading-tight text-emerald-700 dark:text-emerald-300">{brl(amount)}</p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 truncate text-[8px] font-semibold leading-tight text-blue-700 dark:text-blue-300">
                          {fraction === 0.5 ? "½ dia" : "dia"}
                        </p>
                        <p className="max-w-full truncate text-[8px] font-semibold leading-tight text-blue-700 dark:text-blue-300" title={brl(amount)}>
                          {brl(amount)}
                        </p>
                      </>
                    )
                  ) : absent ? (
                    <p className="mt-2 truncate text-[9px] font-bold text-destructive">Falta</p>
                  ) : (
                    <p className="mt-2 text-[9px] text-muted-foreground">—</p>
                  )}
                </button>
              );
            })}
          </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          Dia integral = 100% da diária. Meio período = 50%. Falta, falta justificada e atestado = R$ 0.
        </p>

        <Card className="mt-4 p-3">
          {(() => {
            const paidPeriodTotal = payments
              .filter((p) => p.worker_id === selectedWorker.id && p.status === "pago")
              .reduce((sum, p) => sum + Number(p.gross_amount || 0), 0);
            const paidDailyTotal = attendance
              .filter((row) => row.worker_id === selectedWorker.id && row.status === "presente" && row.paid_at)
              .reduce((sum, row) => sum + attendanceAmount(selectedWorker, row), 0);
            const accumulatedTotal = paidPeriodTotal + paidDailyTotal;
            return (
              <>
                <p className="text-sm font-semibold">Histórico de pagamentos</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Histórico acumulado deste diarista. Os pagamentos anteriores continuam registrados mesmo após virar o mês.</p>
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Total pago acumulado</p>
                  <p className="mt-0.5 text-xl font-bold text-emerald-700 dark:text-emerald-300">{brl(accumulatedTotal)}</p>
                </div>
                <div className="mt-3 space-y-2">
                  {payments
              .filter((p) => p.worker_id === selectedWorker.id && p.status === "pago")
              .sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")))
              .map((p) => {
                const period = paymentPeriods.find((item) => item.id === p.period_id);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{period?.label || "Pagamento de diária"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {period ? formatDate(period.start_date) + " a " + formatDate(period.end_date) : "Período não informado"}
                        {p.paid_at ? " · pago em " + formatDate(p.paid_at) : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-primary-deep">{brl(p.gross_amount)}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {p.method === "pix" ? "PIX" : p.method === "dinheiro" ? "Dinheiro" : "Transferência"}
                      </p>
                    </div>
                  </div>
                );
              })}
            {attendance
              .filter((row) => row.worker_id === selectedWorker.id && row.status === "presente" && row.paid_at)
              .sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")))
              .map((row) => {
                const amount = attendanceAmount(selectedWorker, row);
                return (
                  <div key={`daily-${row.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary-soft p-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">Diária individual · {formatDate(row.date)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Baixada em {formatDate(row.paid_at!)}{row.payment_method ? " · " + (row.payment_method === "pix" ? "PIX" : row.payment_method === "dinheiro" ? "Dinheiro" : "Transferência") : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-primary-deep">{brl(amount)}</p>
                  </div>
                );
              })}
                  {!payments.some((p) => p.worker_id === selectedWorker.id && p.status === "pago") && !attendance.some((row) => row.worker_id === selectedWorker.id && row.status === "presente" && row.paid_at) ? (
                    <p className="py-2 text-[11px] text-muted-foreground">Nenhum pagamento baixado ainda.</p>
                  ) : null}
                </div>
              </>
            );
          })()}
        </Card>

        {editingDate ? (
          <Card className="mt-4 p-3">
            {(() => {
              const current = detail.rowMap.get(editingDate);
              const currentFraction = Number(current?.work_fraction ?? 1);
              const workedNow = current?.status === "presente";
              return (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Editar diária</p>
                      <p className="text-xs text-muted-foreground">{formatDate(editingDate)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditingDate(null); setDeleteError(null); }}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Fechar
                    </button>
                  </div>
                  {workedNow ? (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                      <p className="text-xs font-semibold">Valor desta diária</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Altere somente esta data. A diária padrão de {brl(selectedWorker.daily_rate ?? 0)} continua igual para os outros dias.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm font-semibold">R$</span>
                        <input
                          inputMode="decimal"
                          value={dailyAmountInput}
                          onChange={(e) => setDailyAmountInput(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}
                          disabled={Boolean(current?.paid_at) || savingDailyAmount}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                        />
                        <Button
                          variant="primary"
                          disabled={Boolean(current?.paid_at) || savingDailyAmount}
                          onClick={async () => {
                            const amount = Number(dailyAmountInput);
                            if (!Number.isFinite(amount) || amount < 0) {
                              setDeleteError("Informe um valor válido para a diária.");
                              return;
                            }
                            setSavingDailyAmount(true);
                            setDeleteError(null);
                            try {
                              await updateAttendanceAmount(current.id, amount);
                            } catch (error) {
                              setDeleteError(error instanceof Error ? error.message : "Não foi possível alterar o valor da diária.");
                            } finally {
                              setSavingDailyAmount(false);
                            }
                          }}
                        >
                          {savingDailyAmount ? "Salvando..." : "Salvar valor"}
                        </Button>
                      </div>
                      {current?.paid_at ? (
                        <p className="mt-2 text-[10px] font-medium text-amber-700">Esta diária já foi paga e não pode ter o valor alterado.</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant={workedNow && currentFraction === 1 ? "primary" : "soft"}
                      onClick={async () => {
                        await setAttendanceStatus(selectedWorker.id, editingDate, "presente", current?.notes ?? "", current?.contract_id ?? null, 1);
                        setEditingDate(null);
                      }}
                    >
                      Dia integral
                    </Button>
                    <Button
                      variant={workedNow && currentFraction === 0.5 ? "primary" : "soft"}
                      onClick={async () => {
                        await setAttendanceStatus(selectedWorker.id, editingDate, "presente", current?.notes ?? "", current?.contract_id ?? null, 0.5);
                        setEditingDate(null);
                      }}
                    >
                      Meio período
                    </Button>
                  </div>
                  <Button
                    variant="soft"
                    className="mt-2 w-full"
                    onClick={async () => {
                      await setAttendanceStatus(selectedWorker.id, editingDate, "falta", current?.notes ?? "", current?.contract_id ?? null, 0);
                      setEditingDate(null);
                    }}
                  >
                    Marcar como falta
                  </Button>
                  {workedNow && !current?.paid_at ? (
                    <>
                      <div className="mt-3 rounded-lg border border-border bg-muted/20 p-2">
                        <p className="text-[11px] font-semibold">Baixar esta diária individual</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Use quando o diarista receber antecipadamente esta diária. Ela será descontada do próximo fechamento.
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-1">
                          {(["pix", "dinheiro", "transferencia"] as PaymentMethod[]).map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setDailyPaymentMethod(method)}
                              className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${dailyPaymentMethod === method ? "border-primary bg-primary-soft text-primary-deep" : "border-border bg-card text-muted-foreground"}`}
                            >
                              {method === "pix" ? "PIX" : method === "dinheiro" ? "Dinheiro" : "Transferência"}
                            </button>
                          ))}
                        </div>
                        <Button
                          variant="primary"
                          className="mt-2 w-full"
                          disabled={payingAttendanceId === current.id}
                          onClick={async () => {
                            setDeleteError(null);
                            setPayingAttendanceId(current.id);
                            try {
                              await markAttendancePaid(current.id, dailyPaymentMethod);
                              setEditingDate(null);
                            } catch (error) {
                              setDeleteError(error instanceof Error ? error.message : "Não foi possível registrar a baixa da diária.");
                            } finally {
                              setPayingAttendanceId(null);
                            }
                          }}
                        >
                          {payingAttendanceId === current.id ? "Registrando..." : `Dar baixa nesta diária — ${brl(current ? attendanceAmount(selectedWorker, current) : 0)}`}
                        </Button>
                      </div>
                    </>
                  ) : null}
                  {workedNow && current?.paid_at ? (
                    <div className="mt-3 rounded-lg border border-primary bg-primary-soft p-2">
                      <p className="text-xs font-semibold text-primary-deep">✓ Diária paga antecipadamente</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Pago em {formatDate(current.paid_at)}{current.payment_method ? " · " + (current.payment_method === "pix" ? "PIX" : current.payment_method === "dinheiro" ? "Dinheiro" : "Transferência") : ""}
                      </p>
                    </div>
                  ) : null}
                  {current ? (
                    <Button
                      variant="soft"
                      className="mt-2 w-full text-destructive"
                      onClick={async () => {
                        setDeleteError(null);
                        try {
                          await deleteAttendance(current.id);
                          setEditingDate(null);
                        } catch (error) {
                          setDeleteError(error instanceof Error ? error.message : "Não foi possível apagar o lançamento.");
                        }
                      }}
                    >
                      <Trash2 className="size-4" /> Apagar lançamento
                    </Button>
                  ) : null}
                  {deleteError ? (
                    <p className="mt-2 text-[11px] font-medium text-destructive">{deleteError}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Toque em um dia do calendário para editar ou lançar a diária.
                  </p>
                </>
              );
            })()}
          </Card>
        ) : null}
      </AppShell>
    );
  }

  return (
    <AppShell title="Diárias" subtitle="Controle dos dias trabalhados">
      <Card className="mb-4 p-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase text-primary-deep">Folha de diárias</p>
            <p className="text-sm font-semibold capitalize">{monthTitle(month)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Total de diárias em aberto</p>
            <p className="text-sm font-bold text-primary-deep">{brl(totalOpen)}</p>
            {fixedOpen > 0 ? <p className="text-[10px] text-muted-foreground">Fixos pendentes: {brl(fixedOpen)}</p> : null}
          </div>
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <label htmlFor="diarias-list-month" className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Mês do histórico</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              disabled={month === availableMonths[availableMonths.length - 1]}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <select
              id="diarias-list-month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold capitalize outline-none focus:border-primary"
            >
              {availableMonths.map((item) => (
                <option key={item} value={item}>{monthTitle(item)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={month === availableMonths[0]}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Selecione qualquer mês que tenha histórico de diárias.</p>
        </div>
      </Card>

      <div className="mb-3">
        <p className="text-sm font-semibold">Seus diaristas</p>
        <p className="text-xs text-muted-foreground">Toque no nome para abrir o calendário e os valores de cada dia.</p>
      </div>

      {diaristas.length === 0 ? (
        <EmptyState text="Nenhum diarista ativo cadastrado." />
      ) : (
        <div className="space-y-2">
          {monthData.map((item) => (
            <button
              key={item.worker.id}
              type="button"
              onClick={() => setSelectedWorkerId(item.worker.id)}
              className="card-surface grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 p-3 text-left transition-transform active:scale-[0.99]"
            >
              <Avatar text={initials(item.worker.full_name)} />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold leading-tight">{item.worker.full_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.worker.job_role} · {item.days.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias trabalhados
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right">
                <p className="text-sm font-bold text-primary-deep">{brl(item.amount)}</p>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="col-start-2 col-end-4 text-[10px] leading-4 text-muted-foreground">
                Em aberto (todos os meses) · {brl(item.total)} em {monthTitle(month).split(" ")[0]}
              </p>
            </button>
          ))}
        </div>
      )}

      {monthData.some((item) => item.rows.length > 0) ? (
        <Card className="mt-4 p-3">
          <p className="text-sm font-semibold">Diárias lançadas em {monthTitle(month)}</p>
          <p className="mb-2 text-[11px] text-muted-foreground">Histórico permanente pela data trabalhada, mesmo que o pagamento tenha sido em outro mês.</p>
          <div className="space-y-3">
            {monthData.filter((item) => item.rows.length > 0).map((item) => (
              <div key={item.worker.id}>
                <p className="text-xs font-bold uppercase text-primary-deep">{item.worker.full_name}</p>
                {renderMonthRecords(item.worker, item.rows)}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mb-3 mt-5">
        <p className="text-sm font-semibold">Funcionários fixos</p>
        <p className="text-xs text-muted-foreground">Presenças e pagamentos referentes a {monthTitle(month)}.</p>
      </div>
      {fixedData.length === 0 ? (
        <EmptyState text="Nenhum funcionário fixo com registro neste mês." />
      ) : (
        <div className="space-y-2">
          {fixedData.map((item) => (
            <div key={item.worker.id} className="card-surface p-3">
              <div className="flex items-center gap-3">
                <Avatar text={initials(item.worker.full_name)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.worker.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.worker.job_role} · {item.worked.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias presentes · {item.absences} ausência(s)
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold">{brl(item.worker.salary ?? 0)}/mês</p>
              </div>
              {item.monthPayments.length ? (
                <div className="mt-2 divide-y divide-border border-t border-border">
                  {item.monthPayments.map((payment) => {
                    const period = paymentPeriods.find((p) => p.id === payment.period_id);
                    return (
                      <div key={payment.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                        <span className="min-w-0 flex-1 truncate">{period?.label ?? "Pagamento"}{period ? ` · ${formatDate(period.start_date)} a ${formatDate(period.end_date)}` : ""}</span>
                        <span className="shrink-0 font-semibold">{brl(payment.gross_amount)}</span>
                        <Badge tone={payment.status === "pago" ? "success" : "warning"}>
                          {payment.status === "pago" ? (payment.paid_at ? `Pago em ${formatDate(payment.paid_at)}` : "Pago") : "Pendente"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">Nenhum pagamento referente a este mês.</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Card className="mt-4 p-3">
        <p className="text-xs font-semibold">Como o pagamento é calculado</p>
        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          <p>• Pagamento único: todo 5º dia útil do mês.</p>
          <p>• Entram todas as diárias em aberto até o dia anterior ao pagamento, de qualquer mês.</p>
          <p>• Diária não paga continua no total em aberto até ser paga; o mês só filtra o histórico.</p>
          <p>• Dia integral = 1 diária · meio período = 0,5 diária.</p>
        </div>
      </Card>

      {payments.length > 0 ? (
        <Card className="mt-4 p-3">
          <p className="text-xs font-semibold">Controle de pagamentos</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {payments.filter((payment) => payment.status === "pago").length} pagamento(s) já baixado(s) · {payments.filter((payment) => payment.status === "pendente").length} pendente(s).
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Cada baixa fica registrada com data e forma de pagamento para consulta posterior.
          </p>
        </Card>
      ) : null}
    </AppShell>
  );
}
