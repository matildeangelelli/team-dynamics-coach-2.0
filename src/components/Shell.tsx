import { useState, type ReactNode } from "react"
import { IconUsers } from "./Icons.tsx"

export type View = "dashboard" | "new" | "results" | "how"

const NAV: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "new", label: "New Team Analysis" },
  { id: "results", label: "Analysis Results" },
  { id: "how", label: "How It Works" },
]

export function Shell({
  view,
  onNavigate,
  aiConfigured,
  children,
}: {
  view: View
  onNavigate: (view: View) => void
  aiConfigured: boolean | null
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  function go(next: View) {
    onNavigate(next)
    setOpen(false)
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[272px_1fr]">
      <header className="flex items-center justify-between border-b border-white/70 bg-white/80 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2 text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-300 via-sky-300 to-coral text-navy shadow-sm">
            <IconUsers />
          </span>
          <span className="font-display font-semibold">Team Dynamics Coach</span>
        </div>
        <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Menu"}
        </button>
      </header>
      <aside className={`${open ? "block" : "hidden"} relative overflow-hidden border-b border-white/10 bg-navy text-white md:block md:border-b-0`}>
        <div className="pointer-events-none absolute -left-16 top-10 h-40 w-40 rounded-full bg-accent/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-24 h-48 w-48 rounded-full bg-sky/30 blur-3xl" />
        <div className="relative flex h-full flex-col px-4 py-5">
          <div className="hidden items-center gap-3 md:flex">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-300 via-sky-300 to-[#f0ab8d] text-navy shadow-sm">
              <IconUsers />
            </span>
            <div>
              <p className="font-display text-sm font-semibold leading-tight">Team Dynamics Coach</p>
              <p className="mt-1 text-xs leading-snug text-white/70">Understand your team. Improve how you work together.</p>
            </div>
          </div>
          <nav className="mt-4 flex flex-col gap-1 md:mt-8" aria-label="Primary">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => go(item.id)}
                className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  view === item.id
                    ? "bg-white text-navy shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <p
            className={`mt-6 rounded-xl px-3 py-3 text-xs leading-relaxed md:mt-auto ${
              aiConfigured
                ? "bg-amber-400/15 text-amber-50 ring-1 ring-amber-200/20"
                : "bg-teal-400/15 text-teal-50 ring-1 ring-teal-200/20"
            }`}
          >
            {aiConfigured === null && "Checking analysis mode…"}
            {aiConfigured === false && "Demo Mode. Readings stay on this computer unless you add a model key."}
            {aiConfigured === true && "A language model is connected. Submitted text is sent for analysis. Anonymize names first."}
          </p>
        </div>
      </aside>
      <main className="px-4 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
