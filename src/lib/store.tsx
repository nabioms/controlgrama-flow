import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { businessDay, daysUntil, toISO } from "./format";
import type { Attendance, AttendanceStatus, CashFlowMonth, Contract, ExpenseCategory, Invoice, Payable, Payment, PaymentMethod, PaymentPeriod, Receivable, UserRole, Worker, WorkerDocument, WorkerEvent } from "./types";

interface Store {
  role: UserRole; workers: Worker[]; contracts: Contract[]; expenseCategories: ExpenseCategory[]; invoices: Invoice[];
  workerDocuments: WorkerDocument[]; workerEvents: WorkerEvent[]; attendance: Attendance[]; paymentPeriods: PaymentPeriod[];
  payments: Payment[]; receivables: Receivable[]; payables: Payable[]; cashFlowHistory: CashFlowMonth[];
  nextPayDate: {date:string;label:string;days:number}; cashBalance:number; loading:boolean; error:string|null;
  refresh:()=>Promise<void>; addWorker:(w:Worker)=>Promise<void>; updateWorker:(id:string,patch:Partial<Worker>)=>Promise<void>;
  setAttendanceStatus:(workerId:string,date:string,status:AttendanceStatus,notes:string,contractId:string|null,workFraction?:number)=>Promise<void>;
  closePeriod:(id:string)=>Promise<void>; markPaymentPaid:(id:string,m:PaymentMethod)=>Promise<void>;
  markReceived:(id:string)=>Promise<void>; addPayable:(p:Payable)=>Promise<void>; markPayablePaid:(id:string)=>Promise<void>;
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
   supabase.from("cash_settings").select("opening_balance").eq("id",true).maybeSingle()
  ]);
  const bad=q.find(x=>x.error); if(bad?.error){setError(bad.error.message);setLoading(false);return;}
  const [pr,w,c,cat,inv,docs,events,att,periods,pay,rec,pb,settings]=q;
  setRole((pr.data?.role as UserRole)||"encarregado");setWorkers((w.data||[]).map(worker));setContracts(c.data||[]);setExpenseCategories(cat.data||[]);
  setInvoices(inv.data||[]);setWorkerDocuments(docs.data||[]);setWorkerEvents(events.data||[]);setAttendance(att.data||[]);setPaymentPeriods(periods.data||[]);
  setPayments((pay.data||[]).map(payment));setReceivables((rec.data||[]).map(receivable));setPayables((pb.data||[]).map(payable));
  const flowMap:Record<string,{month:string;inflow:number;outflow:number}>={};
  (rec.data||[]).filter((x:any)=>x.status==="recebido").forEach((x:any)=>{const m=String(x.received_at||x.expected_date).slice(0,7);flowMap[m]??={month:m,inflow:0,outflow:0};flowMap[m].inflow+=Number(x.expected_amount||0)});
  (pb.data||[]).filter((x:any)=>x.status==="pago").forEach((x:any)=>{const m=String(x.paid_at||x.due_date).slice(0,7);flowMap[m]??={month:m,inflow:0,outflow:0};flowMap[m].outflow+=Number(x.amount||0)});
  (pay.data||[]).filter((x:any)=>x.status==="pago").forEach((x:any)=>{const m=String(x.paid_at||x.created_at).slice(0,7);flowMap[m]??={month:m,inflow:0,outflow:0};flowMap[m].outflow+=Number(x.gross_amount||0)});
  setCashFlowHistory(Object.values(flowMap).sort((a,b)=>a.month.localeCompare(b.month)));
  setOpeningBalance(Number(settings.data?.opening_balance||0));setLoading(false);
 },[]);
 useEffect(()=>{refresh()},[refresh]);

 const addWorker=useCallback(async(w:Worker)=>{const {id,...row}=w;const {data,error}=await supabase.from("workers").insert(row).select("*").single();if(error)throw error;setWorkers(x=>[worker(data),...x])},[]);
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

 const today=new Date(),yy=today.getFullYear(),mm=today.getMonth()+1;
 const candidates=[{date:businessDay(yy,mm,5),label:"5º dia útil — fechamento"},{date:`${yy}-${String(mm).padStart(2,"0")}-20`,label:"Dia 20 — adiantamento"},{date:businessDay(mm===12?yy+1:yy,mm===12?1:mm+1,5),label:"5º dia útil — fechamento"}];
 const next=candidates.find(c=>daysUntil(c.date,today)>=0)||candidates[2]!;
 const paidIn=receivables.filter(r=>r.status==="recebido").reduce((s,r)=>s+r.expected_amount,0),paidOut=payables.filter(p=>p.status==="pago").reduce((s,p)=>s+p.amount,0),paidWorkers=payments.filter(p=>p.status==="pago").reduce((s,p)=>s+p.gross_amount,0);
 const value=useMemo<Store>(()=>({role,workers,contracts,expenseCategories,invoices,workerDocuments,workerEvents,attendance,paymentPeriods,payments,receivables,payables,cashFlowHistory,nextPayDate:{...next,days:daysUntil(next.date,today)},cashBalance:openingBalance+paidIn-paidOut-paidWorkers,loading,error,refresh,addWorker,updateWorker,setAttendanceStatus,closePeriod,markPaymentPaid,markReceived,addPayable,markPayablePaid}),[role,workers,contracts,expenseCategories,invoices,workerDocuments,workerEvents,attendance,paymentPeriods,payments,receivables,payables,cashFlowHistory,openingBalance,loading,error,refresh,addWorker,updateWorker,setAttendanceStatus,closePeriod,markPaymentPaid,markReceived,addPayable,markPayablePaid,next.date,next.label]);
 return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
export function useStore(){const ctx=useContext(StoreContext);if(!ctx)throw new Error("useStore precisa estar dentro de <StoreProvider>");return ctx;}
