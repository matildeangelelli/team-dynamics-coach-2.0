import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { buildReport, coerceReport } from "../src/lib/analyze.ts"
import type { AnalysisInput, FocusId } from "../src/lib/types.ts"

const FOCUS: FocusId[] = ["participation", "communication", "roles", "coordination", "feedback"]

export function apiPlugin(env: Record<string, string>): Plugin {
  const key = (env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || "").trim()
  const model = (env.OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim()
  console.log(
    key
      ? "OpenAI is configured for server-side analysis. The key is not sent to the browser."
      : "No OPENAI_API_KEY found. Team Dynamics Coach is in Demo Mode.",
  )

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url?.split("?")[0]
    if (url === "/api/status" && req.method === "GET") {
      send(res, 200, { aiConfigured: Boolean(key) })
      return true
    }
    if (url !== "/api/analyze") return false
    if (req.method !== "POST") {
      send(res, 405, { error: "Use POST for analysis." })
      return true
    }
    let body = ""
    try {
      body = await readBody(req)
    } catch {
      send(res, 413, { error: "That transcript is larger than 2 MB. It is still in the form. Paste a shorter excerpt, or remove attachments that were copied in with the text." })
      return true
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      send(res, 400, { error: "The analysis request was not valid JSON." })
      return true
    }
    const input = readInput(parsed)
    if (!input) {
      send(res, 400, { error: "Add a team name and a meeting transcript." })
      return true
    }
    if (!key) {
      const report = buildReport(input, "local")
      send(res, 200, { report, notice: report.disclaimer })
      return true
    }
    try {
      const draft = await requestModel(input, key, model)
      const report = coerceReport(draft, input)
      if (!report) {
        const local = buildReport(input, "local")
        send(res, 200, {
          report: local,
          notice: "The model response could not be used, so Demo Mode produced this reading instead. A language-model report is not shown.",
        })
        return true
      }
      send(res, 200, { report, notice: report.disclaimer })
    } catch (error) {
      const local = buildReport(input, "local")
      const reason = error instanceof Error ? error.message : "The model request failed."
      send(res, 200, { report: local, notice: `${reason} Demo Mode produced this reading instead.` })
    }
    return true
  }

  return {
    name: "team-dynamics-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch(() => {
            if (!res.headersSent) send(res, 500, { error: "The analysis service hit an unexpected error." })
          })
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch(() => {
            if (!res.headersSent) send(res, 500, { error: "The analysis service hit an unexpected error." })
          })
      })
    },
  }
}

const MODEL_SINGLE = 60_000
const MODEL_CHUNK = 20_000
const MODEL_MAX_CHUNKS = 12

class ModelLengthError extends Error {}

async function requestModel(input: AnalysisInput, key: string, model: string): Promise<unknown> {
  if (input.transcript.length <= MODEL_SINGLE) {
    try {
      return await completeModel(promptFor(input), key, model)
    } catch (error) {
      if (!(error instanceof ModelLengthError) || input.transcript.length <= MODEL_CHUNK) throw error
    }
  }
  const chunks = splitTranscript(input.transcript, MODEL_CHUNK).slice(0, MODEL_MAX_CHUNKS)
  const omitted = splitTranscript(input.transcript, MODEL_CHUNK).length > chunks.length
  const notes: string[] = []
  for (let index = 0; index < chunks.length; index += 1) {
    const partial = await completeModel(partialPrompt(chunks[index], index + 1, chunks.length), key, model)
    notes.push(JSON.stringify(partial).slice(0, 4_000))
  }
  return completeModel(synthesisPrompt(input, notes, omitted), key, model)
}

async function completeModel(content: string, key: string, model: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You help a university team leader reflect on observable team process. Return only JSON. Use only the supplied materials. Do not invent quotes. If evidence is thin, say so. Do not claim to know how anyone felt, and do not diagnose psychological safety. Speaking time is not contribution quality. Recommendations name a role, not a personal failing. Direct challenge belongs on the work, with care for the person.",
          },
          { role: "user", content },
        ],
      }),
    })
  } catch {
    throw new Error("The model request did not finish. Your transcript is still in the form.")
  }
  if (!response.ok) {
    const tooLong = await modelRejectedForLength(response)
    if (tooLong) {
      throw new ModelLengthError("This transcript is too long for the model. It is still in the form. Paste a shorter excerpt.")
    }
    throw new Error(`The model request failed (${response.status}). Your transcript is still in the form.`)
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  const text = payload.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error("The model returned an empty response. Your transcript is still in the form.")
  const json = text.replace(/^```json\s*/i, "").replace(/```$/i, "")
  try {
    return JSON.parse(json)
  } catch {
    throw new Error("The model response was not valid JSON. Your transcript is still in the form.")
  }
}

async function modelRejectedForLength(response: Response): Promise<boolean> {
  try {
    const body = (await response.json()) as { error?: { code?: string; type?: string; message?: string } }
    const code = `${body.error?.code || ""} ${body.error?.type || ""}`
    return /context_length|string_above_max|token/i.test(code)
  } catch {
    return response.status === 413
  }
}

function splitTranscript(text: string, size: number): string[] {
  if (text.length <= size) return [text]
  const parts: string[] = []
  let rest = text
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n\n", size)
    if (cut < size * 0.5) cut = rest.lastIndexOf("\n", size)
    if (cut < size * 0.5) cut = size
    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
  }
  if (rest) parts.push(rest)
  return parts
}

function partialPrompt(chunk: string, index: number, total: number): string {
  return `Read transcript part ${index} of ${total}. Return JSON {"summary":"what this part shows about participation, disagreement, and decisions","evidence":["up to 5 short quotes"]}. Do not copy the whole transcript.

TRANSCRIPT PART:
${chunk}`
}

function synthesisPrompt(input: AnalysisInput, notes: string[], omitted: boolean): string {
  return `${promptFor({ ...input, transcript: "(see part notes below; do not expect the raw transcript)" })}

PART NOTES:
${notes.join("\n\n")}
${omitted ? "\nThe transcript continued beyond these parts. Say that the model reading covers the first 240,000 characters only." : ""}`
}

function promptFor(input: AnalysisInput): string {
  return `Return a JSON object with these keys:
teamName, focus, executiveSummary {strengths, challenges, priority},
participation {summary, speakers: [{name, turns, words, wordShare, questions, buildOns}]},
communication {summary}, roles {summary},
strengths: [{title, detail}] (at least 2 if the evidence supports them, otherwise explain the gap inside executiveSummary),
opportunities: up to 3 of {title, observation, evidence, whyItMatters, confidence: "low"|"medium"|"high", limitations},
actions: exactly 3 of {problem, action, owner, when, evaluate},
discussionQuestions: 3 strings that do not blame a person,
limitations: array of strings.

Team name: ${input.teamName}
Requested focus: ${input.focus.join(", ")}

CHARTER:
${input.charter || "(none)"}

TEAM FEEDBACK:
${input.feedback || "(none)"}

INDIVIDUAL ASSESSMENTS:
${input.assessments || "(none)"}

TRANSCRIPT:
${input.transcript}`
}

function readInput(value: unknown): AnalysisInput | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<AnalysisInput>
  if (typeof raw.teamName !== "string" || !raw.teamName.trim()) return null
  if (typeof raw.transcript !== "string" || !raw.transcript.trim()) return null
  const focus = Array.isArray(raw.focus) ? raw.focus.filter((item): item is FocusId => FOCUS.includes(item as FocusId)) : []
  return {
    teamName: raw.teamName.slice(0, 120),
    transcript: raw.transcript,
    charter: typeof raw.charter === "string" ? raw.charter.slice(0, 40_000) : "",
    feedback: typeof raw.feedback === "string" ? raw.feedback.slice(0, 40_000) : "",
    assessments: typeof raw.assessments === "string" ? raw.assessments.slice(0, 40_000) : "",
    focus,
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > 2_000_000) {
        reject(new Error("too large"))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(payload))
}
