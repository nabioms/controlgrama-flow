import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Pencil, Plus, Target, TrendingUp, X, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, SectionTitle, StatCard } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import { toISO } from "@/lib/format";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas de produção — ControlGrama" },
      { name: "description", content: "Metas mensais e acompanhamento semanal da produção de corte em metros quadrados." },
      { property: "og:title", content: "Metas de produção — ControlGrama" },
      { property: "og:description", content: "Acompanhe metas mensais e semanais da produção de corte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetasPage,
});

const pad=(n:number)=>String(n).padStart(2,"0");
const shiftMonth=(month:string,amount:number)=>{const [y,m]=month.split("-").map(Number);const d=new Date(y,m-1+amount,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;};
const monthTitle=(month:string)=>{const [y,m]=month.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});};
const iso=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseM2=(value:string|number)=>{
  if(typeof value==="number")return Number.isFinite(value)?value:NaN;
  const clean=value.trim().replace(/\s/g,"");
  if(!clean)return NaN;
  let normalized=clean;
  if(clean.includes(","))normalized=clean.replace(/\./g,"").replace(",",".");
  else if(/^\d{1,3}(?:\.\d{3})+$/.test(clean))normalized=clean.replace(/\./g,"");
  if(!/^\d+(?:\.\d+)?$/.test(normalized))return NaN;
  return Number(normalized);
};
const formatM2=(v:number)=>Number.isFinite(v)?v.toLocaleString("pt-BR",{maximumFractionDigits:2}):"0";
const distributeTarget=(target:number,count:number)=>{
  const cents=Math.round(target*100);
  const base=Math.floor(cents/count);
  const remainder=cents-base*count;
  return Array.from({length:count},(_,index)=>(base+(index<remainder?1:0))/100);
};

function monthWeeks(month:string){
  const [year,monthNumber]=month.split("-").map(Number);
  const first=new Date(year,monthNumber-1,1);
  const last=new Date(year,monthNumber,0);
  const cursor=new Date(first);
  const result:{week_number:number;start_date:string;end_date:string}[]=[];
  if(cursor.getDay()===0)cursor.setDate(cursor.getDate()+1);
  while(cursor<=last){
    const start=new Date(cursor);
    const daysUntilSaturday=6-start.getDay();
    const end=new Date(start);
    end.setDate(end.getDate()+daysUntilSaturday);
    if(end>last)end.setTime(last.getTime());
    result.push({week_number:result.length+1,start_date:iso(start),end_date:iso(end)});
    cursor.setTime(end.getTime());
    cursor.setDate(cursor.getDate()+2);
  }
  return result;
}

function productionForMonth(serviceOrders:any[],serviceTypes:any[],month:string){
  return serviceOrders.filter(o=>o.service_date.startsWith(month)&&o.status==="realizada").reduce((sum,o)=>{
    const items=o.items||[];
    if(items.length)return sum+items.reduce((s:any,i:any)=>{const t=i.service_type||serviceTypes.find((x:any)=>x.id===i.service_type_id);return s+(t?.unit==="m2"?Number(i.realized_quantity??0):0);},0);
    const t=o.service_type||serviceTypes.find((x:any)=>x.id===o.service_type_id);
    return sum+(t?.unit==="m2"?Number(o.realized_quantity??0):0);
  },0);
}

function plannedForMonth(serviceOrders:any[],serviceTypes:any[],month:string){
  return serviceOrders.filter(o=>o.service_date.startsWith(month)&&o.status==="aberta").reduce((sum,o)=>{
    const items=o.items||[];
    if(items.length)return sum+items.reduce((s:any,i:any)=>{const t=i.service_type||serviceTypes.find((x:any)=>x.id===i.service_type_id);return s+(t?.unit==="m2"?Number(i.planned_quantity||0):0);},0);
    const t=o.service_type||serviceTypes.find((x:any)=>x.id===o.service_type_id);
    return sum+(t?.unit==="m2"?Number(o.planned_quantity||0):0);
  },0);
}

function MetasPage(){
  const {productionGoals,productionGoalWeeks,serviceOrders,serviceTypes,saveProductionGoal,deleteProductionGoal}=useStore();
  const today=toISO(new Date()).slice(0,7);
  const [month,setMonth]=useState(today);
  const [editing,setEditing]=useState(false);
  const [targetInput,setTargetInput]=useState("");
  const [weekInputs,setWeekInputs]=useState<Record<number,string>>({});
  const [error,setError]=useState("");

  const goal=productionGoals.find(g=>g.month===month)||null;
  const weeks=useMemo(()=>monthWeeks(month),[month]);
  const savedWeeks=productionGoalWeeks.filter(w=>w.goal_id===goal?.id).sort((a,b)=>a.week_number-b.week_number);
  const target=goal?.target_m2||0;
  const realized=useMemo(()=>productionForMonth(serviceOrders,serviceTypes,month),[serviceOrders,serviceTypes,month]);
  const planned=useMemo(()=>plannedForMonth(serviceOrders,serviceTypes,month),[serviceOrders,serviceTypes,month]);
  const percent=target>0?Math.min(100,(realized/target)*100):0;
  const remaining=Math.max(0,target-realized);
  const completedWeek=weeks.map((w,index)=>{
    const saved=savedWeeks.find(x=>x.week_number===w.week_number);
    const weekTarget=Number(saved?.target_m2||0);
    const achieved=serviceOrders.filter(o=>o.service_date>=w.start_date&&o.service_date<=w.end_date&&o.status==="realizada").reduce((sum,o)=>{
      const items=o.items||[];
      if(items.length)return sum+items.reduce((s:any,i:any)=>{const t=i.service_type||serviceTypes.find((x:any)=>x.id===i.service_type_id);return s+(t?.unit==="m2"?Number(i.realized_quantity??0):0);},0);
      const t=o.service_type||serviceTypes.find((x:any)=>x.id===o.service_type_id);return sum+(t?.unit==="m2"?Number(o.realized_quantity??0):0);
    },0);
    return {...w,target:weekTarget,achieved,remaining:Math.max(0,weekTarget-achieved),percent:weekTarget?Math.min(100,achieved/weekTarget*100):0,index};
  });
  const openEditor=()=>{
    const defaultTarget=goal?.target_m2||"";
    const distributed=distributeTarget(Number(goal?.target_m2||0),Math.max(1,weeks.length));
    setTargetInput(defaultTarget?String(defaultTarget):"");
    setWeekInputs(Object.fromEntries(weeks.map((w,index)=>[w.week_number,String(savedWeeks.find(x=>x.week_number===w.week_number)?.target_m2??distributed[index]??0)])));
    setEditing(true);setError("");
  };
  const changeTarget=(value:string)=>{
    setTargetInput(value);
    const n=parseM2(value);
    if(Number.isFinite(n)&&n>0){
      const distributed=distributeTarget(n,weeks.length);
      setWeekInputs(Object.fromEntries(weeks.map((w,index)=>[w.week_number,String(distributed[index]??0)])));
    }
  };
  const save=async()=>{
    try{
      setError("");
      const targetValue=parseM2(targetInput);
      const rows=weeks.map(w=>({...w,target_m2:parseM2(weekInputs[w.week_number]||"0")}));
      const sum=rows.reduce((s,w)=>s+w.target_m2,0);
      if(!Number.isFinite(targetValue)||targetValue<=0)throw new Error("Informe uma meta mensal válida em m².");
      if(rows.some(row=>!Number.isFinite(row.target_m2)||row.target_m2<0))throw new Error("Confira os valores das metas semanais.");
      if(Math.round(sum*100)!==Math.round(targetValue*100))throw new Error(`As metas semanais somam ${formatM2(sum)} m²; ajuste para fechar em ${formatM2(targetValue)} m².`);
      await saveProductionGoal({month,target_m2:targetValue,weeks:rows});
      setEditing(false);
    }catch(e:any){setError(e?.message||"Não foi possível salvar a meta.");}
  };
  const hasGoal=Boolean(goal);
  return <AppShell title="Metas de produção" subtitle="Acompanhe a meta de corte em m² por mês e por semana">
    <div className="mb-4 flex items-center justify-between gap-2">
      <button className="rounded-xl border p-2" onClick={()=>setMonth(shiftMonth(month,-1))} aria-label="Mês anterior"><ChevronLeft className="size-4"/></button>
      <div className="text-center">
        <p className="text-base font-bold capitalize">{monthTitle(month)}</p>
        <p className="text-[11px] text-muted-foreground">Produção considerada: somente O.S. finalizadas como realizada</p>
      </div>
      <button className="rounded-xl border p-2" onClick={()=>setMonth(shiftMonth(month,1))} aria-label="Próximo mês"><ChevronRight className="size-4"/></button>
    </div>

    <Card className="mb-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Target className="size-5"/></div>
          <div><p className="text-sm font-semibold">Meta mensal de corte</p><p className="text-xs text-muted-foreground">{hasGoal?"Meta definida para este mês":"Nenhuma meta definida ainda"}</p></div>
        </div>
        <Button variant="outline" onClick={openEditor}><Pencil className="size-4"/>{hasGoal?"Editar":"Definir meta"}</Button>
      </div>
      {hasGoal?<div className="mt-4">
        <div className="flex items-end justify-between gap-3"><div><p className="font-display text-3xl font-bold">{formatM2(realized)} <span className="text-sm font-semibold text-muted-foreground">m²</span></p><p className="text-xs text-muted-foreground">de {formatM2(target)} m² realizados</p></div><Badge tone={percent>=100?"success":percent>=70?"info":"warning"}>{percent.toFixed(0)}%</Badge></div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${percent}%`}}/></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-muted/50 p-2"><p className="text-[10px] uppercase text-muted-foreground">Falta</p><p className="text-sm font-bold">{formatM2(remaining)} m²</p></div><div className="rounded-xl bg-muted/50 p-2"><p className="text-[10px] uppercase text-muted-foreground">O.S. em aberto</p><p className="text-sm font-bold">{formatM2(planned)} m²</p></div><div className="rounded-xl bg-muted/50 p-2"><p className="text-[10px] uppercase text-muted-foreground">Saldo + aberto</p><p className="text-sm font-bold">{formatM2(realized+planned)} m²</p></div></div>
      </div>:<EmptyState text="Defina uma meta mensal para começar o acompanhamento."/>}
    </Card>

    {hasGoal?<Card className="mb-4">
      <SectionTitle title="Acompanhamento semanal" hint="A produção é abatida automaticamente quando uma O.S. de m² é finalizada como realizada."/>
      <div className="space-y-4">
        {completedWeek.map(w=><div key={w.week_number}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><div><span className="font-semibold">Semana {w.week_number}</span><span className="ml-2 text-muted-foreground">{w.start_date.slice(8,10)}/{w.start_date.slice(5,7)} — {w.end_date.slice(8,10)}/{w.end_date.slice(5,7)}</span></div><span className="font-semibold">{formatM2(w.achieved)} / {formatM2(w.target)} m²</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${w.percent}%`}}/></div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{w.percent.toFixed(0)}% da semana</span><span>{w.achieved>=w.target&&w.target>0?"Meta atingida":`${formatM2(w.remaining)} m² restantes`}</span></div>
        </div>)}
      </div>
    </Card>:null}

    <div className="mb-4 grid grid-cols-2 gap-2">
      <StatCard label="Realizado" value={`${formatM2(realized)} m²`} sub="O.S. finalizadas" tone="success" icon={<CheckCircle2 className="size-4"/>}/>
      <StatCard label="Em aberto" value={`${formatM2(planned)} m²`} sub="produção planejada" tone="warning" icon={<TrendingUp className="size-4"/>}/>
    </div>

    {editing?<div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-3 sm:items-center">
      <Card className="max-h-[90vh] w-full max-w-xl overflow-auto p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-lg font-semibold">Configurar meta</p><p className="text-xs text-muted-foreground">A meta mensal será distribuída igualmente nas semanas. Você pode ajustar cada semana.</p></div><button onClick={()=>setEditing(false)} className="rounded-lg p-2"><X className="size-4"/></button></div>
        <label className="mt-4 block text-xs font-semibold">Meta do mês (m²)<input className="input mt-1" inputMode="decimal" value={targetInput} onChange={e=>changeTarget(e.target.value)} placeholder="Ex.: 65000"/></label>
        <div className="mt-4 rounded-xl border p-3"><div className="mb-3 flex items-center gap-2"><CalendarDays className="size-4 text-primary"/><p className="text-sm font-semibold">Distribuição semanal</p></div><div className="space-y-2">{weeks.map(w=><label key={w.week_number} className="grid grid-cols-[1fr_150px] items-center gap-3 rounded-xl bg-muted/40 p-3 text-xs"><span><strong>Semana {w.week_number}</strong><br/><span className="text-muted-foreground">{w.start_date.slice(8,10)}/{w.start_date.slice(5,7)} — {w.end_date.slice(8,10)}/{w.end_date.slice(5,7)}</span></span><input className="input" inputMode="decimal" value={weekInputs[w.week_number]||""} onChange={e=>setWeekInputs(x=>({...x,[w.week_number]:e.target.value}))}/></label>)}</div><p className="mt-3 text-[11px] text-muted-foreground">Total distribuído: <strong>{formatM2(weeks.reduce((s,w)=>s+parseM2(weekInputs[w.week_number]||"0"),0))} m²</strong> de {formatM2(parseM2(targetInput))} m²</p></div>
        {error&&<p className="mt-3 text-xs font-semibold text-destructive">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2"><Button onClick={save}>Salvar meta</Button><Button variant="outline" onClick={()=>setEditing(false)}>Cancelar</Button></div>
        {hasGoal?<button className="mt-3 w-full text-xs font-semibold text-destructive" onClick={async()=>{if(window.confirm("Excluir a meta deste mês?")){await deleteProductionGoal(month);setEditing(false);}}}>Excluir meta deste mês</button>:null}
      </Card>
    </div>:null}
  </AppShell>;
}
