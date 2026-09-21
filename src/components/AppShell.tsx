import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BarChart3, CalendarCheck2, Home, Users, Wallet, FileText, Sprout } from "lucide-react";
import { useStore } from "@/lib/store";

const navItems = [
  { to: "/", label: "Início", icon: Home },
  { to: "/ponto", label: "Ponto", icon: CalendarCheck2 },
  { to: "/diarias", label: "Diárias", icon: Wallet },
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
  const { role, setRole } = useStore();

  return (
    <div className="min-h-screen pb-24">
      <header className="grass-gradient sticky top-0 z-20 px-4 pb-4 pt-5">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
          <div>
            <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
              <Sprout className="size-3.5" />
              ControlGrama
            </Link>
            <h1 className="font-display mt-1 text-xl font-semibold">{title}</h1>
            {subtitle ? <p className="text-xs opacity-80">{subtitle}</p> : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              to="/relatorios"
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"
            >
              <FileText className="size-3.5" />
              Relatórios
            </Link>
            <button
              onClick={() => setRole(role === "admin" ? "encarregado" : "admin")}
              className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold"
            >
              Perfil: {role === "admin" ? "Admin" : "Encarregado"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur"
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
