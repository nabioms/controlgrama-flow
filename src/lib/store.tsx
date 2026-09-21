/**
 * Estado local da aplicação (mock). Toda leitura/escrita aqui será trocada
 * por queries/mutations do Supabase posteriormente — a interface não muda.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import * as mock from "./mock-data";
import { businessDay, daysUntil, toISO } from "./format";
import type {
  Attendance,
  AttendanceStatus,
  Payable,
  Payment,
  PaymentMethod,
  PaymentPeriod,
  Receivable,
  UserRole,
  Worker,
} from "./types";

interface Store {
  role: UserRole;
  setRole: (r: UserRole) => void;
  workers: Worker[];
  addWorker: (w: Worker) => void;
  updateWorker: (id: string, patch: Partial<Worker>) => void;
  attendance: Attendance[];
  setAttendanceStatus: (workerId: string, date: string, status: AttendanceStatus, notes: string, contractId: string | null) => void;
  paymentPeriods: PaymentPeriod[];
  payments: Payment[];
  closePeriod: (periodId: string) => void;
  markPaymentPaid: (paymentId: string, method: PaymentMethod) => void;
  receivables: Receivable[];
  markReceived: (id: string) => void;
  payables: Payable[];
  addPayable: (p: Payable) => void;
  markPayablePaid: (id: string) => void;
  nextPayDate: { date: string; label: string; days: number };
  cashBalance: number;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("admin");
  const [workers, setWorkers] = useState<Worker[]>(mock.workers);
  const [attendance, setAttendance] = useState<Attendance[]>(mock.attendance);
  const [paymentPeriods, setPaymentPeriods] = useState<PaymentPeriod[]>(mock.paymentPeriods);
  const [payments, setPayments] = useState<Payment[]>(mock.payments);
  const [receivables, setReceivables] = useState<Receivable[]>(mock.receivables);
  const [payables, setPayables] = useState<Payable[]>(mock.payables);

  const value = useMemo<Store>(() => {
    const today = new Date();
    const yy = today.getFullYear();
    const mm = today.getMonth() + 1;
    const fifth = businessDay(yy, mm, 5);
    const twentieth = `${yy}-${String(mm).padStart(2, "0")}-20`;
    const nextFifth = businessDay(mm === 12 ? yy + 1 : yy, mm === 12 ? 1 : mm + 1, 5);

    const candidates = [
      { date: fifth, label: "5º dia útil — fechamento" },
      { date: twentieth, label: "Dia 20 — adiantamento" },
      { date: nextFifth, label: "5º dia útil — fechamento" },
    ];
    const next = candidates.find((c) => daysUntil(c.date, today) >= 0) ?? candidates[2];

    const paidIn = receivables.filter((r) => r.status === "recebido").reduce((s, r) => s + r.expected_amount, 0);
    const paidOut = payables.filter((p) => p.status === "pago").reduce((s, p) => s + p.amount, 0);

    return {
      role,
      setRole,
      workers,
      addWorker: (w) => setWorkers((prev) => [w, ...prev]),
      updateWorker: (id, patch) =>
        setWorkers((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w))),
      attendance,
      setAttendanceStatus: (workerId, date, status, notes, contractId) =>
        setAttendance((prev) => {
          const idx = prev.findIndex((a) => a.worker_id === workerId && a.date === date);
          const row: Attendance = {
            id: `at-${workerId}-${date}`,
            worker_id: workerId,
            date,
            status,
            notes,
            contract_id: contractId,
          };
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = { ...copy[idx], status, notes, contract_id: contractId };
          return copy;
        }),
      paymentPeriods,
      payments,
      closePeriod: (periodId) => {
        const period = paymentPeriods.find((p) => p.id === periodId);
        if (!period || period.status !== "aberto") return;
        const generated: Payment[] = workers
          .filter((w) => w.status !== "desligado")
          .map((w) => {
            const days = attendance.filter(
              (a) =>
                a.worker_id === w.id &&
                a.date >= period.start_date &&
                a.date <= period.end_date &&
                a.status === "presente",
            ).length;
            const rate = w.employment_type === "diarista" ? (w.daily_rate ?? 0) : (w.salary ?? 0) / 30;
            return {
              id: `pay-${periodId}-${w.id}`,
              period_id: periodId,
              worker_id: w.id,
              worked_days: days,
              daily_rate: w.employment_type === "diarista" ? w.daily_rate : null,
              gross_amount: Math.round(days * rate * 100) / 100,
              status: "pendente" as const,
              paid_at: null,
              method: null,
              receipt_url: null,
            };
          })
          .filter((p) => p.worked_days > 0);
        setPayments((prev) => [...prev.filter((p) => p.period_id !== periodId), ...generated]);
        setPaymentPeriods((prev) =>
          prev.map((p) => (p.id === periodId ? { ...p, status: "fechado" } : p)),
        );
      },
      markPaymentPaid: (paymentId, method) =>
        setPayments((prev) =>
          prev.map((p) =>
            p.id === paymentId ? { ...p, status: "pago", method, paid_at: toISO(new Date()) } : p,
          ),
        ),
      receivables,
      markReceived: (id) =>
        setReceivables((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, status: "recebido", received_at: toISO(new Date()) } : r,
          ),
        ),
      payables,
      addPayable: (p) => setPayables((prev) => [p, ...prev]),
      markPayablePaid: (id) =>
        setPayables((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: "pago", paid_at: toISO(new Date()) } : p)),
        ),
      nextPayDate: { ...next, days: daysUntil(next.date, today) },
      cashBalance: mock.initialCashBalance + paidIn - paidOut,
    };
  }, [role, workers, attendance, paymentPeriods, payments, receivables, payables]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de <StoreProvider>");
  return ctx;
}
