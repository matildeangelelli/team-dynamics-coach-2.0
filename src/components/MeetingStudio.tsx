import type { EchoNote, ScriptBeat } from "../lib/types.ts"

const CHIP = ["bg-sky/15 text-sky", "bg-accent/15 text-accent", "bg-lilac/15 text-lilac", "bg-coral/15 text-coral", "bg-gold/15 text-gold"]

export function ConversationPath({ path }: { path: string[] }) {
  if (path.length < 2) return null
  const names = [...new Set(path)]
  return (
    <section className="surface p-5">
      <h2 className="font-display text-xl font-semibold text-ink">Conversation path</h2>
      <p className="mt-1 text-sm text-slate-600">
        Who spoke after whom. A long run of one color is a clue, not a score.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {path.map((name, index) => (
          <span key={`${name}-${index}`} className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP[names.indexOf(name) % CHIP.length]}`}>
              {name.replace(/^Member\s+/i, "")}
            </span>
            {index < path.length - 1 && <span className="text-slate-300">→</span>}
          </span>
        ))}
      </div>
    </section>
  )
}

export function PatternEcho({ echo }: { echo: EchoNote | null }) {
  if (!echo) return null
  return (
    <section className="surface border-l-4 border-l-gold p-5">
      <p className="eyebrow">Pattern echo</p>
      <h2 className="font-display mt-1 text-xl font-semibold text-ink">This meeting rhymed with earlier feedback</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{echo.reading}</p>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-gold/10 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gold">From earlier feedback</dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-700">{echo.source}</dd>
        </div>
        <div className="rounded-xl bg-sky/8 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-sky">In this transcript</dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-700">{echo.meeting}</dd>
        </div>
      </dl>
    </section>
  )
}

export function NextMeetingScript({ beats }: { beats: ScriptBeat[] }) {
  if (!beats.length) return null
  return (
    <section className="surface overflow-hidden p-5 md:p-6">
      <p className="eyebrow">Next meeting, 12 minutes</p>
      <h2 className="font-display mt-1 text-2xl font-semibold text-ink">A script you can read aloud</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        This is not a new diagnosis. It is the first twelve minutes of the next working meeting, written so a facilitator does not have to invent the opening in the room.
      </p>
      <ol className="mt-5 space-y-3">
        {beats.map((beat) => (
          <li key={beat.clock} className="grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 md:grid-cols-[5.5rem_1fr]">
            <p className="font-display text-lg font-semibold text-sky">{beat.clock}</p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">{beat.owner}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{beat.say}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{beat.why}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
