import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Plus, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Badge, Button, Card, Field, Input, SectionTitle, Select } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { brl, initials, toISO } from "@/lib/format";
import type { EmploymentType, Worker, WorkerStatus } from "@/lib/types";

export const Route = createFileRoute("/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe e RH — ControlGrama" },
      {
        name: "description",
        content: "Cadastro de diaristas e CLT, documentos, benefícios, histórico de eventos e alertas de vencimento.",
      },
      { property: "og:title", content: "Equipe e RH — ControlGrama" },
      { property: "og:description", content: "Gestão completa de funcionários da operação de roçagem." },
    ],
  }),
  component: EquipePage,
});

const statusTone = (s: WorkerStatus) =>
  s === "ativo" ? "success" : s === "afastado" ? "warning" : "danger";

function EquipePage() {
  const { workers, addWorker } = useStore();
  const [filter, setFilter] = useState<"todos" | EmploymentType>("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    job_role: "roçador",
    employment_type: "diarista" as EmploymentType,
    daily_rate: "110",
    salary: "",
  });

  const list = workers.filter((w) => filter === "todos" || w.employment_type === filter);

  const submit = () => {
    if (!form.full_name) return;
    const w: Worker = {
      id: `w-${Date.now()}`,
      full_name: form.full_name,
      cpf: form.cpf,
      rg: "",
      phone: form.phone,
      address: "",
      photo_url: null,
      job_role: form.job_role as Worker["job_role"],
      employment_type: form.employment_type,
      status: "ativo",
      daily_rate: form.employment_type === "diarista" ? Number(form.daily_rate || 0) : null,
      salary: form.employment_type === "contratado" ? Number(form.salary || 0) : null,
      admission_date: form.employment_type === "contratado" ? toISO(new Date()) : null,
      position: null,
      weekly_hours: form.employment_type === "contratado" ? 44 : null,
      benefits: form.employment_type === "contratado" ? { transport_voucher: 0, meal_voucher: 0 } : null,
      vacation: null,
      thirteenth: null,
      termination_date: null,
      termination_reason: null,
      created_at: toISO(new Date()),
    };
    addWorker(w);
    setOpen(false);
    setForm({ ...form, full_name: "", cpf: "", phone: "" });
  };

  return (
    <AppShell title="Equipe e RH" subtitle={`${workers.length} pessoas cadastradas`}>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-xl bg-muted p-1">
          {(["todos", "diarista", "contratado"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize ${filter === f ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
            >
              {f === "contratado" ? "CLT" : f}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <UserPlus className="size-4" />
        </Button>
      </div>

      {open ? (
        <Card className="mb-4 space-y-3">
          <SectionTitle title="Novo funcionário" hint="Dados básicos — complete depois na ficha" />
          <Field label="Nome completo">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF">
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Função">
              <Select value={form.job_role} onChange={(e) => setForm({ ...form, job_role: e.target.value })}>
                {["roçador", "motorista", "encarregado", "auxiliar", "operador de máquina"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vínculo">
              <Select
                value={form.employment_type}
                onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}
              >
                <option value="diarista">Diarista</option>
                <option value="contratado">Contratado (CLT)</option>
              </Select>
            </Field>
            {form.employment_type === "diarista" ? (
              <Field label="Valor da diária (R$)">
                <Input type="number" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} />
              </Field>
            ) : (
              <Field label="Salário (R$)">
                <Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
              </Field>
            )}
          </div>
          <Button className="w-full" onClick={submit}>
            <Plus className="size-4" /> Cadastrar
          </Button>
        </Card>
      ) : null}

      <div className="space-y-2">
        {list.map((w) => (
          <Link
            key={w.id}
            to="/equipe/$workerId"
            params={{ workerId: w.id }}
            className="card-surface flex items-center gap-3 p-3"
          >
            <Avatar text={initials(w.full_name)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{w.full_name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {w.job_role} ·{" "}
                {w.employment_type === "diarista" ? `${brl(w.daily_rate ?? 0)}/dia` : `${brl(w.salary ?? 0)}/mês`}
              </p>
            </div>
            <Badge tone={statusTone(w.status)}>{w.status}</Badge>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
