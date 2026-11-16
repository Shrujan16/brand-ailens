import { Link } from "@tanstack/react-router";
import { BookOpen, ClipboardCheck, PenLine, BarChart3, CpuIcon } from "lucide-react";
import logo from "@/assets/brandlens-logo.png";
import { useRole, type Role } from "@/lib/role";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Create", icon: PenLine },
  { to: "/review", label: "Review", icon: ClipboardCheck },
  { to: "/knowledge", label: "Brand Knowledge", icon: BookOpen },
  { to: "/insights", label: "Insights", icon: BarChart3 },
] as const;

export function AppHeader() {
  const { role, setRole } = useRole();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="BrandLens logo" width={36} height={36} className="h-9 w-9" />
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold text-primary-deep">BrandLens</div>
            <div className="text-[11px] text-muted-foreground">GreenLeaf Organics</div>
          </div>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground data-[status=active]:bg-secondary data-[status=active]:text-primary-deep"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground lg:inline-flex">
            <CpuIcon className="h-3 w-3" /> AI assistance: off (rules-only mode)
          </span>
          <RoleSwitch role={role} setRole={setRole} />
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-border px-2 py-1.5 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground data-[status=active]:bg-secondary data-[status=active]:text-primary-deep"
          >
            <n.icon className="h-3.5 w-3.5" />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center justify-center gap-1.5 border-t border-border bg-muted px-3 py-1 text-[11px] text-muted-foreground lg:hidden">
        <CpuIcon className="h-3 w-3" /> AI assistance: off (rules-only mode)
      </div>
    </header>
  );
}

function RoleSwitch({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Your role"
      className="flex rounded-full border border-border bg-muted p-0.5 text-xs font-semibold"
    >
      {(["creator", "reviewer"] as const).map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={role === r}
          onClick={() => setRole(r)}
          className={cn(
            "rounded-full px-3 py-1.5 capitalize transition-colors",
            role === r ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
