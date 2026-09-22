import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LogIn, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
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
  const handlingConfirmation = useRef(false);

  useEffect(() => {
    let mounted = true;

    const finishConfirmation = async (incomingUrl?: string) => {
      const hash = incomingUrl ? new URL(incomingUrl).hash : window.location.hash;
      const isConfirmationReturn =
        hash.includes("access_token=") ||
        hash.includes("type=signup") ||
        hash.includes("type=email");

      if (isConfirmationReturn) {
        handlingConfirmation.current = true;
        await supabase.auth.signOut();
        if (!incomingUrl) {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
        if (mounted) {
          setUser(null);
          setSignup(false);
          setMessage("E-mail confirmado com sucesso. Agora entre com seu e-mail e senha.");
          setReady(true);
        }
        handlingConfirmation.current = false;
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setUser(data.session?.user ?? null);
        setReady(true);
      }
    };

    finishConfirmation();

    let appUrlListener: { remove: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener("appUrlOpen", ({ url }) => {
        void finishConfirmation(url);
      }).then((handle) => {
        appUrlListener = handle;
      });
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && !handlingConfirmation.current) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      if (appUrlListener) {
        void appUrlListener.remove();
      }
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result = signup
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: Capacitor.isNativePlatform()
              ? "controlgrama://auth/callback"
              : window.location.origin,
          },
        })
      : await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

    if (result.error) {
      setMessage(result.error.message);
    } else if (signup) {
      if (result.data.session) {
        setSignup(false);
        setMessage("Cadastro concluído. Você já pode entrar.");
      } else {
        setSignup(false);
        setMessage("Cadastro criado. Confirme seu e-mail e depois entre com seu e-mail e senha.");
      }
    }

    setBusy(false);
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f8f5]">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f8f5] px-4 py-8">
        <div className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-24 size-72 rounded-full bg-emerald-300/10 blur-3xl" />

        <section className="relative w-full max-w-[420px]">
          <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(20,55,35,0.12)] backdrop-blur sm:p-8">
            <div className="mb-7 flex flex-col items-center">
              <div className="mb-2 flex h-[118px] w-full items-center justify-center">
                <img
                  src="/controlgrama-mark.svg"
                  alt="ControlGrama"
                  className="h-[96px] w-[96px] object-contain"
                />
              </div>
              <div className="h-px w-14 rounded-full bg-primary/70" />
              <p className="mt-3 text-center text-xs font-medium tracking-[0.18em] text-slate-400">
                GESTÃO • EQUIPE • RESULTADOS
              </p>
            </div>

            <div className="mb-5">
              <h1 className="text-[25px] font-bold tracking-tight text-slate-900">
                {signup ? "Crie seu acesso" : "Bem-vindo de volta"}
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                {signup
                  ? "Cadastre o acesso da sua operação para começar."
                  : "Entre para acompanhar sua operação de forma simples e organizada."}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-3.5">
              {signup ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Nome completo</span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                      placeholder="Digite seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </label>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">E-mail</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Senha</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    type="password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
              </label>

              {message ? (
                <div className="rounded-xl border border-primary/15 bg-primary/5 px-3.5 py-3 text-sm leading-5 text-primary-deep">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {signup ? "Criar acesso" : "Entrar na minha operação"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Acesso seguro</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <button
              type="button"
              className="w-full text-sm font-bold text-primary transition hover:opacity-80"
              onClick={() => {
                setSignup((v) => !v);
                setMessage("");
              }}
            >
              {signup ? "Já tenho acesso — entrar" : "Primeiro acesso / criar conta"}
            </button>

            <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
              Seus dados de acesso são protegidos e utilizados apenas para entrar na sua operação.
            </p>
          </div>

          <p className="mt-5 text-center text-[11px] font-medium text-slate-400">
            ControlGrama • Gestão inteligente da operação
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
