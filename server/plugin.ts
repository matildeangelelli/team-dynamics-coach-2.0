import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { parseAnalysisInput } from "../src/lib/input.ts"
import { INPUT_LIMITS } from "../src/lib/types.ts"
import { runAnalysis } from "./runAnalysis.ts"

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
    const result = await runAnalysis(input, { OPENAI_API_KEY: key, OPENAI_MODEL: model })
    send(res, result.status, result.body)
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
