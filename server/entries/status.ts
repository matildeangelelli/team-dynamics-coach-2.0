import { modelConfigured } from "../runAnalysis.ts"

type NodeRequest = { method?: string }
type NodeResponse = {
  status: (code: number) => NodeResponse
  setHeader: (name: string, value: string) => void
  json: (body: unknown) => void
}

export default function handler(req: NodeRequest, res: NodeResponse) {
  res.setHeader("Content-Type", "application/json")
  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET for status." })
    return
  }
  res.status(200).json({ aiConfigured: modelConfigured(process.env) })
}
