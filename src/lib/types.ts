export const FOCUS_OPTIONS = [
  {
    id: "participation",
    label: "Participation and inclusion",
    hint: "Who speaks, who is invited, and whether airtime is shared.",
  },
  {
    id: "communication",
    label: "Communication and psychological safety",
    hint: "Questions, listening, disagreement, and respectful feedback.",
  },
  {
    id: "roles",
    label: "Roles and responsibilities",
    hint: "Whether the charter’s roles show up in the meeting.",
  },
  {
    id: "coordination",
    label: "Coordination and decision-making",
    hint: "How the group opens, decides, and leaves with owners.",
  },
  {
    id: "feedback",
    label: "Constructive feedback",
    hint: "Whether challenge stays on the work and still shows care.",
  },
] as const

export type FocusId = (typeof FOCUS_OPTIONS)[number]["id"]

export type AnalysisInput = {
  teamName: string
  transcript: string
  charter: string
  feedback: string
  assessments: string
  focus: FocusId[]
}

export type ReportMode = "local" | "openai" | "sample"

export type Confidence = "low" | "medium" | "high"

export type SpeakerStat = {
  name: string
  turns: number
  words: number
  wordShare: number
  questions: number
  buildOns: number
}

export type Strength = {
  title: string
  detail: string
}

export type Opportunity = {
  title: string
  observation: string
  evidence: string
  whyItMatters: string
  confidence: Confidence
  limitations: string
}

export type ActionItem = {
  problem: string
  action: string
  owner: string
  when: string
  evaluate: string
}

export type Report = {
  mode: ReportMode
  teamName: string
  focus: FocusId[]
  disclaimer: string
  executiveSummary: {
    strengths: string
    challenges: string
    priority: string
  }
  participation: {
    summary: string
    speakers: SpeakerStat[]
  }
  communication: {
    summary: string
  }
  roles: {
    summary: string
  }
  strengths: Strength[]
  opportunities: Opportunity[]
  actions: ActionItem[]
  discussionQuestions: string[]
  limitations: string[]
}

export function emptyInput(): AnalysisInput {
  return {
    teamName: "",
    transcript: "",
    charter: "",
    feedback: "",
    assessments: "",
    focus: FOCUS_OPTIONS.map((option) => option.id),
  }
}

export function focusLabel(id: FocusId): string {
  return FOCUS_OPTIONS.find((option) => option.id === id)?.label ?? id
}
