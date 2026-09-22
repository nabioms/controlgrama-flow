import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LogIn, Loader2, Sprout } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setUser(data.session?.user ?? null); setReady(true); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const result = signup
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) setMessage(result.error.message);
    else if (signup && !result.data.session) setMessage("Cadastro criado. Verifique seu e-mail para confirmar a conta.");
    setBusy(false);
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  if (!user) return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center gap-2 text-primary"><Sprout className="size-7" /><div><h1 className="font-display text-xl font-bold">ControlGrama</h1><p className="text-xs text-muted-foreground">Gestão da operação</p></div></div>
        <h2 className="text-lg font-semibold">{signup ? "Criar acesso" : "Entrar"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{signup ? "O primeiro usuário cadastrado recebe perfil Admin." : "Acesse sua operação com seu e-mail e senha."}</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {signup ? <input className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" placeholder="Nome completo" value={name} onChange={e=>setName(e.target.value)} required /> : null}
          <input className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required />
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <button type="submit" disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}{signup ? "Criar acesso" : "Entrar"}
          </button>
        </form>
        <button type="button" className="mt-4 w-full text-sm font-semibold text-primary" onClick={()=>{setSignup(v=>!v);setMessage("");}}>
          {signup ? "Já tenho acesso" : "Primeiro acesso / criar conta"}
        </button>
      </div>
    </div>
  );

  return <>{children}</>;
}
