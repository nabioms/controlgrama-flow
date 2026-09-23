import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, UserPlus, UsersRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Badge, Button, Card, Field, Input, SectionTitle, Select } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { brl, initials, toISO } from "@/lib/format";
import type { EmploymentType, Team, Worker, WorkerStatus } from "@/lib/types";

export const Route = createFileRoute("/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe e RH — ControlGrama" },
      { name: "description", content: "Equipes, encarregados, diaristas, CLT e fichas dos trabalhadores." },
      { property: "og:title", content: "Equipe e RH — ControlGrama" },
      { property: "og:description", content: "Gestão de equipes e funcionários da operação." },
    ],
  }),
  component: EquipePage,
});

const statusTone = (s: WorkerStatus) => s === "ativo" ? "success" : s === "afastado" ? "warning" : "danger";

function EquipePage() {
  const { workers, teams, addWorker, addTeam, updateTeam, setTeamMembers } = useStore();
  const [view, setView] = useState<"pessoas" | "equipes">("equipes");
  const [filter, setFilter] = useState<"todos" | EmploymentType>("todos");
  const [statusFilter, setStatusFilter] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [openWorker, setOpenWorker] = useState(false);
  const [openTeam, setOpenTeam] = useState(false);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "", cpf: "", phone: "", job_role: "roçador",
    employment_type: "diarista" as EmploymentType, daily_rate: "110", salary: "", shirt_size: "", shoe_size: "", teamId: "",
  });
  const [teamForm, setTeamForm] = useState({ name: "", foremanWorkerId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // /equipe is the parent route. When a worker ID is present, render the child detail route
  // instead of leaving the parent list mounted over it.
  const location = useLocation();
  if (location.pathname !== "/equipe") {
    return <Outlet />;
  }

  const list = workers.filter((w) => {
    const matchesType = filter === "todos" || w.employment_type === filter;
    const matchesStatus = statusFilter === "todos" || (statusFilter === "ativos" ? w.status !== "desligado" : w.status === "desligado");
    return matchesType && matchesStatus;
  });
  const foremen = workers.filter((w) => w.status !== "desligado" && w.job_role === "encarregado");
  const activeTeams = teams.filter((t) => t.active);

  async function submitWorker() {
    if (!form.full_name.trim()) return;
    setSaving(true); setError("");
    try {
      const w: Worker = {
        id: `w-${Date.now()}`, full_name: form.full_name.trim(), cpf: form.cpf, rg: "", phone: form.phone,
        address: "", shirt_size: form.shirt_size.trim() || null, shoe_size: form.shoe_size.trim() || null, photo_url: null, job_role: form.job_role as Worker["job_role"],
        employment_type: form.employment_type, status: "ativo",
        daily_rate: form.employment_type === "diarista" ? Number(form.daily_rate || 0) : null,
        salary: form.employment_type === "contratado" ? Number(form.salary || 0) : null,
        admission_date: form.employment_type === "contratado" ? toISO(new Date()) : null,
        position: null, weekly_hours: form.employment_type === "contratado" ? 44 : null,
        benefits: form.employment_type === "contratado" ? { transport_voucher: 0, meal_voucher: 0 } : null,
        vacation: null, thirteenth: null, termination_date: null, termination_reason: null, created_at: toISO(new Date()),
      };
      await addWorker(w, form.teamId || null);
      setOpenWorker(false);
      setForm({ ...form, full_name: "", cpf: "", phone: "", shirt_size: "", shoe_size: "", teamId: "" });
    } catch (e: any) {
      setError(e?.message || "Não foi possível cadastrar o funcionário.");
    } finally { setSaving(false); }
  }

  async function submitTeam() {
    setSaving(true); setError("");
    try {
      await addTeam(teamForm.name, teamForm.foremanWorkerId || null);
      setTeamForm({ name: "", foremanWorkerId: "" });
      setOpenTeam(false);
    } catch (e: any) {
      setError(e?.message || "Não foi possível criar a equipe.");
    } finally { setSaving(false); }
  }

  return (
    <AppShell title="Equipe e RH" subtitle={`${workers.length} pessoas · ${activeTeams.length} equipes ativas`}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <button onClick={() => setView("equipes")} className={`rounded-lg py-2 text-xs font-semibold ${view === "equipes" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
          Equipes
        </button>
        <button onClick={() => setView("pessoas")} className={`rounded-lg py-2 text-xs font-semibold ${view === "pessoas" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
          Pessoas
        </button>
      </div>

      {error ? <p className="mb-3 text-xs font-semibold text-destructive">{error}</p> : null}

      {view === "equipes" ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <SectionTitle title="Equipes de trabalho" hint="Cada equipe possui um encarregado e seus integrantes." />
            <Button size="sm" onClick={() => { setOpenTeam(true); setError(""); }}><Plus className="size-4" /> Cadastrar equipe</Button>
          </div>

          {openTeam ? (
            <Card className="mb-4 space-y-3">
              <SectionTitle title="Nova equipe" hint="O encarregado pode ser definido agora ou depois." />
              <Field label="Nome da equipe"><Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} placeholder="Ex.: Equipe Alpha" /></Field>
              <Field label="Encarregado da equipe">
                <Select value={teamForm.foremanWorkerId} onChange={(e) => setTeamForm({ ...teamForm, foremanWorkerId: e.target.value })}>
                  <option value="">Definir depois</option>
                  {foremen.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </Select>
              </Field>
              <Button className="w-full" disabled={saving || !teamForm.name.trim()} onClick={submitTeam}><UsersRound className="size-4" /> Criar equipe</Button>
            </Card>
          ) : null}

          <div className="space-y-3">
            {teams.map((team) => {
              const expanded = openTeamId === team.id;
              const members = team.members || [];
              return (
                <Card key={team.id} className={team.active ? "" : "opacity-60"}>
                  <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpenTeamId(expanded ? null : team.id)}>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><UsersRound className="size-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{team.name}</p>
                      <p className="text-xs text-muted-foreground">{members.length} integrante(s) · {team.foreman ? `Encarregado: ${team.foreman.full_name}` : "Sem encarregado definido"}</p>
                    </div>
                    <Badge tone={team.active ? "success" : "warning"}>{team.active ? "ativa" : "inativa"}</Badge>
                    {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>

                  {expanded ? (
                    <div className="mt-4 border-t pt-4">
                      <div className="mb-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Encarregado">
                          <Select
                            value={team.foreman_worker_id || ""}
                            onChange={async (e) => {
                              try { await updateTeam(team.id, { foreman_worker_id: e.target.value || null }); }
                              catch (err: any) { setError(err?.message || "Não foi possível alterar o encarregado."); }
                            }}
                          >
                            <option value="">Sem encarregado</option>
                            {foremen.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                          </Select>
                        </Field>
                        <Field label="Status">
                          <Select value={team.active ? "ativa" : "inativa"} onChange={(e) => updateTeam(team.id, { active: e.target.value === "ativa" })}>
                            <option value="ativa">Ativa</option>
                            <option value="inativa">Inativa</option>
                          </Select>
                        </Field>
                      </div>

                      <p className="mb-2 text-xs font-semibold">Integrantes habilitados</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {workers.filter((w) => w.status !== "desligado").map((w) => {
                          const checked = members.some((m) => m.id === w.id);
                          return (
                            <label key={w.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={async () => {
                                  const ids = new Set(members.map((m) => m.id));
                                  if (ids.has(w.id)) ids.delete(w.id); else ids.add(w.id);
                                  try { await setTeamMembers(team.id, [...ids]); }
                                  catch (err: any) { setError(err?.message || "Não foi possível atualizar a equipe."); }
                                }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{w.full_name}</span>
                                <span className="text-muted-foreground">{w.job_role} · {w.phone || "sem telefone"}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="mt-3 space-y-2">
                        {members.map((w) => (
                          <Link key={w.id} to="/equipe/$workerId" params={{ workerId: w.id }} className="flex items-center gap-3 rounded-xl border p-2 hover:bg-muted">
                            <Avatar text={initials(w.full_name)} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{w.full_name}</p>
                              <p className="text-xs text-muted-foreground">{w.job_role} · {w.phone || "telefone não informado"}</p>
                            </div>
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </Link>
                        ))}
                        {!members.length ? <p className="text-xs text-muted-foreground">Nenhum integrante habilitado nesta equipe.</p> : null}
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })}
            {!teams.length ? <Card className="border-dashed"><p className="text-sm font-semibold">Nenhuma equipe criada.</p><p className="mt-1 text-xs text-muted-foreground">Cadastre sua primeira equipe para depois definir o encarregado e os integrantes.</p><Button className="mt-3" size="sm" onClick={() => { setOpenTeam(true); setError(""); }}><Plus className="size-4" /> Cadastrar primeira equipe</Button></Card> : null}
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1 rounded-xl bg-muted p-1">
                {(["ativos", "inativos", "todos"] as const).map((f) => (
                  <button key={f} onClick={() => setStatusFilter(f)} className={`flex-1 rounded-lg py-2 text-xs font-semibold ${statusFilter === f ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
                    {f === "ativos" ? "Ativos" : f === "inativos" ? "Inativos" : "Todos"}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={() => setOpenWorker((v) => !v)}><UserPlus className="size-4" /></Button>
            </div>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(["todos", "diarista", "contratado"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize ${filter === f ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
                  {f === "contratado" ? "CLT" : f}
                </button>
              ))}
            </div>
          </div>

          {openWorker ? (
            <Card className="mb-4 space-y-3">
              <SectionTitle title="Novo funcionário" hint="Cadastre diarista ou CLT e, se desejar, já habilite em uma equipe." />
              <Field label="Nome completo"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CPF"><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></Field>
                <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(67) 99999-9999" /></Field>
                <Field label="Tamanho da camisa"><Input value={form.shirt_size} onChange={(e) => setForm({ ...form, shirt_size: e.target.value.toUpperCase() })} placeholder="Ex.: M, G, GG" /></Field>
                <Field label="Tamanho do calçado"><Input value={form.shoe_size} onChange={(e) => setForm({ ...form, shoe_size: e.target.value })} placeholder="Ex.: 40" /></Field>
                <Field label="Função">
                  <Select value={form.job_role} onChange={(e) => setForm({ ...form, job_role: e.target.value })}>
                    {["roçador", "motorista", "encarregado", "auxiliar", "operador de máquina"].map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </Field>
                <Field label="Vínculo">
                  <Select value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}>
                    <option value="diarista">Diarista</option>
                    <option value="contratado">Contratado (CLT)</option>
                  </Select>
                </Field>
                {form.employment_type === "diarista" ? (
                  <Field label="Valor da diária (R$)"><Input type="number" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} /></Field>
                ) : (
                  <Field label="Salário (R$)"><Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></Field>
                )}
                <Field label="Equipe">
                  <Select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                    <option value="">Sem equipe</option>
                    {activeTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
              </div>
              <Button className="w-full" disabled={saving || !form.full_name.trim()} onClick={submitWorker}><Plus className="size-4" /> Cadastrar funcionário</Button>
            </Card>
          ) : null}

          <div className="space-y-2">
            {list.map((w) => {
              const team = teams.find((t) => t.members?.some((m) => m.id === w.id));
              return (
                <Link key={w.id} to="/equipe/$workerId" params={{ workerId: w.id }} className="card-surface flex items-center gap-3 p-3">
                  <Avatar text={initials(w.full_name)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{w.full_name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{w.job_role} · {w.employment_type === "diarista" ? `${brl(w.daily_rate ?? 0)}/dia` : `${brl(w.salary ?? 0)}/mês`} {team ? `· ${team.name}` : ""}</p>
                    {w.phone ? <p className="text-[11px] text-muted-foreground">{w.phone}</p> : null}
                  </div>
                  <Badge tone={statusTone(w.status)}>{w.status}</Badge>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
