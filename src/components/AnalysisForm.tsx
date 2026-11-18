import { useState, type ReactNode } from "react"
import { FOCUS_OPTIONS, type AnalysisInput } from "../lib/types.ts"

export function AnalysisForm({
  draft,
  busy,
  aiConfigured,
  onChange,
  onAnalyze,
  onSample,
}: {
  draft: AnalysisInput
  busy: boolean
  aiConfigured: boolean | null
  onChange: (next: AnalysisInput) => void
  onAnalyze: (input: AnalysisInput) => void
  onSample: () => void
}) {
  const [errors, setErrors] = useState<string[]>([])
  const words = (draft.transcript.match(/\b[\w’']+\b/g) || []).length

  function update(patch: Partial<AnalysisInput>) {
    onChange({ ...draft, ...patch })
  }

  function toggleFocus(id: AnalysisInput["focus"][number]) {
    const has = draft.focus.includes(id)
    update({ focus: has ? draft.focus.filter((item) => item !== id) : [...draft.focus, id] })
  }

  function submit() {
    const next: string[] = []
    if (!draft.teamName.trim()) next.push("Add a team name.")
    if (!draft.transcript.trim()) next.push("Paste a meeting transcript.")
    if (!draft.focus.length) next.push("Choose at least one analysis focus.")
    setErrors(next)
    if (next.length) return
    onAnalyze(draft)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">New analysis</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-ink md:text-4xl">New Team Analysis</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          A longer, representative transcript gives better evidence. Speaker labels and timestamps help. Nothing is stored after you leave this page session.
        </p>
      </div>

      <div className="rounded-2xl border border-sky/20 bg-sky/8 px-4 py-3 text-sm leading-relaxed text-slate-700">
        Replace real names with Member A, Member B, and so on. Share assessments only when you have permission. Identifying information is not required.
        {aiConfigured && " Demo Mode is off: submitted text is sent to the model provider."}
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded-2xl border border-coral/30 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <p className="font-semibold">Add the missing pieces. What you already typed is still here.</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="surface space-y-5 p-5 md:p-6">
        <Field label="Team name" required hint="A project or course-team name is enough.">
          <input
            value={draft.teamName}
            onChange={(event) => update({ teamName: event.target.value })}
            className="field-input"
            placeholder="Campus App Team"
          />
        </Field>

        <Field
          label="Meeting transcript"
          required
          hint="Paste the full meeting. Speaker names and timestamps help, in any common export format."
        >
          <textarea
            value={draft.transcript}
            onChange={(event) => update({ transcript: event.target.value })}
            rows={12}
            className="field-input"
            placeholder={"[00:00] Member A: I think we should pick option one.\n[00:22] Member B: What requirement are we missing?"}
          />
          <p className="text-xs text-slate-500">
            {draft.transcript.length.toLocaleString()} characters · {words.toLocaleString()} words. Full transcripts are kept and analyzed.
            {draft.transcript.length > 240_000
              ? " A model request this long is split into parts and covers the first 240,000 characters. The on-computer reading uses the entire paste."
              : ""}
          </p>
        </Field>

        <Field label="Team charter" hint="Goals, responsibilities, norms, and decision rules. Optional.">
          <textarea value={draft.charter} onChange={(event) => update({ charter: event.target.value })} rows={5} className="field-input" />
        </Field>

        <Field label="Team feedback" hint="Notes from teammates, including Breakout Learning feedback. Optional.">
          <textarea value={draft.feedback} onChange={(event) => update({ feedback: event.target.value })} rows={4} className="field-input" />
        </Field>

        <Field label="Individual assessments" hint="Working preferences people have agreed to share. Leave blank if you do not have permission.">
          <textarea value={draft.assessments} onChange={(event) => update({ assessments: event.target.value })} rows={4} className="field-input" />
        </Field>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">Analysis focus</legend>
          <p className="mt-1 text-sm text-slate-500">Select every process you want the reading to prioritize.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {FOCUS_OPTIONS.map((option) => {
              const checked = draft.focus.includes(option.id)
              return (
                <label
                  key={option.id}
                  className={`flex gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                    checked ? "border-accent/40 bg-teal-50" : "border-slate-200 bg-white hover:border-accent/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-accent"
                    checked={checked}
                    onChange={() => toggleFocus(option.id)}
                  />
                  <span>
                    <span className="font-semibold text-ink">{option.label}</span>
                    <span className="mt-0.5 block text-slate-500">{option.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Analyzing…" : "Analyze Team"}
          </button>
          <button type="button" onClick={onSample} className="btn-secondary">
            Fill with sample data
          </button>
          <button
            type="button"
            onClick={() => {
              onChange({ teamName: "", transcript: "", charter: "", feedback: "", assessments: "", focus: FOCUS_OPTIONS.map((option) => option.id) })
              setErrors([])
            }}
            className="btn-ghost"
          >
            Reset form
          </button>
        </div>
        {busy && <p className="text-sm text-accent">Reading the meeting. This stays in the browser session and is not saved to an account.</p>}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-coral"> *</span>}
      </span>
      {hint && <span className="block text-sm text-slate-500">{hint}</span>}
      {children}
    </label>
  )
}
