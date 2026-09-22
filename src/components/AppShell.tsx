import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarCheck2,
  ChevronDown,
  FileText,
  Home,
  LogOut,
  Moon,
  Sun,
  Sprout,
  UserRound,
  Users,
  Wallet,
  ClipboardList,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

const navItems = [
  { to: "/", label: "Início", icon: Home },
  { to: "/ponto", label: "Ponto", icon: CalendarCheck2 },
  { to: "/diarias", label: "Diárias", icon: Wallet },
  { to: "/os", label: "O.S.", icon: ClipboardList },
  { to: "/financeiro", label: "Financeiro", icon: BarChart3 },
  { to: "/equipe", label: "Equipe", icon: Users },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { role } = useStore();
  const [accountOpen, setAccountOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("controlgrama-theme") === "dark";
  });
  const roleLabel = role === "admin" ? "Administrador" : "Encarregado";
  const roleShort = role === "admin" ? "Admin" : "Encarregado";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  function toggleTheme() {
    setDarkMode((current) => {
      const next = !current;
      localStorage.setItem("controlgrama-theme", next ? "dark" : "light");
      return next;
    });
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="grass-gradient sticky top-0 z-20 px-4 py-2.5 text-white shadow-sm">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="group flex min-w-0 items-center gap-2.5"
              onClick={() => setAccountOpen(false)}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/15">
                <Sprout className="size-5" />
              </span>
              <span className="truncate text-sm font-bold tracking-tight sm:text-base">
                ControlGrama
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                to="/relatorios"
                className="flex h-9 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-semibold ring-1 ring-white/10 transition hover:bg-white/15"
              >
                <FileText className="size-4" />
                <span className="hidden sm:inline">Relatórios</span>
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="flex h-9 items-center gap-2 rounded-xl bg-white/10 px-2.5 text-xs font-semibold ring-1 ring-white/10 transition hover:bg-white/15"
                >
                  <span className="flex size-6 items-center justify-center rounded-lg bg-white/20 text-[11px] font-bold">
                    {role === "admin" ? "A" : "E"}
                  </span>
                  <span className="hidden sm:inline">{roleShort}</span>
                  <ChevronDown className="size-3.5 opacity-75" />
                </button>

                {accountOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-11 w-52 overflow-hidden rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-xl"
                  >
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <UserRound className="size-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Seu acesso</p>
                        <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
                      </div>
                    </div>
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={toggleTheme}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-accent"
                    >
                      {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
                      {darkMode ? "Modo claro" : "Modo escuro"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => supabase.auth.signOut()}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/5"
                    >
                      <LogOut className="size-4" />
                      Sair da conta
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-2 flex min-h-6 items-center gap-2 border-t border-white/10 pt-2">
            <h1 className="truncate font-display text-sm font-semibold tracking-tight sm:text-base">
              {title}
            </h1>
            {subtitle ? (
              <>
                <span className="shrink-0 text-[10px] text-white/45">•</span>
                <p className="min-w-0 truncate text-[10px] leading-4 text-white/70 sm:text-xs">
                  {subtitle}
                </p>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur"
        style={{ boxShadow: "var(--shadow-float)" }}
      >
        <div className="mx-auto flex max-w-3xl">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
