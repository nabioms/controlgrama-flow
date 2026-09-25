/**
 * Mock data local — substituível por queries ao Supabase depois.
 * Cada array corresponde a uma tabela descrita em src/lib/types.ts.
 */
import type {
  Attendance,
  AttendanceStatus,
  Contract,
  ExpenseCategory,
  Invoice,
  Payable,
  Payment,
  PaymentPeriod,
  Receivable,
  Worker,
  WorkerDocument,
  WorkerEvent,
} from "./types";
import { businessDay, toISO } from "./format";

export const TODAY = toISO(new Date());

export const expenseCategories: ExpenseCategory[] = [
  { key: "combustivel", label: "Combustível" },
  { key: "manutencao", label: "Manutenção de equipamentos" },
  { key: "mao_de_obra", label: "Mão de obra" },
  { key: "epi", label: "EPIs" },
  { key: "impostos", label: "Impostos e taxas" },
  { key: "administrativo", label: "Administrativo" },
];

export const contracts: Contract[] = [
  {
    id: "ct-1",
    number: "PMJ 044/2026",
    agency: "Prefeitura — Secretaria de Obras",
    description: "Roçagem de vias e praças — Zona Norte",
    total_value: 486000,
    start_date: "2026-02-01",
    end_date: "2027-01-31",
    status: "vigente",
  },
  {
    id: "ct-2",
    number: "PMJ 071/2026",
    agency: "Prefeitura — Secretaria de Meio Ambiente",
    description: "Corte de grama em escolas e UBS",
    total_value: 212400,
    start_date: "2026-05-01",
    end_date: "2027-04-30",
    status: "vigente",
  },
];

export const workers: Worker[] = [
  {
    id: "w-1",
    full_name: "José Carlos Ferreira",
    cpf: "045.218.377-10",
    shirt_size: null,
    shoe_size: null,
    rg: "MG-12.884.551",
    phone: "(31) 98814-2210",
    address: "Rua das Acácias, 120 — Bairro São Pedro",
    photo_url: null,
    job_role: "encarregado",
    employment_type: "contratado",
    status: "ativo",
    daily_rate: null,
    salary: 3200,
    admission_date: "2024-03-11",
    position: "Encarregado de frente de serviço",
    weekly_hours: 44,
    benefits: { transport_voucher: 210, meal_voucher: 480 },
    vacation: { due_date: "2026-10-15", status: "pendente" },
    thirteenth: { first_installment: "2026-11-28", second_installment: "2026-12-18", status: "pendente" },
    termination_date: null,
    termination_reason: null,
    created_at: "2024-03-11",
  },
  {
    id: "w-2",
    full_name: "Antônio Marcos Silva",
    cpf: "112.904.556-22",
    shirt_size: null,
    shoe_size: null,
    rg: "MG-9.551.207",
    phone: "(31) 99120-7744",
    address: "Av. Central, 88 — Vila Nova",
    photo_url: null,
    job_role: "motorista",
    employment_type: "contratado",
    status: "ativo",
    daily_rate: null,
    salary: 2750,
    admission_date: "2025-01-20",
    position: "Motorista de caminhão",
    weekly_hours: 44,
    benefits: { transport_voucher: 210, meal_voucher: 480 },
    vacation: { due_date: "2027-01-20", status: "pendente" },
    thirteenth: { first_installment: "2026-11-28", second_installment: "2026-12-18", status: "pendente" },
    termination_date: null,
    termination_reason: null,
    created_at: "2025-01-20",
  },
  ...[
    ["w-3", "Edson Rodrigues de Souza", "roçador", 110],
    ["w-4", "Cleber Almeida Pinto", "roçador", 110],
    ["w-5", "Rafael dos Santos Lima", "roçador", 120],
    ["w-6", "Marcelo Batista Nunes", "operador de máquina", 140],
    ["w-7", "Wagner Pereira Dias", "roçador", 110],
    ["w-8", "Fábio Henrique Costa", "auxiliar", 100],
    ["w-9", "Lucas Moreira Teixeira", "roçador", 110],
    ["w-10", "Sidnei Oliveira Ramos", "roçador", 115],
  ].map(([id, name, role, rate], i) => ({
    id: id as string,
    full_name: name as string,
    cpf: `0${30 + i}.${100 + i * 7}.${200 + i * 3}-0${i}`,
    shirt_size: null,
    shoe_size: null,
    rg: `MG-${10 + i}.${200 + i * 11}.${300 + i}`,
    phone: `(31) 9${8000 + i * 137}-${1000 + i * 91}`,
    address: `Rua ${["Bela Vista", "do Campo", "das Palmeiras", "Sete de Setembro", "Minas", "do Sol", "Nova", "Verde"][i]}, ${20 + i * 13}`,
    photo_url: null,
    job_role: role as Worker["job_role"],
    employment_type: "diarista" as const,
    status: (i === 7 ? "afastado" : "ativo") as Worker["status"],
    daily_rate: rate as number,
    salary: null,
    admission_date: null,
    position: null,
    weekly_hours: null,
    benefits: null,
    vacation: null,
    thirteenth: null,
    termination_date: null,
    termination_reason: null,
    created_at: "2026-02-03",
  })),
];

export const workerDocuments: WorkerDocument[] = [
  { id: "d-1", worker_id: "w-2", kind: "cnh", file_name: "cnh-antonio.pdf", file_url: null, issued_at: "2021-10-02", expires_at: "2026-10-02" },
  { id: "d-2", worker_id: "w-2", kind: "aso", file_name: "aso-antonio.pdf", file_url: null, issued_at: "2025-10-01", expires_at: "2026-09-30" },
  { id: "d-3", worker_id: "w-3", kind: "aso", file_name: "aso-edson.pdf", file_url: null, issued_at: "2025-09-15", expires_at: "2026-09-25" },
  { id: "d-4", worker_id: "w-1", kind: "contrato_assinado", file_name: "contrato-jose.pdf", file_url: null, issued_at: "2024-03-11", expires_at: null },
  { id: "d-5", worker_id: "w-5", kind: "comprovante_endereco", file_name: "conta-luz-rafael.pdf", file_url: null, issued_at: "2026-08-04", expires_at: null },
  { id: "d-6", worker_id: "w-6", kind: "aso", file_name: "aso-marcelo.pdf", file_url: null, issued_at: "2026-01-12", expires_at: "2027-01-12" },
];

export const workerEvents: WorkerEvent[] = [
  { id: "e-1", worker_id: "w-4", kind: "advertencia", date: "2026-07-18", description: "Faltas não justificadas em dois dias seguidos." },
  { id: "e-2", worker_id: "w-5", kind: "promocao", date: "2026-06-01", description: "Diária ajustada de R$ 110 para R$ 120." },
  { id: "e-3", worker_id: "w-6", kind: "mudanca_funcao", date: "2026-04-10", description: "Passou de roçador para operador de máquina." },
  { id: "e-4", worker_id: "w-10", kind: "afastamento", date: "2026-09-08", description: "Atestado de 3 dias — lombalgia." },
];

/* ----------------------------- attendance ---------------------------- */

const attendancePattern: AttendanceStatus[] = [
  "presente",
  "presente",
  "presente",
  "presente",
  "falta_justificada",
  "presente",
  "atestado",
  "presente",
  "falta",
  "presente",
];

function buildAttendance(): Attendance[] {
  const rows: Attendance[] = [];
  const base = new Date();
  for (let back = 1; back <= 45; back++) {
    const d = new Date(base);
    d.setDate(d.getDate() - back);
    if (d.getDay() === 0) continue;
    workers.forEach((w, wi) => {
      if (w.status === "desligado") return;
      const seed = (back * 7 + wi * 3) % 10;
      const status = back % 6 === 0 && seed > 7 ? attendancePattern[seed]! : seed > 8 ? "falta" : "presente";
      rows.push({
        id: `at-${w.id}-${toISO(d)}`,
        worker_id: w.id,
        date: toISO(d),
        status,
        notes: wi % 2 === 0 ? "Frente Zona Norte" : "Escolas e UBS",
        contract_id: wi % 2 === 0 ? "ct-1" : "ct-2",
      });
    });
  }
  return rows;
}

export const attendance: Attendance[] = buildAttendance();

/* -------------------- payment periods & payments --------------------- */

const now = new Date();
const y = now.getFullYear();
const m = now.getMonth() + 1;
const prevM = m === 1 ? 12 : m - 1;
const prevY = m === 1 ? y - 1 : y;

export const paymentPeriods: PaymentPeriod[] = [
  {
    id: "pp-1",
    label: `Fechamento ${String(prevM).padStart(2, "0")}/${prevY}`,
    cycle: "quinto_dia_util",
    start_date: `${prevY}-${String(prevM).padStart(2, "0")}-16`,
    end_date: `${prevY}-${String(prevM).padStart(2, "0")}-${prevM === 2 ? 28 : 30}`,
    pay_date: businessDay(y, m, 5),
    status: "pago",
  },
  {
    id: "pp-2",
    label: `Adiantamento ${String(m).padStart(2, "0")}/${y}`,
    cycle: "dia_20",
    start_date: `${y}-${String(m).padStart(2, "0")}-01`,
    end_date: `${y}-${String(m).padStart(2, "0")}-15`,
    pay_date: `${y}-${String(m).padStart(2, "0")}-20`,
    status: "aberto",
  },
  {
    id: "pp-3",
    label: `Fechamento ${String(m).padStart(2, "0")}/${y}`,
    cycle: "quinto_dia_util",
    start_date: `${y}-${String(m).padStart(2, "0")}-16`,
    end_date: `${y}-${String(m).padStart(2, "0")}-30`,
    pay_date: businessDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 5),
    status: "aberto",
  },
];

export const payments: Payment[] = workers
  .filter((w) => w.employment_type === "diarista" && w.status !== "desligado")
  .map((w, i) => ({
    id: `pay-1-${w.id}`,
    period_id: "pp-1",
    worker_id: w.id,
    worked_days: 12 - (i % 3),
    daily_rate: w.daily_rate,
    gross_amount: (12 - (i % 3)) * (w.daily_rate ?? 0),
    status: "pago" as const,
    paid_at: businessDay(y, m, 5),
    method: (i % 2 === 0 ? "pix" : "transferencia") as Payment["method"],
    receipt_url: null,
  }));

/* ------------------- receivables, payables, invoices ------------------ */

export const receivables: Receivable[] = [
  { id: "rc-1", service_order_id: null, contract_id: "ct-1", reference_period: `${prevY}-${String(prevM).padStart(2, "0")}`, expected_amount: 40500, expected_date: `${y}-${String(m).padStart(2, "0")}-10`, status: "recebido", received_at: `${y}-${String(m).padStart(2, "0")}-11`, commitment_note: "NE 2026/1187" },
  { id: "rc-2", service_order_id: null, contract_id: "ct-2", reference_period: `${prevY}-${String(prevM).padStart(2, "0")}`, expected_amount: 17700, expected_date: `${y}-${String(m).padStart(2, "0")}-15`, status: "pendente", received_at: null, commitment_note: "NE 2026/1204" },
  { id: "rc-3", service_order_id: null, contract_id: "ct-1", reference_period: `${y}-${String(m).padStart(2, "0")}`, expected_amount: 40500, expected_date: `${y}-${String(m).padStart(2, "0")}-28`, status: "pendente", received_at: null, commitment_note: null },
  { id: "rc-4", service_order_id: null, contract_id: "ct-2", reference_period: `${y}-${String(m).padStart(2, "0")}`, expected_amount: 17700, expected_date: `${y}-${String(m).padStart(2, "0")}-30`, status: "pendente", received_at: null, commitment_note: null },
];

export const payables: Payable[] = [
  { id: "pb-1", description: "Diesel S10 — 420L", category: "combustivel", supplier: "Posto Trevo", amount: 2688, due_date: `${y}-${String(m).padStart(2, "0")}-22`, status: "pendente", paid_at: null, contract_id: "ct-1", payment_period_id: null },
  { id: "pb-2", description: "Revisão de 3 roçadeiras", category: "manutencao", supplier: "Mecânica Verde", amount: 1240, due_date: `${y}-${String(m).padStart(2, "0")}-25`, status: "pendente", paid_at: null, contract_id: null, payment_period_id: null },
  { id: "pb-3", description: "Diárias — fechamento período anterior", category: "mao_de_obra", supplier: null, amount: payments.reduce((s, p) => s + p.gross_amount, 0), due_date: businessDay(y, m, 5), status: "pago", paid_at: businessDay(y, m, 5), contract_id: null, payment_period_id: "pp-1" },
  { id: "pb-4", description: "Botinas e protetores auriculares", category: "epi", supplier: "Segurança Total", amount: 890, due_date: `${y}-${String(m).padStart(2, "0")}-18`, status: "pago", paid_at: `${y}-${String(m).padStart(2, "0")}-18`, contract_id: null, payment_period_id: null },
  { id: "pb-5", description: "ISS + INSS patronal", category: "impostos", supplier: "Prefeitura / Receita", amount: 4310, due_date: `${y}-${String(m).padStart(2, "0")}-20`, status: "pendente", paid_at: null, contract_id: null, payment_period_id: null },
  { id: "pb-6", description: "Contabilidade e escritório", category: "administrativo", supplier: "Contaplan", amount: 980, due_date: `${y}-${String(m).padStart(2, "0")}-30`, status: "pendente", paid_at: null, contract_id: null, payment_period_id: null },
  { id: "pb-7", description: "Fio de nylon e lâminas", category: "manutencao", supplier: "AgroPeças", amount: 620, due_date: `${y}-${String(m).padStart(2, "0")}-12`, status: "pago", paid_at: `${y}-${String(m).padStart(2, "0")}-12`, contract_id: "ct-2", payment_period_id: null },
];

export const invoices: Invoice[] = [
  { id: "nf-1", number: "NFS-e 1042", contract_id: "ct-1", amount: 40500, issue_date: `${prevY}-${String(prevM).padStart(2, "0")}-30`, status: "paga" },
  { id: "nf-2", number: "NFS-e 1043", contract_id: "ct-2", amount: 17700, issue_date: `${prevY}-${String(prevM).padStart(2, "0")}-30`, status: "emitida" },
  { id: "nf-3", number: "NFS-e 1051", contract_id: "ct-1", amount: 40500, issue_date: `${y}-${String(m).padStart(2, "0")}-20`, status: "emitida" },
];

export const initialCashBalance = 68420.55;

export const cashFlowHistory = [
  { month: `${y}-04`, inflow: 58200, outflow: 41300 },
  { month: `${y}-05`, inflow: 58200, outflow: 44980 },
  { month: `${y}-06`, inflow: 58200, outflow: 39610 },
  { month: `${y}-07`, inflow: 58200, outflow: 46120 },
  { month: `${y}-08`, inflow: 58200, outflow: 42870 },
  { month: `${y}-${String(m).padStart(2, "0")}`, inflow: 40500, outflow: 28710 },
];
