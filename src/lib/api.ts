import type { AnalysisInput, Report } from "./types.ts"

export async function getAnalysisStatus(): Promise<boolean> {
  const response = await fetch("/api/status")
  if (!response.ok) return false
  const data = (await response.json()) as { aiConfigured?: boolean }
  return Boolean(data.aiConfigured)
}

export async function postAnalysis(input: AnalysisInput): Promise<{ report: Report; notice: string }> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await response.json()) as { report?: Report; notice?: string; error?: string }
  if (!response.ok || !data.report) {
    throw new Error(data.error || "The analysis could not be completed.")
  }
  return { report: data.report, notice: data.notice || data.report.disclaimer }
}
