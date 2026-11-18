import { FOCUS_IDS, INPUT_LIMITS, type AnalysisInput, type FocusId } from "./types.ts"

export function parseAnalysisInput(value: unknown): AnalysisInput | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<AnalysisInput>
  if (typeof raw.teamName !== "string" || !raw.teamName.trim()) return null
  if (typeof raw.transcript !== "string" || !raw.transcript.trim()) return null
  const focus = Array.isArray(raw.focus)
    ? raw.focus.filter((item): item is FocusId => FOCUS_IDS.includes(item as FocusId))
    : []
  return {
    teamName: raw.teamName.slice(0, INPUT_LIMITS.teamName),
    transcript: raw.transcript,
    charter: clip(raw.charter),
    feedback: clip(raw.feedback),
    assessments: clip(raw.assessments),
    focus,
  }
}

function clip(value: unknown): string {
  return typeof value === "string" ? value.slice(0, INPUT_LIMITS.supporting) : ""
}
