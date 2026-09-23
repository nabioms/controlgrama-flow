import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, FileText, Pencil, RotateCcw, Upload, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui-kit";
import { useStore } from "@/lib/store";

import { brl, daysUntil, formatDate, initials, toISO } from "@/lib/format";

export const Route = createFileRoute("/equipe/$workerId")({
  head: () => ({
    meta: [
      { title: "Ficha do funcionário — ControlGrama" },
      { name: "description", content: "Dados cadastrais, documentos, benefícios, histórico de eventos e presença do funcionário." },
      { property: "og:title", content: "Ficha do funcionário — ControlGrama" },
      { property: "og:description", content: "Tudo sobre o trabalhador: vínculo, documentos e presença." },
    ],
  }),
  component: WorkerDetail,
});

const docLabels: Record<string, string> = {
  cnh: "CNH",
  aso: "ASO",
  comprovante_endereco: "Comprovante de endereço",
  contrato_assinado: "Contrato assinado",
  outro: "Outro",
};

function WorkerDetail() {
  const { workerId } = Route.useParams();
  const { workers, teams, attendance, payments, updateWorker, deleteWorker, updateWorkerEpi, workerEpis, workerDocuments, workerEvents } = useStore();
  const worker = workers.find((w) => w.id === workerId);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    full_name: "",
    cpf: "",
    rg: "",
    phone: "",
    address: "",
    job_role: "roçador" as "roçador" | "motorista" | "encarregado" | "auxiliar" | "operador de máquina",
    employment_type: "diarista" as "diarista" | "contratado",
    daily_rate: "",
    salary: "",
    admission_date: "",
    position: "",
    weekly_hours: "",
    shirt_size: "",
    shoe_size: "",
  });

  function startEditing() {
    if (!worker) return;
    setEditError("");
    setEditForm({
      full_name: worker.full_name,
      cpf: worker.cpf || "",
      rg: worker.rg || "",
      phone: worker.phone || "",
      address: worker.address || "",
      job_role: worker.job_role,
      employment_type: worker.employment_type,
      daily_rate: worker.daily_rate == null ? "" : String(worker.daily_rate),
      salary: worker.salary == null ? "" : String(worker.salary),
      admission_date: worker.admission_date || "",
      position: worker.position || "",
      weekly_hours: worker.weekly_hours == null ? "" : String(worker.weekly_hours),
      shirt_size: worker.shirt_size || "",
      shoe_size: worker.shoe_size || "",
    });
    setEditing(true);
  }

  async function saveEditing() {
    if (!worker || !editForm.full_name.trim()) {
      setEditError("Informe o nome completo.");
      return;
    }
    setSaving(true);
    setEditError("");
    try {
      await updateWorker(worker.id, {
        full_name: editForm.full_name.trim(),
        cpf: editForm.cpf.trim(),
        rg: editForm.rg.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        job_role: editForm.job_role,
        employment_type: editForm.employment_type,
        daily_rate: editForm.employment_type === "diarista" ? Number(editForm.daily_rate || 0) : null,
        salary: editForm.employment_type === "contratado" ? Number(editForm.salary || 0) : null,
        admission_date: editForm.employment_type === "contratado" ? (editForm.admission_date || null) : null,
        position: editForm.employment_type === "contratado" ? (editForm.position.trim() || null) : null,
        weekly_hours: editForm.employment_type === "contratado" ? Number(editForm.weekly_hours || 44) : null,
        shirt_size: editForm.shirt_size.trim() || null,
        shoe_size: editForm.shoe_size.trim() || null,
      });
      setEditing(false);
    } catch (e: any) {
      setEditError(e?.message || "Não foi possível salvar o cadastro.");
    } finally {
      setSaving(false);
    }
  }

  if (!worker) {
    return (
      <AppShell title="Funcionário">
        <EmptyState text="Funcionário não encontrado." />
        <Link to="/equipe" className="mt-3 block text-center text-sm font-semibold text-primary">
          Voltar para a equipe
        </Link>
      </AppShell>
    );
  }

  const month = toISO(new Date()).slice(0, 7);
  const rows = attendance.filter((a) => a.worker_id === worker.id);
  const monthRows = rows.filter((a) => a.date.startsWith(month));
  const docs = workerDocuments.filter((d) => d.worker_id === worker.id);
  const events = workerEvents.filter((e) => e.worker_id === worker.id);
  const history = payments.filter((p) => p.worker_id === worker.id);
  const workerTeam = teams.find((t) => t.members?.some((m) => m.id === worker.id));

  return (
    <AppShell title={worker.full_name} subtitle={worker.job_role}>
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <Avatar text={initials(worker.full_name)} className="size-14 text-base" />
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">{worker.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {worker.employment_type === "diarista"
                ? `Diarista · ${brl(worker.daily_rate ?? 0)}/dia`
                : `CLT · ${brl(worker.salary ?? 0)}/mês`}
            </p>
          </div>
          <Badge tone={worker.status === "ativo" ? "success" : worker.status === "afastado" ? "warning" : "danger"}>
            {worker.status}
          </Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
          <div><dt className="text-muted-foreground">CPF</dt><dd className="font-semibold">{worker.cpf || "—"}</dd></div>
          <div><dt className="text-muted-foreground">RG</dt><dd className="font-semibold">{worker.rg || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Telefone</dt><dd className="font-semibold">{worker.phone || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Camisa</dt><dd className="font-semibold">{worker.shirt_size || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Calçado</dt><dd className="font-semibold">{worker.shoe_size || "—"}</dd></div>
          <div><dt className="text-muted-foreground">Equipe</dt><dd className="font-semibold">{workerTeam?.name || "Sem equipe"}</dd></div>
          <div><dt className="text-muted-foreground">Admissão</dt><dd className="font-semibold">{formatDate(worker.admission_date)}</dd></div>
          <div className="col-span-2"><dt className="text-muted-foreground">Endereço</dt><dd className="font-semibold">{worker.address || "—"}</dd></div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={startEditing}>
            <Pencil className="size-3.5" /> Editar cadastro
          </Button>
          {worker.status === "ativo" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => updateWorker(worker.id, { status: "afastado" })}>
                Afastar
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  updateWorker(worker.id, {
                    status: "desligado",
                    termination_date: toISO(new Date()),
                    termination_reason: "Desligamento registrado no app",
                  })
                }
              >
                Desligar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="soft" onClick={() => updateWorker(worker.id, { status: "ativo", termination_date: null, termination_reason: null })}>
                Reativar
              </Button>
              {worker.status === "desligado" ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    if (!window.confirm("ATENÇÃO: este cadastro será excluído definitivamente do ControlGrama.\n\nA exclusão é irreversível e só deve ser usada para cadastros criados por engano ou que não possuem histórico de ponto, pagamentos, documentos, eventos ou O.S.\n\nDepois de excluir, não será possível recuperar o cadastro.\n\nDeseja realmente excluir?")) return;
                    try {
                      await deleteWorker(worker.id);
                      window.location.href = "/equipe";
                    } catch (e: any) {
                      setEditError(e?.message || "Não foi possível excluir o cadastro.");
                    }
                  }}
                >
                  Excluir cadastro
                </Button>
              ) : null}
            </>
          )}
        </div>
        {worker.termination_reason ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Desligado em {formatDate(worker.termination_date)} — {worker.termination_reason}
          </p>
        ) : null}
      </Card>

      {editing ? (
        <Card className="mb-4 border-primary/20">
          <div className="mb-4 flex items-center justify-between gap-3">
            <SectionTitle title="Editar cadastro" hint="As alterações são salvas diretamente no Supabase." />
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditError(""); }}><X className="size-4" /></Button>
          </div>
          {editError ? <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{editError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Nome completo</label>
              <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div><label className="text-xs font-medium">CPF</label><input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.cpf} onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })} /></div>
            <div><label className="text-xs font-medium">RG</label><input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.rg} onChange={(e) => setEditForm({ ...editForm, rg: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Telefone</label><input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Tamanho da camisa</label><input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="M, G, GG..." value={editForm.shirt_size} onChange={(e) => setEditForm({ ...editForm, shirt_size: e.target.value.toUpperCase() })} /></div>
            <div><label className="text-xs font-medium">Tamanho do calçado</label><input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Ex.: 40" value={editForm.shoe_size} onChange={(e) => setEditForm({ ...editForm, shoe_size: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Função</label><select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.job_role} onChange={(e) => setEditForm({ ...editForm, job_role: e.target.value as typeof editForm.job_role })}>{["roçador", "motorista", "encarregado", "auxiliar", "operador de máquina"].map((role) => <option key={role} value={role}>{role}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="text-xs font-medium">Endereço</label><input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
            <div><label className="text-xs font-medium">Vínculo</label><select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.employment_type} onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value as typeof editForm.employment_type })}><option value="diarista">Diarista</option><option value="contratado">Contratado (CLT)</option></select></div>
            {editForm.employment_type === "diarista" ? (
              <div><label className="text-xs font-medium">Valor da diária (R$)</label><input type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.daily_rate} onChange={(e) => setEditForm({ ...editForm, daily_rate: e.target.value })} /></div>
            ) : (
              <>
                <div><label className="text-xs font-medium">Salário (R$)</label><input type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.salary} onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })} /></div>
                <div><label className="text-xs font-medium">Data de admissão</label><input type="date" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.admission_date} onChange={(e) => setEditForm({ ...editForm, admission_date: e.target.value })} /></div>
                <div><label className="text-xs font-medium">Cargo</label><input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} /></div>
                <div><label className="text-xs font-medium">Carga horária semanal</label><input type="number" min="0" step="1" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" value={editForm.weekly_hours} onChange={(e) => setEditForm({ ...editForm, weekly_hours: e.target.value })} /></div>
              </>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => { setEditing(false); setEditError(""); }} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEditing} disabled={saving || !editForm.full_name.trim()}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </Card>
      ) : null}

      <Card className="mb-4">
        <SectionTitle title="Controle de EPI" hint={worker.status === "desligado" ? "Confira a devolução dos equipamentos no desligamento." : "Marque os equipamentos entregues. A devolução fica disponível no desligamento."} />
        <div className="space-y-2">
          {[
            ["mascara_facial", "Máscara facial"], ["luva", "Luva"], ["oculos", "Óculos"], ["avental", "Avental"],
            ["caneleira", "Caneleira"], ["abafador", "Abafador"], ["uniforme", "Uniforme"], ["calcado", "Calçado"],
          ].map(([kind, label]) => {
            const epi = workerEpis.find((e) => e.worker_id === worker.id && e.epi_kind === kind);
            if (!epi) return null;
            return (
              <div key={epi.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <CheckCircle2 className={`size-4 ${epi.delivered ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{epi.delivered ? "Entregue em " + formatDate(epi.delivered_at) : "Ainda não entregue"}</p>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <label className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1.5">
                    <input type="checkbox" checked={epi.delivered} onChange={() => updateWorkerEpi(epi.id, { delivered: !epi.delivered, delivered_at: !epi.delivered ? toISO(new Date()) : null })} />
                    Entregue
                  </label>
                  <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${worker.status === "desligado" ? "bg-muted" : "bg-muted/50 text-muted-foreground"}`}>
                    <input type="checkbox" disabled={worker.status !== "desligado"} checked={epi.returned} onChange={() => updateWorkerEpi(epi.id, { returned: !epi.returned, returned_at: !epi.returned ? toISO(new Date()) : null })} />
                    <RotateCcw className="size-3" />
                    Devolvido
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        {worker.status !== "desligado" ? <p className="mt-3 text-[11px] text-muted-foreground">No desligamento, esta mesma ficha será usada para marcar o que foi devolvido.</p> : null}
      </Card>
      {worker.employment_type === "contratado" ? (
        <Card className="mb-4">
          <SectionTitle title="Benefícios, férias e 13º" />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-muted-foreground">Vale-transporte</p><p className="font-semibold">{brl(worker.benefits?.transport_voucher ?? 0)}</p></div>
            <div><p className="text-muted-foreground">Vale-alimentação</p><p className="font-semibold">{brl(worker.benefits?.meal_voucher ?? 0)}</p></div>
            <div><p className="text-muted-foreground">Carga horária</p><p className="font-semibold">{worker.weekly_hours ?? "—"}h/semana</p></div>
            <div><p className="text-muted-foreground">Cargo</p><p className="font-semibold">{worker.position ?? "—"}</p></div>
            <div>
              <p className="text-muted-foreground">Férias</p>
              <p className="font-semibold">
                {worker.vacation ? `${formatDate(worker.vacation.due_date)} (${worker.vacation.status})` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">13º salário</p>
              <p className="font-semibold">
                {worker.thirteenth
                  ? `${formatDate(worker.thirteenth.first_installment)} / ${formatDate(worker.thirteenth.second_installment)}`
                  : "—"}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <SectionTitle title="Documentos" action={<Button size="sm" variant="outline"><Upload className="size-3.5" /> Anexar</Button>} />
      <div className="mb-5 space-y-2">
        {docs.length === 0 ? <EmptyState text="Nenhum documento anexado." /> : null}
        {docs.map((d) => {
          const days = d.expires_at ? daysUntil(d.expires_at) : null;
          return (
            <div key={d.id} className="card-surface flex items-center gap-3 p-3">
              <FileText className="size-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{docLabels[d.kind]}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.file_name} · validade {formatDate(d.expires_at)}
                </p>
              </div>
              {days !== null ? (
                <Badge tone={days < 0 ? "danger" : days <= 45 ? "warning" : "success"}>
                  {days < 0 ? "vencido" : `${days}d`}
                </Badge>
              ) : null}
            </div>
          );
        })}
      </div>

      <SectionTitle title="Presença no mês" hint={`${monthRows.filter((r) => r.status === "presente").length} dias trabalhados`} />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {monthRows
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((r) => (
            <span
              key={r.id}
              title={`${formatDate(r.date)} — ${r.status}`}
              className={`flex size-8 items-center justify-center rounded-lg text-[11px] font-semibold ${
                r.status === "presente"
                  ? "bg-primary-soft text-primary-deep"
                  : r.status === "falta"
                    ? "bg-destructive/12 text-destructive"
                    : r.status === "atestado"
                      ? "bg-info/12 text-info"
                      : "bg-warning/20 text-warning-foreground"
              }`}
            >
              {r.date.slice(-2)}
            </span>
          ))}
        {monthRows.length === 0 ? <EmptyState text="Sem registros de ponto neste mês." /> : null}
      </div>

      <SectionTitle title="Histórico de pagamentos" />
      <div className="mb-5 space-y-2">
        {history.length === 0 ? <EmptyState text="Nenhum pagamento registrado." /> : null}
        {history.map((p) => (
          <div key={p.id} className="card-surface flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-semibold">{brl(p.gross_amount)}</p>
              <p className="text-xs text-muted-foreground">
                {p.worked_days} dias · {p.paid_at ? formatDate(p.paid_at) : "pendente"}
              </p>
            </div>
            <Badge tone={p.status === "pago" ? "success" : "warning"}>{p.status}</Badge>
          </div>
        ))}
      </div>

      <SectionTitle title="Histórico de eventos" hint="Advertências, promoções e mudanças de função" />
      <div className="space-y-2">
        {events.length === 0 ? <EmptyState text="Nenhum evento registrado." /> : null}
        {events.map((e) => (
          <div key={e.id} className="card-surface p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold capitalize">{e.kind.replace("_", " ")}</p>
              <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
