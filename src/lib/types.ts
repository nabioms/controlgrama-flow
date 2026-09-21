/**
 * ControlGrama — estrutura de dados esperada (referência de schema).
 *
 * Estes tipos espelham as tabelas que serão criadas no Supabase próprio do
 * cliente numa etapa posterior. Hoje tudo é alimentado por mock data local
 * (src/lib/mock-data.ts) e mantido em estado React (src/lib/store.tsx).
 *
 * Tabelas previstas:
 *  workers, worker_documents, worker_events, attendance,
 *  payment_periods, payments, contracts, receivables, payables,
 *  expense_categories, invoices  (+ cash_flow como view/query)
 */

export type UUID = string;
export type ISODate = string; // 'YYYY-MM-DD'

export type UserRole = "admin" | "encarregado";

/* ------------------------------ workers ------------------------------ */

export type EmploymentType = "diarista" | "contratado";
export type WorkerStatus = "ativo" | "afastado" | "desligado";
export type WorkerRoleName =
  | "roçador"
  | "motorista"
  | "encarregado"
  | "auxiliar"
  | "operador de máquina";

export interface Worker {
  id: UUID;
  full_name: string;
  cpf: string;
  rg: string;
  phone: string;
  address: string;
  photo_url: string | null;
  job_role: WorkerRoleName;
  employment_type: EmploymentType;
  status: WorkerStatus;
  /** diaristas */
  daily_rate: number | null;
  /** contratados (CLT) */
  salary: number | null;
  admission_date: ISODate | null;
  position: string | null;
  weekly_hours: number | null;
  benefits: { transport_voucher: number; meal_voucher: number } | null;
  vacation: { due_date: ISODate; status: "agendada" | "pendente" | "gozada" } | null;
  thirteenth: { first_installment: ISODate; second_installment: ISODate; status: "pendente" | "pago" } | null;
  /** desligamento */
  termination_date: ISODate | null;
  termination_reason: string | null;
  created_at: ISODate;
}

export type DocumentKind = "cnh" | "aso" | "comprovante_endereco" | "contrato_assinado" | "outro";

export interface WorkerDocument {
  id: UUID;
  worker_id: UUID;
  kind: DocumentKind;
  file_name: string;
  file_url: string | null;
  issued_at: ISODate | null;
  expires_at: ISODate | null;
}

export type WorkerEventKind = "advertencia" | "promocao" | "mudanca_funcao" | "afastamento" | "outro";

export interface WorkerEvent {
  id: UUID;
  worker_id: UUID;
  kind: WorkerEventKind;
  date: ISODate;
  description: string;
}

/* ----------------------------- attendance ---------------------------- */

export type AttendanceStatus = "presente" | "falta" | "falta_justificada" | "atestado";

export interface Attendance {
  id: UUID;
  worker_id: UUID;
  date: ISODate;
  status: AttendanceStatus;
  /** frente de serviço / local */
  notes: string | null;
  contract_id: UUID | null;
}

/* -------------------- payment_periods & payments ---------------------- */

export type PaymentCycle = "quinto_dia_util" | "dia_20";
export type PeriodStatus = "aberto" | "fechado" | "pago";
export type PaymentMethod = "pix" | "dinheiro" | "transferencia";
export type PaymentStatus = "pendente" | "pago";

export interface PaymentPeriod {
  id: UUID;
  label: string;
  cycle: PaymentCycle;
  start_date: ISODate;
  end_date: ISODate;
  pay_date: ISODate;
  status: PeriodStatus;
}

export interface Payment {
  id: UUID;
  period_id: UUID;
  worker_id: UUID;
  worked_days: number;
  daily_rate: number | null;
  gross_amount: number;
  status: PaymentStatus;
  paid_at: ISODate | null;
  method: PaymentMethod | null;
  receipt_url: string | null;
}

/* ----------------------- contracts & receivables --------------------- */

export interface Contract {
  id: UUID;
  number: string;
  agency: string; // prefeitura / secretaria
  description: string;
  total_value: number;
  start_date: ISODate;
  end_date: ISODate;
  status: "vigente" | "encerrado";
}

export interface Receivable {
  id: UUID;
  contract_id: UUID;
  reference_period: string; // ex. '2026/08'
  expected_amount: number;
  expected_date: ISODate;
  status: "pendente" | "recebido";
  received_at: ISODate | null;
  commitment_note: string | null; // empenho
}

/* ------------------- payables & expense categories ------------------- */

export type ExpenseCategoryKey =
  | "combustivel"
  | "manutencao"
  | "mao_de_obra"
  | "epi"
  | "impostos"
  | "administrativo";

export interface ExpenseCategory {
  key: ExpenseCategoryKey;
  label: string;
}

export interface Payable {
  id: UUID;
  description: string;
  category: ExpenseCategoryKey;
  supplier: string | null;
  amount: number;
  due_date: ISODate;
  status: "pendente" | "pago";
  paid_at: ISODate | null;
  /** centro de custo opcional (frente de serviço / contrato) */
  contract_id: UUID | null;
  /** quando gerado pelo módulo de diárias */
  payment_period_id: UUID | null;
}

/* ------------------------------ invoices ----------------------------- */

export interface Invoice {
  id: UUID;
  number: string;
  contract_id: UUID;
  amount: number;
  issue_date: ISODate;
  status: "emitida" | "paga" | "cancelada";
}

/* ----------------------------- cash flow ----------------------------- */

/** Visão consolidada (view/query no Supabase, não tabela). */
export interface CashFlowMonth {
  month: string; // 'YYYY-MM'
  inflow: number;
  outflow: number;
}
