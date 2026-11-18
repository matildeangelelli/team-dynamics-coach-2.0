import { IconChat, IconGrid, IconShield } from "./Icons.tsx"

const FEATURES = [
  {
    title: "Participation & Inclusion",
    body: "See who holds the floor, who is invited in, and where a short turn still carries the idea.",
    icon: IconChat,
    well: "bg-sky/10 text-sky",
    border: "hover:border-sky/30",
  },
  {
    title: "Communication & Trust",
    body: "Look for questions, acknowledgment, and disagreement that stays on the work. Feelings are not inferred.",
    icon: IconShield,
    well: "bg-lilac/10 text-lilac",
    border: "hover:border-lilac/30",
  },
  {
    title: "Roles & Coordination",
    body: "Compare the meeting with the charter: norms, ownership, and whether the close names a next step.",
    icon: IconGrid,
    well: "bg-coral/10 text-coral",
    border: "hover:border-coral/30",
  },
]

const STEPS = [
  ["1", "Provide team data", "A transcript is required. Charter, feedback, and assessments are optional.", "bg-sky"],
  ["2", "Analyze team processes", "The reading stays with what was said: airtime, questions, norms, and the close.", "bg-accent"],
  ["3", "Rehearse, then run it", "Replay a real moment, rewrite the next line, and take a 12-minute script into the next meeting.", "bg-coral"],
]

export function Dashboard({
  aiConfigured,
  onStart,
  onSample,
  onHow,
}: {
  aiConfigured: boolean | null
  onStart: () => void
  onSample: () => void
  onHow: () => void
}) {
  return (
    <div className="space-y-8">
      <section className="surface relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-sky/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-24 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <p className="eyebrow">Team Dynamics Coach</p>
          <h1 className="font-display mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-ink md:text-5xl md:leading-[1.1]">
            Build stronger teams through better collaboration.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
            Understand your team. Improve how you work together. Paste a meeting, then rehearse the turn that went sideways and leave with a 12-minute script for the next one.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={onStart} className="btn-primary">
              Start New Analysis
            </button>
            <button type="button" onClick={onSample} className="btn-secondary">
              Open sample report
            </button>
          </div>
          {aiConfigured === false && (
            <p className="mt-5 inline-flex rounded-full bg-teal-50 px-3 py-1.5 text-sm text-teal-800 ring-1 ring-teal-100">
              Demo Mode is on. Your transcript is read on this computer and is not saved.
            </p>
          )}
          {aiConfigured === true && (
            <p className="mt-5 inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-900 ring-1 ring-amber-100">
              A language model is connected. Anonymize names before you submit a transcript.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <article key={feature.title} className={`surface p-5 transition ${feature.border}`}>
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${feature.well}`}>
              <feature.icon />
            </span>
            <h2 className="font-display mt-4 text-xl font-semibold text-ink">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="surface p-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-ink">How it works</h2>
          <button type="button" onClick={onHow} className="text-sm font-semibold text-accent underline-offset-2 hover:underline">
            Read the principles
          </button>
        </div>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map(([step, title, body, color]) => (
            <li key={step} className="rounded-2xl bg-gradient-to-b from-slate-50 to-white p-4 ring-1 ring-slate-100">
              <p className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white ${color}`}>{step}</p>
              <h3 className="mt-3 font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="surface flex flex-col justify-between gap-4 overflow-hidden bg-gradient-to-r from-navy to-accent p-6 text-white md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-2xl font-semibold">Sample report</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/80">
            Explore a full reading of the Campus App vendor meeting. Names are already Member A through Member D. No data entry required.
          </p>
        </div>
        <button type="button" onClick={onSample} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-navy shadow-sm hover:bg-teal-50">
          Open sample report
        </button>
      </section>
    </div>
  )
}
