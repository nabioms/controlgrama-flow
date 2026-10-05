/**
 * Bônus de Meta Semanal — cálculo derivado (sem cadastro paralelo).
 * Fontes: production_goal_weeks (meta), service_orders realizadas (produção), attendance (ponto).
 * Pendentes são calculados; só bônus PAGOS são gravados (um por diarista + semana).
 */
import type { Attendance, ProductionGoalWeek, ServiceOrder, ServiceType, Team, WeeklyGoalBonus, Worker } from "./types";

export const BONUS_AMOUNT = 100;

export function m2Realized(orders: ServiceOrder[], types: ServiceType[], start: string, end: string) {
  return orders
    .filter((o) => o.service_date >= start && o.service_date <= end && o.status === "realizada")
    .reduce((sum, o) => {
      const items = o.items || [];
      if (items.length)
        return sum + items.reduce((s, i) => {
          const t = i.service_type || types.find((x) => x.id === i.service_type_id);
          return s + (t?.unit === "m2" ? Number(i.realized_quantity ?? 0) : 0);
        }, 0);
      const t = o.service_type || types.find((x) => x.id === o.service_type_id);
      return sum + (t?.unit === "m2" ? Number(o.realized_quantity ?? 0) : 0);
    }, 0);
}

const isSunday = (iso: string) => new Date(`${iso}T12:00:00`).getDay() === 0;

export interface WorkerBonusEval {
  worker: Worker;
  teamId: string | null;
  teamName: string | null;
  presentDays: number;
  absences: number; // somente "falta" (injustificada), nunca domingo
  presenceOk: boolean;
  amount: number; // valor calculado agora
  paid: WeeklyGoalBonus | null;
  divergent: boolean; // pago, mas o cálculo atual mudou
}

export interface WeekBonusEval {
  week: ProductionGoalWeek;
  target: number;
  realized: number;
  percent: number;
  goalMet: boolean;
  finished: boolean;
  workers: WorkerBonusEval[];
  total: number;
  eligible: number;
}

export function evaluateWeeks(input: {
  weeks: ProductionGoalWeek[];
  orders: ServiceOrder[];
  types: ServiceType[];
  attendance: Attendance[];
  workers: Worker[];
  teams: Team[];
  bonuses: WeeklyGoalBonus[];
  today: string;
}): WeekBonusEval[] {
  const { weeks, orders, types, attendance, workers, teams, bonuses, today } = input;
  const teamOf = (id: string) => teams.find((t) => (t.members || []).some((m) => m.id === id)) || null;
  return [...weeks]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((week) => {
      const target = Number(week.target_m2 || 0);
      const realized = m2Realized(orders, types, week.start_date, week.end_date);
      const goalMet = target > 0 && realized >= target;
      const percent = target > 0 ? (realized / target) * 100 : 0;
      const rows = attendance.filter((a) => a.date >= week.start_date && a.date <= week.end_date && !isSunday(a.date));
      const ids = new Set(rows.map((a) => a.worker_id));
      bonuses.filter((b) => b.week_start === week.start_date).forEach((b) => ids.add(b.worker_id));
      const evals: WorkerBonusEval[] = [...ids]
        .map((id) => workers.find((w) => w.id === id))
        .filter((w): w is Worker => !!w && w.employment_type === "diarista")
        .map((w) => {
          const mine = rows.filter((a) => a.worker_id === w.id);
          const presentDays = mine.filter((a) => a.status === "presente").length;
          const absences = mine.filter((a) => a.status === "falta").length;
          const presenceOk = presentDays > 0 && absences === 0;
          const amount = goalMet && presenceOk ? BONUS_AMOUNT : 0;
          const paid = bonuses.find((b) => b.worker_id === w.id && b.week_start === week.start_date && b.status === "pago") || null;
          const team = teamOf(w.id);
          return { worker: w, teamId: team?.id || null, teamName: team?.name || null, presentDays, absences, presenceOk, amount, paid, divergent: !!paid && Number(paid.amount) !== amount };
        })
        .sort((a, b) => a.worker.full_name.localeCompare(b.worker.full_name));
      return {
        week, target, realized, percent, goalMet, finished: week.end_date < today, workers: evals,
        total: evals.reduce((s, e) => s + e.amount, 0), eligible: evals.filter((e) => e.amount > 0).length,
      };
    });
}

/** Pendente = calculado com direito, semana encerrada e ainda não pago. */
export const isPending = (w: WeekBonusEval, e: WorkerBonusEval) => w.finished && e.amount > 0 && !e.paid;
