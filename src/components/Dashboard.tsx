import { IconChat, IconGrid, IconShield } from "./Icons.tsx"

const FEATURES = [
  {
    title: "Participation & Inclusion",
    body: "See who holds the floor, who is invited in, and where a short turn still carries the idea.",
    icon: IconChat,
  },
  {
    title: "Communication & Trust",
    body: "Look for questions, acknowledgment, and disagreement that stays on the work. Feelings are not inferred.",
    icon: IconShield,
  },
  {
    title: "Roles & Coordination",
    body: "Compare the meeting with the charter: norms, ownership, and whether the close names a next step.",
    icon: IconGrid,
  },
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Team Dynamics Coach</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Build stronger teams through better collaboration.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          Understand your team. Improve how you work together. Paste a meeting, add a charter if you have one, and get a practical reading of how the group worked.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onStart} className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4063]">
            Start New Analysis
          </button>
          <button type="button" onClick={onSample} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:bg-slate-50">
            Open sample report
          </button>
        </div>
        {aiConfigured === false && (
          <p className="mt-4 text-sm text-slate-500">Demo Mode is on. Your transcript is read on this computer and is not saved.</p>
        )}
        {aiConfigured === true && (
          <p className="mt-4 text-sm text-amber-800">A language model is connected. Anonymize names before you submit a transcript.</p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-accent">
              <feature.icon />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-ink">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-ink">How it works</h2>
          <button type="button" onClick={onHow} className="text-sm font-semibold text-accent underline-offset-2 hover:underline">
            Read the principles
          </button>
        </div>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ["1", "Provide team data", "A transcript is required. Charter, feedback, and assessments are optional."],
            ["2", "Analyze team processes", "The reading stays with what was said: airtime, questions, norms, and the close."],
            ["3", "Take action", "You get a priority, three leader actions, and questions you can ask without blaming anyone."],
          ].map(([step, title, body]) => (
            <li key={step} className="rounded-xl bg-paper p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Step {step}</p>
              <h3 className="mt-1 font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-semibold text-ink">Sample report</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            Explore a full reading of the Campus App vendor meeting. Names are already Member A through Member D. No data entry required.
          </p>
        </div>
        <button type="button" onClick={onSample} className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4063]">
          Open sample report
        </button>
      </section>
    </div>
  )
}
