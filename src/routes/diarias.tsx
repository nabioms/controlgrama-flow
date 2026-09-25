import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

const paymentCycles = (month: string) => {
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const fifthCurrent = fifthBusinessDay(month);
  const fifthNext = fifthBusinessDay(next);

  return [
    {
      key: "fifth-current",
      cycle: "quinto_dia_util" as const,
      label: "5º dia útil",
      payDate: fifthCurrent,
      start: monthToDate(previous, 21),
      end: dateShift(fifthCurrent, -1),
    },
    {
      key: "twentieth-current",
      cycle: "dia_20" as const,
      label: "Dia 20",
      payDate: monthToDate(month, 20),
      start: fifthCurrent,
      end: monthToDate(month, 19),
    },
    {
      key: "fifth-next",
      cycle: "quinto_dia_util" as const,
      label: "5º dia útil",
      payDate: fifthNext,
      start: monthToDate(month, 20),
      end: dateShift(fifthNext, -1),
    },
  ];
};

const isWorked = (row?: Attendance) => row?.status === "presente";

function DiariasPage() {
  const { workers, attendance, payments, paymentPeriods, setAttendanceStatus, deleteAttendance, closePaymentCycle, markPaymentPaid } = useStore();
  const [month, setMonth] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [payingPaymentId, setPayingPaymentId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    const now = toISO(new Date());
    setMonth(now.slice(0, 7));
  }, []);

  const diaristas = useMemo(
    () =>
      workers.filter(
        (worker) =>
          worker.status !== "desligado" && worker.employment_type === "diarista",
      ),
    [workers],
  );

  const selectedWorker = diaristas.find((worker) => worker.id === selectedWorkerId) ?? null;

  const attendanceByWorker = useMemo(() => {
    const map = new Map<string, Attendance[]>();
    attendance.forEach((row) => {
      const rows = map.get(row.worker_id) ?? [];
      rows.push(row);
      map.set(row.worker_id, rows);
    });
    return map;
  }, [attendance]);

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
        amount: Math.round(days * (worker.daily_rate ?? 0) * 100) / 100,
      };
    });
  }, [month, diaristas, attendanceByWorker]);

  const totalMonth = monthData.reduce((sum, row) => sum + row.amount, 0);

  const detail = useMemo(() => {
    if (!selectedWorker || !month) return null;

    const allRows = (attendanceByWorker.get(selectedWorker.id) ?? []).filter(
      (row) => row.date.startsWith(month),
    );
    const rows = allRows.filter(isWorked);
    const rowMap = new Map(allRows.map((row) => [row.date, row]));
    const cycles = paymentCycles(month);

    const sumRows = (items: Attendance[]) => {
      const days = items.reduce((sum, row) => sum + Number(row.work_fraction ?? 1), 0);
      return {
        days,
        amount: Math.round(days * (selectedWorker.daily_rate ?? 0) * 100) / 100,
      };
    };

    const cycleData = cycles
      .map((cycle) => ({
        ...cycle,
        rows: rows.filter((row) => row.date >= cycle.start && row.date <= cycle.end),
      }))
      .map((cycle) => ({
        ...cycle,
        ...sumRows(cycle.rows),
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
      totalDays: cycleData.reduce((sum, cycle) => sum + cycle.days, 0),
      totalAmount: cycleData.reduce((sum, cycle) => sum + cycle.amount, 0),
      daysInMonth,
      firstWeekday,
    };
  }, [selectedWorker, month, attendanceByWorker]);

  if (!month) {
    return (
      <AppShell title="Diárias" subtitle="Carregando calendário...">
        <Card />
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

        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="rounded-xl border border-border p-2"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="text-center">
            <p className="font-display text-lg font-semibold capitalize">{monthTitle(month)}</p>
            <p className="text-xs text-muted-foreground">Dias trabalhados e valores</p>
          </div>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="rounded-xl border border-border p-2"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Card className="p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Dias</p>
            <p className="font-display text-2xl font-semibold">
              {detail.totalDays.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">A receber</p>
            <p className="font-display text-2xl font-semibold text-primary-deep">{brl(detail.totalAmount)}</p>
          </Card>
        </div>

        <div className="mb-4 space-y-2">
          {detail.cycles.map((cycle) => {
            const period = paymentPeriods.find(
              (p) =>
                p.cycle === cycle.cycle &&
                p.start_date === cycle.start &&
                p.end_date === cycle.end &&
                p.pay_date === cycle.payDate,
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
                      {cycle.days.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias trabalhados neste período
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
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Calendário de trabalho</p>
              <p className="text-[11px] text-muted-foreground">Toque em um dia trabalhado para conferir o valor.</p>
            </div>
          </div>

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
              const amount = worked ? (selectedWorker.daily_rate ?? 0) * fraction : 0;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => { setEditingDate(iso); setDeleteError(null); }}
                  className={`min-h-14 min-w-0 overflow-hidden rounded-lg border p-1.5 text-left ${
                    worked
                      ? "border-primary bg-primary-soft"
                      : absent
                        ? "border-destructive bg-destructive/10"
                        : "border-border bg-card"
                  }`}
                  title={worked ? "Editar diária" : absent ? "Falta registrada" : "Lançar diária"}
                >
                  <p className="text-[10px] font-semibold">{day}</p>
                  {worked ? (
                    <>
                      <p className="mt-1 truncate text-[8px] font-semibold leading-tight text-primary-deep">
                        {fraction === 0.5 ? "½ dia" : "dia"}
                      </p>
                      <p className="max-w-full truncate text-[8px] font-semibold leading-tight text-primary-deep" title={brl(amount)}>
                        {brl(amount)}
                      </p>
                    </>
                  ) : absent ? (
                    <p className="mt-2 truncate text-[9px] font-bold text-destructive">Falta</p>
                  ) : (
                    <p className="mt-2 text-[9px] text-muted-foreground">—</p>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          Dia integral = 100% da diária. Meio período = 50%. Falta, falta justificada e atestado = R$ 0.
        </p>

        <Card className="mt-4 p-3">
          <p className="text-sm font-semibold">Histórico de pagamentos</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Pagamentos deste diarista já baixados no sistema.</p>
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
            {!payments.some((p) => p.worker_id === selectedWorker.id && p.status === "pago") ? (
              <p className="py-2 text-[11px] text-muted-foreground">Nenhum pagamento baixado ainda.</p>
            ) : null}
          </div>
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
            <p className="text-[10px] text-muted-foreground">Total acumulado</p>
            <p className="text-sm font-bold text-primary-deep">{brl(totalMonth)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="rounded-lg border border-border p-1.5"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs text-muted-foreground">Mude o mês para consultar o histórico</span>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="rounded-lg border border-border p-1.5"
          >
            <ChevronRight className="size-4" />
          </button>
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
              className="card-surface flex w-full items-center gap-3 p-3 text-left transition-transform active:scale-[0.99]"
            >
              <Avatar text={initials(item.worker.full_name)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.worker.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.worker.job_role} · {item.days.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias trabalhados
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary-deep">{brl(item.amount)}</p>
                <p className="text-[10px] text-muted-foreground">a receber</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <Card className="mt-4 p-3">
        <p className="text-xs font-semibold">Como o pagamento é calculado</p>
        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          <p>• O 5º dia útil paga do dia 21 do mês anterior até o dia anterior ao pagamento.</p>
          <p>• O dia 20 paga do último 5º dia útil até o dia 19.</p>
          <p>• Os períodos são contínuos: cada dia trabalhado entra em um único pagamento.</p>
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
