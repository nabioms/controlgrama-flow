import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Badge, Button, Card, EmptyState } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { brl, formatDate, initials } from "@/lib/format";
import type { Attendance, Worker } from "@/lib/types";

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

const paymentCycles = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(year, monthNumber, 1);
  return {
    firstHalf: {
      start: monthToDate(month, 1),
      end: monthToDate(month, 15),
      label: "Dia 20",
      description: "1ª quinzena",
      payDate: monthToDate(month, 20),
    },
    secondHalf: {
      start: monthToDate(month, 16),
      end: monthToDate(month, new Date(year, monthNumber, 0).getDate()),
      label: "5º dia útil",
      description: "2ª quinzena",
      payDate: null as string | null,
      nextMonthYear: next.getFullYear(),
      nextMonthNumber: next.getMonth() + 1,
    },
  };
};

const isWorked = (row?: Attendance) => row?.status === "presente";

function DiariasPage() {
  const { workers, attendance, payments } = useStore();
  const [month, setMonth] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setMonth(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
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

    const rows = getMonthRows(selectedWorker, month);
    const rowMap = new Map(rows.map((row) => [row.date, row]));
    const cycles = paymentCycles(month);

    const firstRows = rows.filter(
      (row) => row.date >= cycles.firstHalf.start && row.date <= cycles.firstHalf.end,
    );
    const secondRows = rows.filter(
      (row) => row.date >= cycles.secondHalf.start && row.date <= cycles.secondHalf.end,
    );

    const sumRows = (items: Attendance[]) => {
      const days = items.reduce((sum, row) => sum + Number(row.work_fraction ?? 1), 0);
      return {
        days,
        amount: Math.round(days * (selectedWorker.daily_rate ?? 0) * 100) / 100,
      };
    };

    const first = sumRows(firstRows);
    const second = sumRows(secondRows);
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
      first,
      second,
      totalDays: first.days + second.days,
      totalAmount: first.amount + second.amount,
      daysInMonth,
      firstWeekday,
      cycles,
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
    const nextPay = detail.cycles.secondHalf.nextMonthNumber;
    const nextPayMonth = `${detail.cycles.secondHalf.nextMonthYear}-${pad(nextPay)}`;

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

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Card className="p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Dia 20 · 1ª quinzena
            </p>
            <p className="mt-1 font-display text-xl font-semibold">{brl(detail.first.amount)}</p>
            <p className="text-xs text-muted-foreground">
              {detail.first.days.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias · 01–15
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              5º dia útil · 2ª quinzena
            </p>
            <p className="mt-1 font-display text-xl font-semibold">{brl(detail.second.amount)}</p>
            <p className="text-xs text-muted-foreground">
              {detail.second.days.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias · 16–{detail.daysInMonth}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">Pagamento no 5º dia útil de {monthTitle(nextPayMonth)}</p>
          </Card>
        </div>

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
              const amount = worked ? (selectedWorker.daily_rate ?? 0) * fraction : 0;

              return (
                <div
                  key={iso}
                  className={`min-h-14 rounded-lg border p-1.5 ${
                    worked
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-card"
                  }`}
                >
                  <p className="text-[10px] font-semibold">{day}</p>
                  {worked ? (
                    <>
                      <p className="mt-1 text-[9px] font-semibold text-primary-deep">
                        {fraction === 0.5 ? "½ dia" : "dia"}
                      </p>
                      <p className="text-[9px] font-semibold text-primary-deep">{brl(amount)}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-[9px] text-muted-foreground">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          Dia integral = 100% da diária. Meio período = 50%. Falta, falta justificada e atestado = R$ 0.
        </p>
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
          <p>• Dias 01–15 → pagamento no dia 20.</p>
          <p>• Dias 16–fim do mês → pagamento no 5º dia útil do mês seguinte.</p>
          <p>• Dia integral = 1 diária · meio período = 0,5 diária.</p>
        </div>
      </Card>

      {payments.length > 0 ? (
        <Card className="mt-4 p-3">
          <p className="text-xs font-semibold">Pagamentos já fechados</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {payments.filter((payment) => payment.status === "pendente").length} pagamento(s) pendente(s) de baixa.
          </p>
        </Card>
      ) : null}
    </AppShell>
  );
}
