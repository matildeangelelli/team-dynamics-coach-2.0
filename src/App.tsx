import { useEffect, useState } from "react"
import { Dashboard } from "./components/Dashboard.tsx"
import { AnalysisForm } from "./components/AnalysisForm.tsx"
import { HowItWorks } from "./components/HowItWorks.tsx"
import { Results } from "./components/Results.tsx"
import { Shell, type View } from "./components/Shell.tsx"
import { buildReport } from "./lib/analyze.ts"
import { sampleInput } from "./lib/sample.ts"
import { emptyInput, type AnalysisInput, type Report } from "./lib/types.ts"

export default function App() {
  const [view, setView] = useState<View>("dashboard")
  const [draft, setDraft] = useState<AnalysisInput>(emptyInput)
  const [report, setReport] = useState<Report | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/status")
      .then((response) => response.json())
      .then((data: { aiConfigured?: boolean }) => {
        if (active) setAiConfigured(Boolean(data.aiConfigured))
      })
      .catch(() => {
        if (active) setAiConfigured(false)
      })
    return () => {
      active = false
    }
  }, [])

  function startNew() {
    setDraft(emptyInput())
    setReport(null)
    setNotice(null)
    setView("new")
  }

  function openSample() {
    const sample = sampleInput()
    setReport(buildReport(sample, "sample"))
    setNotice("This is the demo report for the included Campus App transcript.")
    setView("results")
  }

  async function analyze(input: AnalysisInput) {
    setBusy(true)
    setNotice(null)
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = (await response.json()) as { report?: Report; notice?: string; error?: string }
      if (!response.ok || !data.report) {
        throw new Error(data.error || "The analysis could not be completed.")
      }
      setReport(data.report)
      setNotice(data.notice || data.report.disclaimer)
      setView("results")
    } catch (error) {
      const local = buildReport(input, "local")
      const reason = error instanceof Error ? error.message : "The analysis service did not respond."
      setReport(local)
      setNotice(`${reason} The transcript is still in the form. A local reading of the full text is shown here.`)
      setView("results")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell view={view} onNavigate={setView} aiConfigured={aiConfigured}>
      {view === "dashboard" && (
        <Dashboard aiConfigured={aiConfigured} onStart={startNew} onSample={openSample} onHow={() => setView("how")} />
      )}
      {view === "new" && (
        <AnalysisForm
          draft={draft}
          busy={busy}
          aiConfigured={aiConfigured}
          onChange={setDraft}
          onAnalyze={analyze}
          onSample={() => setDraft(sampleInput())}
        />
      )}
      {view === "results" && (
        <Results report={report} notice={notice} onNew={startNew} onSample={openSample} />
      )}
      {view === "how" && <HowItWorks onStart={startNew} />}
    </Shell>
  )
}
