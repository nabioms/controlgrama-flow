/** Formatação e cálculos de datas/valores (pt-BR). */

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const shortBrl = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k` : brl(v);

/**
 * Data operacional do ControlGrama.
 * O sistema é usado em Campo Grande-MS, então a data do negócio deve seguir
 * America/Campo_Grande e não UTC. Isso evita virar o dia antes da meia-noite
 * local quando o navegador/servidor estiver em UTC.
 */
const APP_TIME_ZONE = "America/Campo_Grande";

export const toISO = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

export const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const formatLongDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
};

/** Feriados nacionais fixos (referência simplificada). */
const NATIONAL_HOLIDAYS = [
  "01-01",
  "04-21",
  "05-01",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "11-20",
  "12-25",
];

const isHoliday = (d: Date) => NATIONAL_HOLIDAYS.includes(toISO(d).slice(5));
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Nº dia útil do mês, pulando fins de semana e feriados nacionais. */
export function businessDay(year: number, month: number, n: number): string {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getMonth() !== month - 1) break;
    if (!isWeekend(d) && !isHoliday(d)) count++;
    if (count === n) return toISO(d);
  }
  return toISO(new Date(year, month - 1, 5));
}

export const daysUntil = (iso: string, today = new Date()) => {
  const target = new Date(`${iso}T12:00:00`).getTime();
  const base = new Date(toISO(today) + "T12:00:00").getTime();
  return Math.round((target - base) / 86_400_000);
};

export const maskCpf = (cpf: string) => cpf;

export const initials = (name: string) =>
  name
    .split(" ")
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
