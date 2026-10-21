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
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2 text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-white">
            <IconUsers />
          </span>
          <span className="font-semibold">Team Dynamics Coach</span>
        </div>
        <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold" onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Menu"}
        </button>
      </header>
      <aside className={`${open ? "block" : "hidden"} border-b border-slate-200 bg-white md:block md:border-b-0 md:border-r`}>
        <div className="flex h-full flex-col px-4 py-5">
          <div className="hidden items-center gap-3 md:flex">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-white">
              <IconUsers />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight text-ink">Team Dynamics Coach</p>
              <p className="mt-1 text-xs leading-snug text-slate-500">Understand your team. Improve how you work together.</p>
            </div>
          </div>
          <nav className="mt-4 flex flex-col gap-1 md:mt-8" aria-label="Primary">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => go(item.id)}
                className={`rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                  view === item.id ? "bg-slate-100 text-navy" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <p className="mt-6 text-xs leading-relaxed text-slate-500 md:mt-auto">
            {aiConfigured === null && "Checking analysis mode…"}
            {aiConfigured === false && "Demo Mode. Readings stay on this computer unless you add a model key."}
            {aiConfigured === true && "A language model is connected. Submitted text is sent for analysis. Anonymize names first."}
          </p>
        </div>
      </aside>
      <main className="px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
