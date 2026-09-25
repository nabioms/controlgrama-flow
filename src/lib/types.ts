/**
 * ControlGrama — tipos do domínio do sistema.
 */

export type UUID = string;
export type ISODate = string;
export type UserRole = "admin" | "encarregado";

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
  shirt_size: string | null;
  shoe_size: string | null;
  photo_url: string | null;
  job_role: WorkerRoleName;
  employment_type: EmploymentType;
  status: WorkerStatus;
  daily_rate: number | null;
  salary: number | null;
  admission_date: ISODate | null;
  position: string | null;
  weekly_hours: number | null;
  benefits: { transport_voucher: number; meal_voucher: number } | null;
  vacation: { due_date: ISODate; status: "agendada" | "pendente" | "gozada" } | null;
  thirteenth: { first_installment: ISODate; second_installment: ISODate; status: "pendente" | "pago" } | null;
  termination_date: ISODate | null;
  termination_reason: string | null;
  created_at: ISODate;
}

export interface Team {
  id: UUID;
  name: string;
  foreman_worker_id: UUID | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  foreman?: Worker | null;
  members?: Worker[];
}

export type DocumentKind = "cnh" | "aso" | "comprovante_endereco" | "contrato_assinado" | "outro";
export interface WorkerDocument { id: UUID; worker_id: UUID; kind: DocumentKind; file_name: string; file_url: string | null; issued_at: ISODate | null; expires_at: ISODate | null; }
export type WorkerEventKind = "advertencia" | "promocao" | "mudanca_funcao" | "afastamento" | "outro";
export interface WorkerEvent { id: UUID; worker_id: UUID; kind: WorkerEventKind; date: ISODate; description: string; }
export type EpiKind = "mascara_facial" | "luva" | "oculos" | "avental" | "caneleira" | "abafador" | "uniforme" | "calcado";
export interface WorkerEpi {
  id: UUID;
  worker_id: UUID;
  epi_kind: EpiKind;
  delivered: boolean;
  delivered_at: ISODate | null;
  returned: boolean;
  returned_at: ISODate | null;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = "presente" | "falta" | "falta_justificada" | "atestado";
export interface Attendance { id: UUID; worker_id: UUID; date: ISODate; status: AttendanceStatus; work_fraction?: number; notes: string | null; contract_id: UUID | null; }

export type PaymentCycle = "quinto_dia_util" | "dia_20";
export type PeriodStatus = "aberto" | "fechado" | "pago";
export type PaymentMethod = "pix" | "dinheiro" | "transferencia";
export type PaymentStatus = "pendente" | "pago";
export interface PaymentPeriod { id: UUID; label: string; cycle: PaymentCycle; start_date: ISODate; end_date: ISODate; pay_date: ISODate; status: PeriodStatus; }
export interface Payment { id: UUID; period_id: UUID; worker_id: UUID; worked_days: number; daily_rate: number | null; gross_amount: number; status: PaymentStatus; paid_at: ISODate | null; method: PaymentMethod | null; receipt_url: string | null; }

export interface Contract { id: UUID; number: string; agency: string; description: string; total_value: number; start_date: ISODate; end_date: ISODate; status: "vigente" | "encerrado"; }
export interface Receivable { id: UUID; contract_id: UUID | null; service_order_id: UUID | null; reference_period: string; expected_amount: number; expected_date: ISODate; status: "pendente" | "recebido"; received_at: ISODate | null; commitment_note: string | null; }
export type ExpenseCategoryKey = "combustivel" | "manutencao" | "mao_de_obra" | "epi" | "impostos" | "administrativo";
export interface ExpenseCategory { key: ExpenseCategoryKey; label: string; }
export interface Payable { id: UUID; description: string; category: ExpenseCategoryKey; supplier: string | null; amount: number; due_date: ISODate; status: "pendente" | "pago"; paid_at: ISODate | null; contract_id: UUID | null; payment_period_id: UUID | null; }
export interface Invoice { id: UUID; number: string; contract_id: UUID; amount: number; issue_date: ISODate; status: "emitida" | "paga" | "cancelada"; }
export interface CashFlowMonth { month: string; inflow: number; outflow: number; }

export type ServiceUnit = "m2" | "km" | "hora" | "unidade";
export type ServiceOrderStatus = "aberta" | "realizada" | "nao_realizada";
export interface ServiceType { id: UUID; name: string; unit: ServiceUnit; unit_price: number; active: boolean; created_at: string; }
export interface ServiceOrderItem {
  id: UUID;
  service_order_id: UUID;
  service_type_id: UUID;
  planned_quantity: number;
  realized_quantity: number | null;
  unit_price: number;
  planned_amount: number;
  realized_amount: number;
  created_at: string;
  updated_at: string;
  service_type?: ServiceType;
}
export interface ServiceOrder {
  id: UUID; order_number: number; service_date: ISODate; service_type_id: UUID; contract_id: UUID | null; team_id: UUID | null;
  planned_quantity: number; realized_quantity: number | null; unit_price: number; planned_amount: number; realized_amount: number; status: ServiceOrderStatus;
  notes: string | null; location: string | null; created_by: UUID | null; created_at: string; updated_at: string; completed_at: string | null;
  service_type?: ServiceType; contract?: Contract | null; team?: Team | null; items?: ServiceOrderItem[];
}
