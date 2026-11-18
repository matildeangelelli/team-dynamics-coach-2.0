import { useState } from "react"
import { ConversationPath, NextMeetingScript, PatternEcho } from "./MeetingStudio.tsx"
import { ReplayStudio } from "./ReplayStudio.tsx"
import { reportToText } from "../lib/reportText.ts"
import { focusLabel, type Report } from "../lib/types.ts"

const SPEAKER_BARS = ["from-sky to-navy", "from-accent to-teal-400", "from-lilac to-sky", "from-coral to-gold", "from-navy to-lilac"]

export function Results({
  report,
  notice,
  onNew,
  onSample,
}: {
  report: Report | null
  notice: string | null
  onNew: () => void
  onSample: () => void
}) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle")

  if (!report) {
    return (
      <div className="surface p-8">
        <h1 className="font-display text-3xl font-semibold text-ink">No report yet</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Start an analysis, or open the sample report to see how a finished reading looks.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={onNew} className="btn-primary">
            Analyze Another Team
          </button>
          <button type="button" onClick={onSample} className="btn-secondary">
            Try Demo Report
          </button>
        </div>
      </div>
    )
  }

  const current = report

  async function copy() {
    const text = reportToText(current)
    try {
      await navigator.clipboard.writeText(text)
      setCopyState("done")
    } catch {
      setCopyState("failed")
    }
    window.setTimeout(() => setCopyState("idle"), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {current.mode === "openai" ? "Model draft" : current.mode === "sample" ? "Demo report" : "Demo Mode"}
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-ink md:text-4xl">{current.teamName}</h1>
          <p className="mt-2 text-sm text-slate-500">Focus: {current.focus.map(focusLabel).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onNew} className="btn-secondary px-3 py-2">
            Analyze Another Team
          </button>
          <button type="button" onClick={onSample} className="btn-secondary px-3 py-2">
            Try Demo Report
          </button>
          <button type="button" onClick={() => void copy()} className="btn-primary px-3 py-2">
            Copy Report
          </button>
        </div>
      </div>

      {notice && <p className="rounded-2xl border border-sky/20 bg-sky/8 px-4 py-3 text-sm leading-relaxed text-slate-700">{notice}</p>}
      {copyState === "done" && <p className="text-sm font-semibold text-accent">Copied. The report is on your clipboard.</p>}
      {copyState === "failed" && <p className="text-sm text-coral">The browser blocked clipboard access. You can still select the sections below.</p>}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Strengths" text={current.executiveSummary.strengths} tone="teal" />
        <SummaryCard label="Potential challenges" text={current.executiveSummary.challenges} tone="coral" />
        <SummaryCard label="Highest priority" text={current.executiveSummary.priority} tone="sky" />
      </section>

      <PatternEcho echo={current.echo} />
      <ConversationPath path={current.path} />
      <ReplayStudio moments={current.replay} />
      <NextMeetingScript beats={current.script} />

      <section className="surface p-5">
        <h2 className="font-display text-xl font-semibold text-ink">Participation and inclusion</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{current.participation.summary}</p>
        <div className="mt-4 space-y-3">
          {current.participation.speakers.map((speaker, index) => (
            <div key={speaker.name}>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-ink">{speaker.name}</span>
                <span className="text-slate-500">
                  {Math.round(speaker.wordShare * 100)}% of words · {speaker.turns} turns · {speaker.questions} questions
                </span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-slate-100">
                <div
                  className={`h-2.5 rounded-full bg-gradient-to-r ${SPEAKER_BARS[index % SPEAKER_BARS.length]}`}
                  style={{ width: `${Math.max(2, Math.round(speaker.wordShare * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="surface border-l-4 border-l-lilac p-5">
          <h2 className="font-display text-xl font-semibold text-ink">Communication and psychological safety</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{current.communication.summary}</p>
        </article>
        <article className="surface border-l-4 border-l-coral p-5">
          <h2 className="font-display text-xl font-semibold text-ink">Roles and coordination</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{current.roles.summary}</p>
        </article>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-ink">Team strengths</h2>
        {current.strengths.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">There was not enough evidence to name a strength without guessing.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {current.strengths.map((strength) => (
              <article key={strength.title} className="surface border-l-4 border-l-accent p-4">
                <h3 className="font-semibold text-ink">{strength.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{strength.detail}</p>
              </article>
            ))}
          </div>
        )}
        {current.strengths.length === 1 && (
          <p className="mt-2 text-sm text-slate-500">A second strength was not clear enough to claim.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Opportunities for improvement</h2>
        {current.opportunities.map((item) => (
          <article key={item.title} className="surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-ink">{item.title}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${confidenceClass(item.confidence)}`}>
                {item.confidence} confidence
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.observation}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-ink">Evidence. </span>
              {item.evidence}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-ink">Why it might matter. </span>
              {item.whyItMatters}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-600">Limitations. </span>
              {item.limitations}
            </p>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Action plan</h2>
        {current.actions.map((action, index) => (
          <article key={action.action} className="surface p-5">
            <p className="eyebrow">Action {index + 1}</p>
            <h3 className="mt-1 font-semibold text-ink">{action.problem}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{action.action}</p>
            <dl className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
              <div className="rounded-xl bg-sky/8 p-3">
                <dt className="font-semibold text-sky">Who</dt>
                <dd>{action.owner}</dd>
              </div>
              <div className="rounded-xl bg-gold/10 p-3">
                <dt className="font-semibold text-gold">When</dt>
                <dd>{action.when}</dd>
              </div>
              <div className="rounded-xl bg-accent/10 p-3">
                <dt className="font-semibold text-accent">How to tell</dt>
                <dd>{action.evaluate}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="surface p-5">
        <h2 className="font-display text-xl font-semibold text-ink">Discussion questions</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {current.discussionQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-ink">Limits of this reading</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
          {current.limitations.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function SummaryCard({ label, text, tone }: { label: string; text: string; tone: "teal" | "coral" | "sky" }) {
  const styles = {
    teal: "border-l-4 border-l-accent bg-teal-50/70",
    coral: "border-l-4 border-l-coral bg-orange-50/70",
    sky: "border-l-4 border-l-sky bg-sky/8",
  }
  const labels = {
    teal: "text-accent",
    coral: "text-coral",
    sky: "text-sky",
  }
  return (
    <article className={`surface p-4 ${styles[tone]}`}>
      <h2 className={`text-xs font-semibold uppercase tracking-wide ${labels[tone]}`}>{label}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{text}</p>
    </article>
  )
}

function confidenceClass(level: string) {
  if (level === "high") return "bg-teal-50 text-teal-800 ring-1 ring-teal-100"
  if (level === "medium") return "bg-amber-50 text-amber-800 ring-1 ring-amber-100"
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
}
