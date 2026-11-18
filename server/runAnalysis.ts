import { buildReport, factsFromReport, groundModelReport } from "../src/lib/analyze.ts"
import { INPUT_LIMITS, type AnalysisInput, type Report } from "../src/lib/types.ts"

export type AnalysisPayload = {
  report?: Report
  notice?: string
  error?: string
}

export function modelConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(readKey(env))
}

export async function runAnalysis(
  input: AnalysisInput,
  env: Record<string, string | undefined>,
): Promise<{ status: number; body: AnalysisPayload }> {
  const key = readKey(env)
  const model = (env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini"
  const local = buildReport(input, "local")
  if (!key) {
    return { status: 200, body: { report: local, notice: local.disclaimer } }
  }
  try {
    const draft = await requestModel(input, local, key, model)
    const report = groundModelReport(draft, input, local)
    if (!report) {
      return {
        status: 200,
        body: {
          report: local,
          notice:
            "The model response could not be used, so Demo Mode produced this reading instead. A language-model report is not shown.",
        },
      }
    }
    return { status: 200, body: { report, notice: report.disclaimer } }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The model request failed."
    return { status: 200, body: { report: local, notice: `${reason} Demo Mode produced this reading instead.` } }
  }
}

function readKey(env: Record<string, string | undefined>): string {
  return (env.OPENAI_API_KEY || "").trim()
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
  const raw = await response.text()
  if (!response.ok) {
    if (modelRejectedForLength(response.status, raw)) {
      throw new ModelLengthError("This transcript is too long for the model. It is still in the form. Paste a shorter excerpt.")
    }
    throw new Error(`The model request failed (${response.status}). Your transcript is still in the form.`)
  }
  let payload: { choices?: { message?: { content?: string } }[] }
  try {
    payload = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] }
  } catch {
    throw new Error("The model service returned a page instead of a result. Your transcript is still in the form.")
  }
  const text = payload.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error("The model returned an empty response. Your transcript is still in the form.")
  const json = text.replace(/^```json\s*/i, "").replace(/```$/i, "")
  try {
    return JSON.parse(json)
  } catch {
    throw new Error("The model response was not valid JSON. Your transcript is still in the form.")
  }
}

function modelRejectedForLength(status: number, raw: string): boolean {
  try {
    const body = JSON.parse(raw) as { error?: { code?: string; type?: string; message?: string } }
    const code = `${body.error?.code || ""} ${body.error?.type || ""} ${body.error?.message || ""}`
    return /context_length|string_above_max|maximum context length/i.test(code)
  } catch {
    return status === 413
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
