import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { buildReport, factsFromReport, groundModelReport } from "../src/lib/analyze.ts"
import { parseAnalysisInput } from "../src/lib/input.ts"
import { INPUT_LIMITS, type AnalysisInput, type Report } from "../src/lib/types.ts"

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
      send(res, 413, {
        error:
          "That transcript is larger than 2 MB. It is still in the form. Paste a shorter excerpt, or remove attachments that were copied in with the text.",
      })
      return true
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      send(res, 400, { error: "The analysis request was not valid JSON." })
      return true
    }
    const input = parseAnalysisInput(parsed)
    if (!input) {
      send(res, 400, { error: "Add a team name and a meeting transcript." })
      return true
    }
    const local = buildReport(input, "local")
    if (!key) {
      send(res, 200, { report: local, notice: local.disclaimer })
      return true
    }
    try {
      const draft = await requestModel(input, local, key, model)
      const report = groundModelReport(draft, input, local)
      if (!report) {
        send(res, 200, {
          report: local,
          notice:
            "The model response could not be used, so Demo Mode produced this reading instead. A language-model report is not shown.",
        })
        return true
      }
      send(res, 200, { report, notice: report.disclaimer })
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The model request failed."
      send(res, 200, { report: local, notice: `${reason} Demo Mode produced this reading instead.` })
    }
    return true
  }

  return {
    name: "team-dynamics-api",
    configureServer: attach(handle),
    configurePreviewServer: attach(handle),
  }
}

function attach(handle: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>) {
  return (server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      void handle(req, res)
        .then((handled) => {
          if (!handled) next()
        })
        .catch(() => {
          if (!res.headersSent) send(res, 500, { error: "The analysis service hit an unexpected error." })
        })
    })
  }
}

class ModelLengthError extends Error {}

async function requestModel(input: AnalysisInput, local: Report, key: string, model: string): Promise<unknown> {
  if (input.transcript.length <= INPUT_LIMITS.modelSingleChars) {
    try {
      return await completeModel(promptFor(input, local), key, model)
    } catch (error) {
      if (!(error instanceof ModelLengthError) || input.transcript.length <= INPUT_LIMITS.modelChunkChars) throw error
    }
  }
  const chunks = splitTranscript(input.transcript, INPUT_LIMITS.modelChunkChars)
  const limited = chunks.slice(0, INPUT_LIMITS.modelMaxChunks)
  const omitted = chunks.length > limited.length
  const notes: string[] = []
  for (let index = 0; index < limited.length; index += 1) {
    const partial = await completeModel(partialPrompt(limited[index], index + 1, limited.length), key, model)
    notes.push(JSON.stringify(partial).slice(0, 4_000))
  }
  return completeModel(synthesisPrompt(input, local, notes, omitted), key, model)
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
              "You help a university team leader reflect on observable team process. Return only JSON. Use only the supplied materials and measured facts. Do not invent quotes or speaker counts. If evidence is thin, say so. Do not claim to know how anyone felt, and do not diagnose psychological safety. Speaking time is not contribution quality. Recommendations name a role, not a personal failing. Direct challenge belongs on the work, with care for the person. The priority field names one next practice, not a list of every requested focus.",
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

function synthesisPrompt(input: AnalysisInput, local: Report, notes: string[], omitted: boolean): string {
  return `${promptFor({ ...input, transcript: "(see part notes below; do not expect the raw transcript)" }, local)}

PART NOTES:
${notes.join("\n\n")}
${omitted ? "\nThe transcript continued beyond these parts. Say that the model reading covers the first 240,000 characters only." : ""}`
}

function promptFor(input: AnalysisInput, local: Report): string {
  return `Return a JSON object with these keys:
teamName, focus, executiveSummary {strengths, challenges, priority},
participation {summary, speakers: [{name, turns, words, wordShare, questions, buildOns}]},
communication {summary}, roles {summary},
strengths: [{title, detail}] (at least 2 if the evidence supports them, otherwise explain the gap inside executiveSummary),
opportunities: up to 3 of {title, observation, evidence, whyItMatters, confidence: "low"|"medium"|"high", limitations},
actions: exactly 3 of {problem, action, owner, when, evaluate},
discussionQuestions: 3 strings that do not blame a person,
limitations: array of strings.

Each action must be something a facilitator or note-taker can try in the next meeting, with a visible check. Do not name a personal failing. Priority is one practice, not a list of every focus area.

MEASURED FACTS from a local parser. Treat speaker counts as ground truth. Do not invent quotes.
${JSON.stringify(factsFromReport(local))}

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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > INPUT_LIMITS.bodyBytes) {
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
