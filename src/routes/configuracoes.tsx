import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Settings, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, SectionTitle } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import type { ServiceUnit } from "@/lib/types";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/configuracoes")({
  component: ConfiguracoesPage,
});

const unitLabel: Record<ServiceUnit, string> = { m2: "m²", km: "km", hora: "hora", unidade: "unidade" };

function suggestedRate(name: string, unit: ServiceUnit, current: number) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (unit === "m2" && /trator/.test(normalized)) return 0.165;
  if (unit === "m2" && /(rocada|roçada|maquina|maquina)/.test(normalized)) return 0.31;
  if (unit === "m2" && /(capina|carpina)/.test(normalized)) return 0.55;
  if (unit === "km" && /(varr|varre)/.test(normalized)) return 40;
  return current;
}

function ConfiguracoesPage() {
  const { serviceTypes, updateServiceType, role } = useStore();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPrices(Object.fromEntries(serviceTypes.map((service) => [
      service.id,
      String(suggestedRate(service.name, service.unit, Number(service.unit_price))),
    ])));
  }, [serviceTypes]);

  const changedCount = useMemo(
    () => serviceTypes.filter((service) => {
      const value = Number(String(prices[service.id] ?? "").replace(",", "."));
      return Number.isFinite(value) && value >= 0 && value !== Number(service.unit_price);
    }).length,
    [prices, serviceTypes],
  );

  async function savePrices() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      for (const service of serviceTypes) {
        const raw = String(prices[service.id] ?? "").trim().replace(",", ".");
        const value = Number(raw);
        if (!raw || !Number.isFinite(value) || value < 0) {
          throw new Error(`Informe um valor válido para ${service.name}.`);
        }
      }
      for (const service of serviceTypes) {
        const value = Number(String(prices[service.id]).replace(",", "."));
        if (value !== Number(service.unit_price)) {
          await updateServiceType(service.id, { unit_price: value });
        }
      }
      setMessage("Tabela de preços atualizada com sucesso. Os novos valores serão usados nas próximas O.S.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a tabela de preços.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Configurações" subtitle="Tabela de preços e valores dos serviços">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Settings className="size-5" /></div>
        <div><h2 className="text-lg font-bold">Tabela de preços</h2><p className="text-sm text-muted-foreground">Altere os valores quando houver reajuste no contrato.</p></div>
      </div>

      {role !== "admin" ? (
        <Card><p className="text-sm font-semibold">Somente o administrador pode alterar os valores da tabela.</p></Card>
      ) : (
        <>
          <Card className="mb-4">
            <SectionTitle title="Valores por serviço" hint="Os valores sugeridos para o reajuste já estão preenchidos nos serviços reconhecidos. Confira antes de salvar." />
            {serviceTypes.length ? <div className="space-y-3">
              {serviceTypes.map((service) => (
                <div key={service.id} className="grid grid-cols-[minmax(0,1fr)_135px] items-center gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{service.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Atual: {brl(Number(service.unit_price))}/{unitLabel[service.unit]}{!service.active ? " · inativo" : ""}</p>
                  </div>
                  <label className="text-xs font-semibold">Novo valor
                    <input
                      className="input mt-1"
                      type="number"
                      min="0"
                      step={service.unit === "m2" ? "0.001" : "0.01"}
                      inputMode="decimal"
                      value={prices[service.id] ?? ""}
                      onChange={(event) => setPrices((current) => ({ ...current, [service.id]: event.target.value }))}
                      aria-label={`Novo valor de ${service.name}`}
                    />
                    <span className="mt-1 block text-[10px] text-muted-foreground">por {unitLabel[service.unit]}</span>
                  </label>
                </div>
              ))}
            </div> : <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>}
            {error && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>}
            {message && <p className="mt-3 flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{message}</p>}
            <Button className="mt-4 w-full" disabled={saving || changedCount === 0} onClick={savePrices}>
              <Save className="size-4" />{saving ? "Salvando..." : `Salvar alterações (${changedCount})`}
            </Button>
          </Card>
          <p className="px-1 text-xs leading-5 text-muted-foreground">Importante: o reajuste altera os valores usados nas próximas ordens de serviço. O histórico de O.S. já registradas não deve ser reprecificado automaticamente.</p>
        </>
      )}
    </AppShell>
  );
}
