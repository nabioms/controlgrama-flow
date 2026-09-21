import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { workerDocuments, workerEvents } from "@/lib/mock-data";
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
  const { workers, attendance, payments, updateWorker } = useStore();
  const worker = workers.find((w) => w.id === workerId);

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
          <div><dt className="text-muted-foreground">Admissão</dt><dd className="font-semibold">{formatDate(worker.admission_date)}</dd></div>
          <div className="col-span-2"><dt className="text-muted-foreground">Endereço</dt><dd className="font-semibold">{worker.address || "—"}</dd></div>
        </dl>
        <div className="mt-3 flex gap-2">
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
            <Button size="sm" variant="soft" onClick={() => updateWorker(worker.id, { status: "ativo", termination_date: null, termination_reason: null })}>
              Reativar
            </Button>
          )}
        </div>
        {worker.termination_reason ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Desligado em {formatDate(worker.termination_date)} — {worker.termination_reason}
          </p>
        ) : null}
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
