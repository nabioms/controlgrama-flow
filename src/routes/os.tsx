import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Plus, Settings2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, SectionTitle, StatCard } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import type { ServiceUnit } from "@/lib/types";
import { brl, formatDate, toISO } from "@/lib/format";

export const Route = createFileRoute("/os")({ component: ServiceOrdersPage });

const unitLabel: Record<ServiceUnit,string> = { m2:"m²", km:"km", hora:"hora", unidade:"unidade" };

function ServiceOrdersPage() {
  const { serviceTypes, serviceOrders, contracts, addServiceType, updateServiceType, addServiceOrder, finalizeServiceOrder } = useStore();
  const today=toISO(new Date());
  const [date,setDate]=useState(today);
  const [typeId,setTypeId]=useState("");
  const [contractId,setContractId]=useState("");
  const [quantity,setQuantity]=useState("");
  const [notes,setNotes]=useState("");
  const [showTypes,setShowTypes]=useState(false);
  const [typeName,setTypeName]=useState("");
  const [typeUnit,setTypeUnit]=useState<ServiceUnit>("m2");
  const [typePrice,setTypePrice]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  const activeTypes=serviceTypes.filter(x=>x.active);
  const selected=activeTypes.find(x=>x.id===typeId);
  const plannedAmount=selected ? Number(quantity||0)*Number(selected.unit_price) : 0;
  const dayOrders=useMemo(()=>serviceOrders.filter(o=>o.service_date===date),[serviceOrders,date]);
  const realized=dayOrders.filter(o=>o.status==="realizada").reduce((s,o)=>s+Number(o.realized_amount),0);
  const pending=dayOrders.filter(o=>o.status==="aberta").length;
  const notDone=dayOrders.filter(o=>o.status==="nao_realizada").length;

  async function createOrder(){
    setError(""); setSaving(true);
    try {
      await addServiceOrder({service_date:date,service_type_id:typeId,contract_id:contractId||null,planned_quantity:Number(quantity),notes:notes||null});
      setQuantity("");setNotes("");
    } catch(e:any){setError(e?.message||"Não foi possível abrir a O.S.");}
    finally{setSaving(false);}
  }

  async function createType(){
    setError("");
    try {
      await addServiceType(typeName,typeUnit,Number(typePrice));
      setTypeName("");setTypePrice("");
    } catch(e:any){setError(e?.message||"Não foi possível cadastrar o serviço.");}
  }

  async function finish(id:string,status:"realizada"|"nao_realizada"){
    setError("");
    try{
      if(status==="realizada"){
        const order=serviceOrders.find(o=>o.id===id);
        const raw=window.prompt("Quantidade realizada:",String(order?.planned_quantity??""));
        if(raw===null)return;
        const q=Number(raw);
        if(!q||q<0){setError("Informe uma quantidade realizada válida.");return;}
        await finalizeServiceOrder(id,status,q);
      } else {
        if(!window.confirm("Marcar esta O.S. como NÃO realizada? Ela ficará registrada, mas não entrará na produção."))return;
        await finalizeServiceOrder(id,status);
      }
    }catch(e:any){setError(e?.message||"Não foi possível finalizar a O.S.");}
  }

  return <AppShell title="Ordens de serviço" subtitle="Produção diária e valor realizado">
    <div className="grid grid-cols-3 gap-2.5 mb-4">
      <StatCard label="Produção do dia" value={brl(realized)} sub="somente O.S. realizadas" tone="success" icon={<CheckCircle2 className="size-4"/>}/>
      <StatCard label="Em aberto" value={String(pending)} sub="aguardando execução" tone="warning" icon={<ClipboardList className="size-4"/>}/>
      <StatCard label="Não realizadas" value={String(notDone)} sub="fora da produção" tone="info" icon={<XCircle className="size-4"/>}/>
    </div>

    <Card className="mb-5">
      <SectionTitle title="Abrir O.S." hint="Informe o serviço e a quantidade prevista"/>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Data<input className="input mt-1" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        <label className="text-xs font-semibold">Tipo de serviço<select className="input mt-1" value={typeId} onChange={e=>setTypeId(e.target.value)}><option value="">Selecione...</option>{activeTypes.map(t=><option key={t.id} value={t.id}>{t.name} — {brl(Number(t.unit_price))}/{unitLabel[t.unit]}</option>)}</select></label>
        <label className="text-xs font-semibold">Quantidade prevista<input className="input mt-1" type="number" min="0" step="0.01" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder={selected?unitLabel[selected.unit]:"ex.: 10000"}/></label>
        <label className="text-xs font-semibold">Contrato (opcional)<select className="input mt-1" value={contractId} onChange={e=>setContractId(e.target.value)}><option value="">Sem contrato</option>{contracts.filter(c=>c.status==="vigente").map(c=><option key={c.id} value={c.id}>{c.number} — {c.agency}</option>)}</select></label>
      </div>
      {selected && <div className="mt-3 rounded-xl bg-muted p-3 text-sm"><span className="text-muted-foreground">Cálculo:</span> {Number(quantity||0).toLocaleString("pt-BR")} {unitLabel[selected.unit]} × {brl(Number(selected.unit_price))} = <strong>{brl(plannedAmount)}</strong></div>}
      <label className="mt-3 block text-xs font-semibold">Observação<textarea className="input mt-1 min-h-20" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Frente, local, equipe ou observação da execução..."/></label>
      {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
      <Button className="mt-3 w-full" disabled={saving||!typeId||Number(quantity)<=0} onClick={createOrder}><Plus className="size-4"/> Abrir O.S.</Button>
    </Card>

    <div className="mb-4 flex items-center justify-between gap-3">
      <div><SectionTitle title="Serviços cadastrados" hint="Valores usados no cálculo das O.S."/></div>
      <Button variant="outline" onClick={()=>setShowTypes(v=>!v)}><Settings2 className="size-4"/> {showTypes?"Fechar":"Gerenciar"}</Button>
    </div>
    {showTypes && <Card className="mb-5">
      <div className="grid gap-2 sm:grid-cols-[1fr_130px_150px_auto]">
        <input className="input" value={typeName} onChange={e=>setTypeName(e.target.value)} placeholder="Nome do serviço"/>
        <select className="input" value={typeUnit} onChange={e=>setTypeUnit(e.target.value as ServiceUnit)}><option value="m2">m²</option><option value="km">km</option><option value="hora">hora</option><option value="unidade">unidade</option></select>
        <input className="input" type="number" step="0.0001" min="0" value={typePrice} onChange={e=>setTypePrice(e.target.value)} placeholder="Valor unitário"/>
        <Button disabled={!typeName.trim()||Number(typePrice)<0} onClick={createType}>Adicionar</Button>
      </div>
      <div className="mt-3 space-y-2">{serviceTypes.map(t=><div key={t.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">{brl(Number(t.unit_price))}/{unitLabel[t.unit]}</p></div><Button variant="outline" onClick={()=>updateServiceType(t.id,{active:!t.active})}>{t.active?"Desativar":"Ativar"}</Button></div>)}</div>
    </Card>}

    <SectionTitle title={`O.S. de ${formatDate(date)}`} hint={`${dayOrders.length} ordem(ns)`}/>
    <div className="space-y-2">
      {dayOrders.map(o=><Card key={o.id} className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-sm font-semibold">O.S. #{o.order_number} · {o.service_type?.name}</p><p className="text-xs text-muted-foreground">{Number(o.planned_quantity).toLocaleString("pt-BR")} {o.service_type?unitLabel[o.service_type.unit]:""} × {brl(Number(o.unit_price))}</p>{o.notes&&<p className="mt-1 text-xs text-muted-foreground">{o.notes}</p>}</div>
          <Badge tone={o.status==="realizada"?"success":o.status==="nao_realizada"?"danger":"warning"}>{o.status==="realizada"?"REALIZADA":o.status==="nao_realizada"?"NÃO REALIZADA":"ABERTA"}</Badge>
        </div>
        <div className="mt-3 flex items-center justify-between"><div><p className="text-[11px] text-muted-foreground">Previsto</p><p className="font-semibold">{brl(Number(o.planned_amount))}</p></div><div className="text-right"><p className="text-[11px] text-muted-foreground">{o.status==="realizada"?"Realizado":"Valor da O.S."}</p><p className="font-semibold">{brl(Number(o.status==="realizada"?o.realized_amount:o.planned_amount))}</p></div></div>
        {o.status==="aberta"&&<div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={()=>finish(o.id,"realizada")}><CheckCircle2 className="size-4"/> OK — realizada</Button><Button variant="outline" onClick={()=>finish(o.id,"nao_realizada")}><XCircle className="size-4"/> Não OK</Button></div>}
      </Card>)}
      {!dayOrders.length&&<EmptyState title="Nenhuma O.S. neste dia" description="Abra a primeira ordem acima para registrar a produção."/>}
    </div>
  </AppShell>;
}
