import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, CircleSlash, FileHeart, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Select, SectionTitle, Avatar } from "@/components/ui-kit";
import { useStore } from "@/lib/store";

import { brl, formatDate, initials } from "@/lib/format";
import type { AttendanceStatus } from "@/lib/types";

export const Route = createFileRoute("/ponto")({
  head: () => ({
    meta: [
      { title: "Chamada do dia — ControlGrama" },
      { name: "description", content: "Marque presença, falta, falta justificada ou atestado da equipe em poucos toques." },
      { property: "og:title", content: "Chamada do dia — ControlGrama" },
      { property: "og:description", content: "Controle de ponto rápido, feito para uso no campo." },
    ],
  }),
  component: PontoPage,
});

const options: { key: AttendanceStatus; label: string; icon: typeof Check }[] = [
  { key: "presente", label: "Presente", icon: Check },
  { key: "falta", label: "Falta", icon: CircleSlash },
  { key: "falta_justificada", label: "Justificada", icon: ShieldCheck },
  { key: "atestado", label: "Atestado", icon: FileHeart },
];

const toneFor = (s?: AttendanceStatus) =>
  s === "presente" ? "success" : s === "falta" ? "danger" : s === "atestado" ? "info" : s === "falta_justificada" ? "warning" : "neutral";

function PontoPage() {
  const { workers, attendance, setAttendanceStatus, contracts } = useStore();
  const [date, setDate] = useState("");

  useEffect(() => {
    // Resolve the default date in the browser so SSR does not use the server timezone (UTC).
    const now = new Date();
    setDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
  }, []);
  const [contractId, setContractId] = useState<string>("");
  const [notes, setNotes] = useState("Frente Zona Norte");
  const [tab, setTab] = useState<"chamada" | "resumo">("chamada");

  const active = workers.filter((w) => w.status !== "desligado");
  const dayRows = useMemo(
    () => new Map(attendance.filter((a) => a.date === date).map((a) => [a.worker_id, a])),
    [attendance, date],
  );

  const counts = {
    presente: active.filter((w) => dayRows.get(w.id)?.status === "presente").length,
    falta: active.filter((w) => dayRows.get(w.id)?.status === "falta").length,
    outros: active.filter((w) =>
      ["falta_justificada", "atestado"].includes(dayRows.get(w.id)?.status ?? ""),
    ).length,
    pendentes: active.filter((w) => !dayRows.get(w.id)).length,
  };

  const month = date.slice(0, 7);
  const monthly = active.map((w) => {
    const rows = attendance.filter((a) => a.worker_id === w.id && a.date.startsWith(month));
    return {
      worker: w,
      presente: rows.filter((r) => r.status === "presente").reduce((sum, r) => sum + Number(r.work_fraction ?? 1), 0),
      falta: rows.filter((r) => r.status === "falta").length,
      justificada: rows.filter((r) => r.status === "falta_justificada").length,
      atestado: rows.filter((r) => r.status === "atestado").length,
    };
  });

  const markAll = () =>
    active.forEach((w) => setAttendanceStatus(w.id, date, "presente", notes, contractId, 1));

  return (
    <AppShell title="Chamada do dia" subtitle={date ? formatDate(date) : "Carregando data..."}>
      <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1">
        {(["chamada", "resumo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
          >
            {t === "chamada" ? "Chamada" : "Resumo mensal"}
          </button>
        ))}
      </div>

      {tab === "chamada" ? (
        <>
          <Card className="mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Contrato / frente">
                <Select value={contractId} onChange={(e) => setContractId(e.target.value)}>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.number}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Observação (local da frente de serviço)">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Av. Central, trecho 2" />
            </Field>
            <div className="flex gap-2">
              <Button onClick={markAll} className="flex-1">
                Marcar todos presentes
              </Button>
            </div>
          </Card>

          <div className="mb-4 grid grid-cols-4 gap-2 text-center">
            {[
              ["Presentes", counts.presente],
              ["Faltas", counts.falta],
              ["Just./Atest.", counts.outros],
              ["Pendentes", counts.pendentes],
            ].map(([label, value]) => (
              <div key={label as string} className="card-surface px-2 py-2.5">
                <p className="font-display text-lg font-semibold">{value as number}</p>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label as string}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {active.map((w) => {
              const row = dayRows.get(w.id);
              const current = row?.status;
              const fraction = Number(row?.work_fraction ?? 1);
              const isDiarista = w.employment_type === "diarista";
              const todayAmount = isDiarista && current === "presente" ? (w.daily_rate ?? 0) * fraction : 0;
              return (
                <div key={w.id} className="card-surface p-3">
                  <div className="mb-2.5 flex items-center gap-3">
                    <Avatar text={initials(w.full_name)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{w.full_name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {w.job_role} · {isDiarista ? "diarista" : "CLT"}
                      </p>
                      {isDiarista && current === "presente" ? (
                        w.daily_rate && w.daily_rate > 0 ? (
                          <p className="mt-1 text-xs font-semibold text-primary">
                            {fraction === 0.5 ? "½ diária" : "Diária integral"} · + {brl(todayAmount)} a receber hoje
                          </p>
                        ) : (
                          <p className="mt-1 text-xs font-semibold text-warning">Valor da diária não cadastrado</p>
                        )
                      ) : null}
                    </div>
                    <Badge tone={toneFor(current)}>
                      {current === "presente" && fraction === 0.5 ? "½ período" : current ? current.replace("_", " ") : "pendente"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {options.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setAttendanceStatus(w.id, date, key, notes, contractId, key === "presente" ? 1 : 0)}
                        className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-semibold transition-colors ${
                          current === key
                            ? "border-primary bg-primary-soft text-primary-deep"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                  {isDiarista && current === "presente" ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAttendanceStatus(w.id, date, "presente", notes, contractId, 1)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold ${fraction === 1 ? "border-primary bg-primary-soft text-primary-deep" : "border-border text-muted-foreground"}`}
                      >
                        Dia integral · {brl(w.daily_rate ?? 0)}
                      </button>
                      <button
                        onClick={() => setAttendanceStatus(w.id, date, "presente", notes, contractId, 0.5)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold ${fraction === 0.5 ? "border-primary bg-primary-soft text-primary-deep" : "border-border text-muted-foreground"}`}
                      >
                        ½ período · {brl((w.daily_rate ?? 0) * 0.5)}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <SectionTitle title={`Resumo de ${month.split("-").reverse().join("/")}`} hint="Meio período vale 0,5 diária. Faltas não geram diária." />
          {monthly.length === 0 ? (
            <EmptyState text="Sem registros no período." />
          ) : (
            <div className="space-y-2">
              {monthly.map((r) => (
                <div key={r.worker.id} className="card-surface flex items-center gap-3 p-3">
                  <Avatar text={initials(r.worker.full_name)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.worker.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.presente.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} dias trabalhados
                      {r.worker.employment_type === "diarista" && r.worker.daily_rate ? ` · ${brl(r.presente * r.worker.daily_rate)} acumulados` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Badge tone="danger">{r.falta} F</Badge>
                    <Badge tone="warning">{r.justificada} FJ</Badge>
                    <Badge tone="info">{r.atestado} A</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
