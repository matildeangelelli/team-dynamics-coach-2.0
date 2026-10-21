const PRINCIPLES = [
  {
    title: "Balanced participation and inclusion",
    body: "Teams hear better options when the first round is shared. Airtime is a clue. It is not a score for whose idea was better.",
  },
  {
    title: "Psychological safety and respectful disagreement",
    body: "Questions, acknowledgment, and disagreement about the work are visible in a transcript. How safe someone felt is not. The tool will not pretend otherwise.",
  },
  {
    title: "Role clarity and shared expectations",
    body: "A charter is the standard. The reading compares what the team said it would do with what the meeting actually did.",
  },
  {
    title: "Direct communication with care",
    body: "Inspired by Radical Candor: challenge the idea directly, and keep the person in the conversation. “You always” fails that test. “The risk in this option is” passes it.",
  },
  {
    title: "Reflection and continuous improvement",
    body: "One meeting is a sample. Use the action plan, try it once, then read the next meeting. The point is a better next conversation, not a label for the team.",
  },
]

export function HowItWorks({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">How it works</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Suggestions for the process, not a verdict on people</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Team Dynamics Coach helps a leader look at observable team processes and choose a next practice. It examines what was said. It does not diagnose personalities, rank members, or decide who is a good teammate.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PRINCIPLES.map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">What the suggestions are not</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          <li>Not a measurement of intelligence, effort, or leadership potential.</li>
          <li>Not proof of psychological safety. Safety is experienced. Words can only show the shape of the exchange.</li>
          <li>Not a reason to single someone out in front of the team. The discussion questions are written for the whole group.</li>
          <li>Not a substitute for asking the team what they noticed.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Privacy</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          There is no account and no database. The transcript lives in this page until you start a new analysis or reset the form. It is not written to the browser’s saved storage. In Demo Mode, the reading is produced on this computer. If a model key is configured on the server, the text you submit is sent to that provider. Anonymize it first.
        </p>
        <button type="button" onClick={onStart} className="mt-4 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white">
          Start New Analysis
        </button>
      </section>
    </div>
  )
}
