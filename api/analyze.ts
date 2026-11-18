import { parseAnalysisInput } from "../src/lib/input.ts"
import { INPUT_LIMITS } from "../src/lib/types.ts"
import { runAnalysis } from "../server/runAnalysis.ts"

type NodeRequest = {
  method?: string
  body?: unknown
}

type NodeResponse = {
  status: (code: number) => NodeResponse
  setHeader: (name: string, value: string) => void
  json: (body: unknown) => void
}

export const maxDuration = 60

export default async function handler(req: NodeRequest, res: NodeResponse) {
  res.setHeader("Content-Type", "application/json")
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST for analysis." })
    return
  }
  let parsed: unknown
  try {
    parsed = decodeBody(req.body)
  } catch {
    res.status(400).json({ error: "The analysis request was not valid JSON." })
    return
  }
  if (payloadBytes(parsed) > INPUT_LIMITS.bodyBytes) {
    res.status(413).json({
      error:
        "That transcript is larger than 2 MB. It is still in the form. Paste a shorter excerpt, or remove attachments that were copied in with the text.",
    })
    return
  }
  const input = parseAnalysisInput(parsed)
  if (!input) {
    res.status(400).json({ error: "Add a team name and a meeting transcript." })
    return
  }
  try {
    const result = await runAnalysis(input, process.env)
    res.status(result.status).json(result.body)
  } catch {
    res.status(500).json({ error: "The analysis service hit an unexpected error." })
  }
}

function decodeBody(body: unknown): unknown {
  if (typeof body === "string") return JSON.parse(body)
  if (body instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(body))
  return body
}

function payloadBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length
  } catch {
    return INPUT_LIMITS.bodyBytes + 1
  }
}
