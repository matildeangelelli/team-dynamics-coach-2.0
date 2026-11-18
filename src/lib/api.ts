import type { AnalysisInput, Report } from "./types.ts"

export async function getAnalysisStatus(): Promise<boolean> {
  const response = await fetch("/api/status")
  if (!response.ok) return false
  const data = (await readJson(response)) as { aiConfigured?: boolean }
  return Boolean(data.aiConfigured)
}

export async function postAnalysis(input: AnalysisInput): Promise<{ report: Report; notice: string }> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await readJson(response)) as { report?: Report; notice?: string; error?: string }
  if (!response.ok || !data.report) {
    throw new Error(data.error || "The analysis could not be completed.")
  }
  return { report: data.report, notice: data.notice || data.report.disclaimer }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      response.status === 404
        ? "The analysis service is not available on this site."
        : "The analysis service returned a page instead of a result.",
    )
  }
}
