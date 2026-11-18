import { useMemo, useState } from "react"
import { coachFacilitatorLine, exampleLine } from "../lib/practice.ts"
import type { ReplayMoment } from "../lib/types.ts"

export function ReplayStudio({ moments }: { moments: ReplayMoment[] }) {
  const [activeId, setActiveId] = useState(moments[0]?.id ?? "")
  const [draft, setDraft] = useState("")
  const [showExample, setShowExample] = useState(false)
  const moment = useMemo(() => moments.find((item) => item.id === activeId) ?? moments[0], [activeId, moments])

  if (!moment) return null

  const result = draft.trim() ? coachFacilitatorLine(draft, moment) : null

  return (
    <section className="surface overflow-hidden p-5 md:p-6">
      <p className="eyebrow">Replay studio</p>
      <h2 className="font-display mt-1 text-2xl font-semibold text-ink">Practice the turn you still have</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        The report is a reading. This is a rehearsal. Pick a real moment from the transcript, write the next facilitator line, and see what the line protects.
      </p>

      {moments.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {moments.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveId(item.id)
                setDraft("")
                setShowExample(false)
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                item.id === moment.id ? "bg-navy text-white" : "bg-slate-100 text-navy hover:bg-slate-200"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-coral">What happened</p>
          {moment.before && (
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              <span className="font-semibold text-ink">{moment.before.speaker}: </span>
              {moment.before.text}
            </p>
          )}
          <p className="mt-3 rounded-xl bg-white p-3 text-sm leading-relaxed text-slate-800 ring-1 ring-coral/30">
            <span className="font-semibold text-coral">{moment.line.speaker}: </span>
            {moment.line.text}
          </p>
          <p className="mt-3 text-sm text-slate-600">{moment.whyThisMoment}</p>
        </div>

        <div>
          <label className="block">
            <span className="text-sm font-semibold text-ink">{moment.prompt}</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={5}
              className="field-input mt-2"
              placeholder="Write the next sentence you would actually say."
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary px-3 py-2" onClick={() => setShowExample((value) => !value)}>
              {showExample ? "Hide a sample line" : "Hear one possible line"}
            </button>
            <button type="button" className="btn-ghost px-3 py-2" onClick={() => setDraft("")}>
              Clear
            </button>
          </div>
          {showExample && (
            <p className="mt-3 rounded-xl bg-teal-50 p-3 text-sm leading-relaxed text-teal-950 ring-1 ring-teal-100">
              {exampleLine(moment)}
            </p>
          )}
        </div>
      </div>

      {result && (
        <div
          className={`mt-4 rounded-2xl p-4 text-sm ${
            result.verdict === "strong"
              ? "bg-teal-50 text-teal-950 ring-1 ring-teal-100"
              : result.verdict === "mixed"
                ? "bg-amber-50 text-amber-950 ring-1 ring-amber-100"
                : "bg-orange-50 text-orange-950 ring-1 ring-orange-100"
          }`}
        >
          <p className="font-semibold">
            {result.verdict === "strong"
              ? "This line is ready to try."
              : result.verdict === "mixed"
                ? "This line is close. Tighten the missing piece."
                : "This line still needs a process move."}
          </p>
          {result.kept.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.kept.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {result.missing.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
