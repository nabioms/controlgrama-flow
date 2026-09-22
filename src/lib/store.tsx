import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { businessDay, daysUntil, toISO } from "./format";
import type { Attendance, AttendanceStatus, CashFlowMonth, Contract, ExpenseCategory, Invoice, Payable, Payment, PaymentMethod, PaymentPeriod, Receivable, ServiceOrder, ServiceOrderStatus, ServiceType, Team, UserRole, Worker, WorkerDocument, WorkerEvent } from "./types";

interface Store {
  role: UserRole; workers: Worker[]; contracts: Contract[]; expenseCategories: ExpenseCategory[]; invoices: Invoice[];
  workerDocuments: WorkerDocument[]; workerEvents: WorkerEvent[]; attendance: Attendance[]; paymentPeriods: PaymentPeriod[];
  payments: Payment[]; receivables: Receivable[]; payables: Payable[]; cashFlowHistory: CashFlowMonth[]; teams: Team[]; serviceTypes: ServiceType[]; serviceOrders: ServiceOrder[];
  nextPayDate: {date:string;label:string;days:number}; cashBalance:number; loading:boolean; error:string|null;
  refresh:()=>Promise<void>; addWorker:(w:Worker,teamId?:string|null)=>Promise<void>; updateWorker:(id:string,patch:Partial<Worker>)=>Promise<void>;
  setAttendanceStatus:(workerId:string,date:string,status:AttendanceStatus,notes:string,contractId:string|null,workFraction?:number)=>Promise<void>;
  closePeriod:(id:string)=>Promise<void>; markPaymentPaid:(id:string,m:PaymentMethod)=>Promise<void>;
  markReceived:(id:string)=>Promise<void>; addPayable:(p:Payable)=>Promise<void>; markPayablePaid:(id:string)=>Promise<void>;
  addTeam:(name:string,foremanWorkerId:string|null)=>Promise<void>; updateTeam:(id:string,patch:Partial<Pick<Team,"name"|"foreman_worker_id"|"active">>)=>Promise<void>; setTeamMembers:(teamId:string,workerIds:string[])=>Promise<void>;
  addServiceType:(name:string,unit:ServiceType["unit"],unitPrice:number)=>Promise<void>;
  updateServiceType:(id:string,patch:Partial<Pick<ServiceType,"name"|"unit"|"unit_price"|"active">>)=>Promise<void>;
  addServiceOrder:(input:{service_date:string;service_type_id:string;contract_id:string|null;team_id:string;planned_quantity:number;notes:string|null})=>Promise<void>;
  finalizeServiceOrder:(id:string,status:Exclude<ServiceOrderStatus,"aberta">,realizedQuantity?:number)=>Promise<void>;
}
const StoreContext=createContext<Store|null>(null);
const date=(v:any)=>v?v.slice(0,10):null;
const worker=(r:any):Worker=>({...r,admission_date:date(r.admission_date),termination_date:date(r.termination_date),created_at:date(r.created_at)||toISO(new Date())});
const payable=(r:any):Payable=>({...r,due_date:date(r.due_date),paid_at:date(r.paid_at)});
const receivable=(r:any):Receivable=>({...r,expected_date:date(r.expected_date),received_at:date(r.received_at)});
const payment=(r:any):Payment=>({...r,paid_at:date(r.paid_at)});

export function StoreProvider({children}:{children:ReactNode}){
 const [role,setRole]=useState<UserRole>("encarregado"),[workers,setWorkers]=useState<Worker[]>([]),[contracts,setContracts]=useState<Contract[]>([]);
 const [expenseCategories,setExpenseCategories]=useState<ExpenseCategory[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]),[workerDocuments,setWorkerDocuments]=useState<WorkerDocument[]>([]),[workerEvents,setWorkerEvents]=useState<WorkerEvent[]>([]);
 const [attendance,setAttendance]=useState<Attendance[]>([]),[paymentPeriods,setPaymentPeriods]=useState<PaymentPeriod[]>([]),[payments,setPayments]=useState<Payment[]>([]);
 const [receivables,setReceivables]=useState<Receivable[]>([]),[payables,setPayables]=useState<Payable[]>([]),[cashFlowHistory,setCashFlowHistory]=useState<CashFlowMonth[]>([]);
 const [teams,setTeams]=useState<Team[]>([]),[serviceTypes,setServiceTypes]=useState<ServiceType[]>([]),[serviceOrders,setServiceOrders]=useState<ServiceOrder[]>([]);
 const [openingBalance,setOpeningBalance]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);

 const refresh=useCallback(async()=>{
  setLoading(true);setError(null);
  const q=await Promise.all([
   supabase.from("profiles").select("role").maybeSingle(),supabase.from("workers").select("*").order("full_name"),
   supabase.from("contracts").select("*").order("start_date",{ascending:false}),supabase.from("expense_categories").select("*").order("label"),
   supabase.from("invoices").select("*").order("issue_date",{ascending:false}),supabase.from("worker_documents").select("*").order("expires_at"),
   supabase.from("worker_events").select("*").order("date",{ascending:false}),supabase.from("attendance").select("*").order("date",{ascending:false}),
   supabase.from("payment_periods").select("*").order("pay_date",{ascending:false}),supabase.from("payments").select("*").order("created_at",{ascending:false}),
   supabase.from("receivables").select("*").order("expected_date"),supabase.from("payables").select("*").order("due_date"),
   supabase.from("cash_settings").select("opening_balance").eq("id",true).maybeSingle(),
   supabase.from("teams").select("*, team_members(team_id,worker_id,worker:workers(*))").order("name"),
   supabase.from("service_types").select("*").order("name"),
   supabase.from("service_orders").select("*, service_type:service_types(*), contract:contracts(*), team:teams(*), service_order_workers(worker_id, worker:workers(*))").order("service_date",{ascending:false}).order("order_number",{ascending:false})
  ]);
  const bad=q.find(x=>x.error); if(bad?.error){setError(bad.error.message);setLoading(false);return;}
  const [pr,w,c,cat,inv,docs,events,att,periods,pay,rec,pb,settings,tm,st,so]=q;
  setRole((pr.data?.role as UserRole)||"encarregado");setWorkers((w.data||[]).map(worker));setContracts(c.data||[]);setExpenseCategories(cat.data||[]);
  setInvoices(inv.data||[]);setWorkerDocuments(docs.data||[]);setWorkerEvents(events.data||[]);setAttendance(att.data||[]);setPaymentPeriods(periods.data||[]);
  setPayments((pay.data||[]).map(payment));setReceivables((rec.data||[]).map(receivable));setPayables((pb.data||[]).map(payable));
   const workerRows=(w.data||[]).map(worker);
  const teamRows:any[]=tm.data||[];
  setTeams(teamRows.map(t=>({...t,foreman:workerRows.find(x=>x.id===t.foreman_worker_id)||null,members:(t.team_members||[]).map((m:any)=>workerRows.find(x=>x.id===m.worker_id)||m.worker).filter(Boolean)})) as Team[]);
  const teamMap=new Map(teamRows.map(t=>[t.id,t]));
  setServiceTypes((st.data||[]) as ServiceType[]);
  setServiceOrders((so.data||[]).map((o:any)=>({...o,team:o.team_id?(teamMap.get(o.team_id)||o.team):o.team})) as ServiceOrder[]);
  const flowMap:Record<string,{month:string;inflow:number;outflow:number}>={};
  (rec.data||[]).filter((x:any)=>x.status==="recebido").forEach((x:any)=>{const m=String(x.received_at||x.expected_date).slice(0,7);flowMap[m]??={month:m,inflow:0,outflow:0};flowMap[m].inflow+=Number(x.expected_amount||0)});
  (pb.data||[]).filter((x:any)=>x.status==="pago").forEach((x:any)=>{const m=String(x.paid_at||x.due_date).slice(0,7);flowMap[m]??={month:m,inflow:0,outflow:0};flowMap[m].outflow+=Number(x.amount||0)});
  (pay.data||[]).filter((x:any)=>x.status==="pago").forEach((x:any)=>{const m=String(x.paid_at||x.created_at).slice(0,7);flowMap[m]??={month:m,inflow:0,outflow:0};flowMap[m].outflow+=Number(x.gross_amount||0)});
  setCashFlowHistory(Object.values(flowMap).sort((a,b)=>a.month.localeCompare(b.month)));
  setOpeningBalance(Number(settings.data?.opening_balance||0));setLoading(false);
 },[]);
 useEffect(()=>{refresh()},[refresh]);

 const addWorker=useCallback(async(w:Worker,teamId?:string|null)=>{const {id,...row}=w;const {data,error}=await supabase.from("workers").insert(row).select("*").single();if(error)throw error;const created=worker(data);if(teamId){const {error:teamError}=await supabase.from("team_members").insert({team_id:teamId,worker_id:created.id});if(teamError){await supabase.from("workers").delete().eq("id",created.id);throw teamError;}}setWorkers(x=>[created,...x]);await refresh()},[refresh]);
 const updateWorker=useCallback(async(id:string,patch:Partial<Worker>)=>{const row:any={...patch};delete row.id;delete row.created_at;const {data,error}=await supabase.from("workers").update(row).eq("id",id).select("*").single();if(error)throw error;setWorkers(x=>x.map(w=>w.id===id?worker(data):w))},[]);
 const setAttendanceStatus=useCallback(async(workerId:string,dateValue:string,status:AttendanceStatus,notes:string,contractId:string|null,workFraction=1)=>{
  const fraction=status==="presente"?workFraction:0;
  const {data,error}=await supabase.from("attendance").upsert({worker_id:workerId,date:dateValue,status,work_fraction:fraction,notes:notes||null,contract_id:contractId||null},{onConflict:"worker_id,date"}).select("*").single();
  if(error)throw error;
  setAttendance(x=>[data,...x.filter(a=>!(a.worker_id===workerId&&a.date===dateValue))]);
},[]);
 const closePeriod=useCallback(async(id:string)=>{
  const p=paymentPeriods.find(x=>x.id===id);if(!p)return;
  for(const w of workers.filter(x=>x.status!=="desligado")){
    const workedDays=attendance
      .filter(a=>a.worker_id===w.id&&a.date>=p.start_date&&a.date<=p.end_date&&a.status==="presente")
      .reduce((sum,a)=>sum+Number(a.work_fraction??1),0);
    if(!workedDays)continue;
    const gross=w.employment_type==="diarista"?workedDays*(w.daily_rate||0):(w.salary||0)*workedDays/30;
    const {error}=await supabase.from("payments").upsert({
      period_id:id,worker_id:w.id,worked_days:Math.round(workedDays*100)/100,
      daily_rate:w.employment_type==="diarista"?w.daily_rate:null,
      gross_amount:Math.round(gross*100)/100,status:"pendente"
    },{onConflict:"period_id,worker_id"});
    if(error)throw error;
  }
  const {error}=await supabase.from("payment_periods").update({status:"fechado"}).eq("id",id);
  if(error)throw error;
  await refresh();
},[paymentPeriods,workers,attendance,refresh]);
 const markPaymentPaid=useCallback(async(id:string,m:PaymentMethod)=>{const {error}=await supabase.from("payments").update({status:"pago",method:m,paid_at:new Date().toISOString()}).eq("id",id);if(error)throw error;await refresh()},[refresh]);
 const markReceived=useCallback(async(id:string)=>{const {error}=await supabase.from("receivables").update({status:"recebido",received_at:new Date().toISOString()}).eq("id",id);if(error)throw error;await refresh()},[refresh]);
 const addPayable=useCallback(async(p:Payable)=>{const {id,paid_at,...row}=p;const {data,error}=await supabase.from("payables").insert({...row,paid_at:null}).select("*").single();if(error)throw error;setPayables(x=>[payable(data),...x])},[]);
 const markPayablePaid=useCallback(async(id:string)=>{const {error}=await supabase.from("payables").update({status:"pago",paid_at:new Date().toISOString()}).eq("id",id);if(error)throw error;await refresh()},[refresh]);
 const addTeam=useCallback(async(name:string,foremanWorkerId:string|null)=>{const clean=name.trim();if(!clean)throw new Error("Informe o nome da equipe.");let foreman:Worker|null=null;if(foremanWorkerId){foreman=workers.find(w=>w.id===foremanWorkerId)||null;if(!foreman)throw new Error("Encarregado não encontrado.");if(foreman.job_role!=="encarregado")throw new Error("O responsável da equipe precisa estar cadastrado como encarregado.");}const {data,error}=await supabase.from("teams").insert({name:clean,foreman_worker_id:foremanWorkerId||null}).select("*").single();if(error)throw error;if(foremanWorkerId){await supabase.from("team_members").delete().eq("worker_id",foremanWorkerId);const {error:memberError}=await supabase.from("team_members").insert({team_id:data.id,worker_id:foremanWorkerId});if(memberError){await supabase.from("teams").delete().eq("id",data.id);throw memberError;}}await refresh()},[workers,refresh]);
 const updateTeam=useCallback(async(id:string,patch:Partial<Pick<Team,"name"|"foreman_worker_id"|"active">>)=>{if(patch.foreman_worker_id){const foreman=workers.find(w=>w.id===patch.foreman_worker_id);if(!foreman||foreman.job_role!=="encarregado")throw new Error("O responsável da equipe precisa estar cadastrado como encarregado.");const {error:moveError}=await supabase.from("team_members").delete().eq("worker_id",patch.foreman_worker_id);if(moveError)throw moveError;const {error:addError}=await supabase.from("team_members").insert({team_id:id,worker_id:patch.foreman_worker_id});if(addError)throw addError;}const {error}=await supabase.from("teams").update(patch).eq("id",id);if(error)throw error;await refresh()},[workers,refresh]);
useCallback(async(id:string,patch:Partial<Pick<Team,"name"|"foreman_worker_id"|"active">>)=>{if(patch.foreman_worker_id){const foreman=workers.find(w=>w.id===patch.foreman_worker_id);if(!foreman||foreman.job_role!=="encarregado")throw new Error("O responsável da equipe precisa estar cadastrado como encarregado.");const {error:moveError}=await supabase.from("team_members").delete().eq("worker_id",patch.foreman_worker_id);if(moveError)throw moveError;const {error:addError}=await supabase.from("team_members").insert({team_id:id,worker_id:patch.foreman_worker_id});if(addError)throw addError;}const {data,error}=await supabase.from("teams").update(patch).eq("id",id).select("*").single();if(error)throw error;setTeams(x=>x.map(t=>t.id===id?({...t,...data,foreman:data.foreman_worker_id?workers.find(w=>w.id===data.foreman_worker_id)||null:null,members:data.foreman_worker_id?[...(t.members||[]).filter(w=>w.id!==data.foreman_worker_id),workers.find(w=>w.id===data.foreman_worker_id)!].filter(Boolean):t.members}):t))},[workers]);
 const setTeamMembers=useCallback(async(teamId:string,workerIds:string[])=>{const unique=[...new Set(workerIds)];const {error:teamClearError}=await supabase.from("team_members").delete().eq("team_id",teamId);if(teamClearError)throw teamClearError;if(unique.length){const {error:moveError}=await supabase.from("team_members").delete().in("worker_id",unique);if(moveError)throw moveError;const {error:insError}=await supabase.from("team_members").insert(unique.map(worker_id=>({team_id:teamId,worker_id})));if(insError)throw insError;}await refresh()},[refresh]);
 const addServiceType=useCallback(async(name:string,unit:ServiceType["unit"],unitPrice:number)=>{
   const {data,error}=await supabase.from("service_types").insert({name:name.trim(),unit,unit_price:unitPrice}).select("*").single();
   if(error)throw error; setServiceTypes(x=>[data as ServiceType,...x]);
 },[]);
 const updateServiceType=useCallback(async(id:string,patch:Partial<Pick<ServiceType,"name"|"unit"|"unit_price"|"active">>)=>{
   const {data,error}=await supabase.from("service_types").update(patch).eq("id",id).select("*").single();
   if(error)throw error; setServiceTypes(x=>x.map(s=>s.id===id?data as ServiceType:s));
 },[]);
 const addServiceOrder=useCallback(async(input:{service_date:string;service_type_id:string;contract_id:string|null;team_id:string;planned_quantity:number;notes:string|null})=>{
   const type=serviceTypes.find(s=>s.id===input.service_type_id); if(!type)throw new Error("Tipo de serviço não encontrado.");
   const team=teams.find(t=>t.id===input.team_id); if(!team||!team.active)throw new Error("Selecione uma equipe ativa.");
   if(!team.foreman_worker_id)throw new Error("A equipe precisa ter um encarregado definido.");
   const memberIds=(team.members||[]).filter(w=>w.status!=="desligado").map(w=>w.id); if(!memberIds.length)throw new Error("A equipe precisa ter pelo menos um integrante.");
   const quantity=Number(input.planned_quantity); if(!quantity || quantity<=0)throw new Error("Informe uma quantidade maior que zero.");
   const {data:userData}=await supabase.auth.getUser();
   const {data,error}=await supabase.from("service_orders").insert({
     service_date:input.service_date,service_type_id:type.id,contract_id:input.contract_id||null,team_id:team.id,
     planned_quantity:quantity,unit_price:type.unit_price,planned_amount:Math.round(quantity*type.unit_price*100)/100,
     realized_quantity:null,realized_amount:0,status:"aberta",notes:input.notes||null,created_by:userData.user?.id||null
   }).select("*, service_type:service_types(*), contract:contracts(*), team:teams(*)").single();
   if(error)throw error;
   const {error:teamError}=await supabase.from("service_order_workers").insert(memberIds.map(worker_id=>({service_order_id:data.id,worker_id}))); if(teamError){await supabase.from("service_orders").delete().eq("id",data.id);throw teamError;}
   setServiceOrders(x=>[{...data,team} as ServiceOrder,...x]);
 },[serviceTypes,teams]);
 const finalizeServiceOrder=useCallback(async(id:string,status:Exclude<ServiceOrderStatus,"aberta">,realizedQuantity?:number)=>{
   const order=serviceOrders.find(o=>o.id===id); if(!order)throw new Error("O.S. não encontrada.");
   const quantity=status==="realizada"?(realizedQuantity==null?order.planned_quantity:Number(realizedQuantity)):0;
   if(status==="realizada" && quantity<0)throw new Error("Quantidade realizada inválida.");
   const amount=status==="realizada"?Math.round(quantity*order.unit_price*100)/100:0;
   const {data,error}=await supabase.from("service_orders").update({
     status,realized_quantity:status==="realizada"?quantity:null,realized_amount:amount,completed_at:new Date().toISOString()
   }).eq("id",id).select("*, service_type:service_types(*), contract:contracts(*), team:teams(*)").single();
   if(error)throw error; setServiceOrders(x=>x.map(o=>o.id===id?data as ServiceOrder:o));
 },[serviceOrders]);
 const today=new Date(),yy=today.getFullYear(),mm=today.getMonth()+1;
 const candidates=[{date:businessDay(yy,mm,5),label:"5º dia útil — fechamento"},{date:`${yy}-${String(mm).padStart(2,"0")}-20`,label:"Dia 20 — adiantamento"},{date:businessDay(mm===12?yy+1:yy,mm===12?1:mm+1,5),label:"5º dia útil — fechamento"}];
 const next=candidates.find(c=>daysUntil(c.date,today)>=0)||candidates[2]!;
 const paidIn=receivables.filter(r=>r.status==="recebido").reduce((s,r)=>s+r.expected_amount,0),paidOut=payables.filter(p=>p.status==="pago").reduce((s,p)=>s+p.amount,0),paidWorkers=payments.filter(p=>p.status==="pago").reduce((s,p)=>s+p.gross_amount,0);
 const value=useMemo<Store>(()=>({role,workers,contracts,expenseCategories,invoices,workerDocuments,workerEvents,attendance,paymentPeriods,payments,receivables,payables,cashFlowHistory,teams,nextPayDate:{...next,days:daysUntil(next.date,today)},cashBalance:openingBalance+paidIn-paidOut-paidWorkers,loading,error,refresh,serviceTypes,serviceOrders,addWorker,updateWorker,setAttendanceStatus,closePeriod,markPaymentPaid,markReceived,addPayable,markPayablePaid,addTeam,updateTeam,setTeamMembers,addServiceType,updateServiceType,addServiceOrder,finalizeServiceOrder}),[role,workers,contracts,expenseCategories,invoices,workerDocuments,workerEvents,attendance,paymentPeriods,payments,receivables,payables,cashFlowHistory,teams,openingBalance,loading,error,refresh,addWorker,updateWorker,setAttendanceStatus,closePeriod,markPaymentPaid,markReceived,addPayable,markPayablePaid,addTeam,updateTeam,setTeamMembers,serviceTypes,serviceOrders,addServiceType,updateServiceType,addServiceOrder,finalizeServiceOrder,next.date,next.label]);
 return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
export function useStore(){const ctx=useContext(StoreContext);if(!ctx)throw new Error("useStore precisa estar dentro de <StoreProvider>");return ctx;}
