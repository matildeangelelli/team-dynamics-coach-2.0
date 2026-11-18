import assert from "node:assert/strict"
import { buildReport, groundModelReport } from "../src/lib/analyze.ts"
import { parseAnalysisInput } from "../src/lib/input.ts"
import { coachFacilitatorLine } from "../src/lib/practice.ts"
import { sampleInput } from "../src/lib/sample.ts"

const sample = buildReport(sampleInput(), "sample")
assert.equal(sample.mode, "sample")
assert.equal(sample.actions.length, 3)
assert.equal(sample.discussionQuestions.length, 3)
assert.ok(sample.strengths.length >= 2)
assert.ok(sample.opportunities.length >= 1 && sample.opportunities.length <= 3)
assert.match(sample.communication.summary, /accessibility|You always|person/i)
assert.match(sample.disclaimer, /language model was not used/i)
assert.doesNotMatch(`${sample.communication.summary} ${sample.participation.summary}`, /felt unsafe|feels unsafe|was excluded/i)

const other = buildReport(
  {
    teamName: "Lab pair",
    transcript: `Member A: Let's decide the outline today. I will draft the intro by Friday.
Member B: I can take the sources section.
Member A: What source are you least sure about?
Member B: The pricing article. I might be wrong, but the date looks old.
Member A: Then we cite a newer one. I will check that tonight.`,
    charter: "Purpose: Finish the outline. Decision rule: the pair agrees before leaving.",
    feedback: "",
    assessments: "",
    focus: ["coordination"],
  },
  "local",
)
assert.equal(other.teamName, "Lab pair")
assert.doesNotMatch(other.participation.summary, /Northline/)
assert.equal(other.actions.length, 3)

const thin = buildReport({ ...sampleInput(), transcript: "Member A: Hi." }, "local")
assert.equal(thin.opportunities[0]?.confidence, "low")
assert.doesNotMatch(thin.executiveSummary.challenges, /Northline/)

const line = "Member A: We should keep the requirement visible while we compare options.\nMember B: What risk are we missing before Friday?\n"
let longTranscript = ""
while (longTranscript.length < 30_000) longTranscript += line
longTranscript += "Member D: The closing token is BLUEHERON and I will send the note tonight.\n"
const longReport = buildReport({ ...sampleInput(), teamName: "Long meeting", transcript: longTranscript }, "local")
const closer = longReport.participation.speakers.find((speaker) => speaker.name === "Member D")
assert.equal(closer?.turns, 1, "the line after 30,000 characters was dropped")
const readWords = longReport.participation.speakers.reduce((sum, speaker) => sum + speaker.words, 0)
assert.ok(readWords > 4_000, `expected the full transcript to be counted, got ${readWords} words`)
assert.doesNotMatch(longReport.executiveSummary.challenges, /too little|24,000|first portion/i)
assert.doesNotMatch(longReport.limitations.join(" "), /24,000/)

let headerTranscript = ""
while (headerTranscript.length < 8_000) {
  headerTranscript += "Member A 0:01\nI am not sure this timeline works because the risk is real.\n\nMember B 0:20\nWhat would you need to see? I will draft the note.\n\n"
}
const headerReport = buildReport({ ...sampleInput(), transcript: headerTranscript }, "local")
assert.doesNotMatch(headerReport.executiveSummary.challenges, /too little text/i)
assert.ok(headerReport.participation.speakers.some((speaker) => speaker.name === "Member A"))
assert.doesNotMatch(sample.executiveSummary.priority, /You asked about participation and inclusion, communication/i)
assert.match(sample.executiveSummary.priority, /facilitator|first round|agenda|note-taker/i)
assert.ok(sample.replay.some((moment) => moment.kind === "relationship"))
assert.ok(sample.script.length >= 4)
assert.ok(sample.echo)
assert.ok(sample.path[0] === "Member A")
const hardLine = sample.replay.find((moment) => moment.kind === "relationship")
assert.ok(hardLine)
assert.equal(coachFacilitatorLine("You always need to stop talking.", hardLine).verdict, "weak")
assert.equal(
  coachFacilitatorLine(
    "I want us to stay on the option. What evidence would settle the accessibility requirement? Member B, which risk still looks real?",
    hardLine,
  ).verdict,
  "strong",
)

const parsed = parseAnalysisInput({
  teamName: "  Campus App Team  ",
  transcript: sampleInput().transcript,
  focus: ["participation", "not-a-focus"],
  charter: 12,
})
assert.equal(parsed?.teamName.trim(), "Campus App Team")
assert.deepEqual(parsed?.focus, ["participation"])
assert.equal(parsed?.charter, "")
assert.equal(parseAnalysisInput({ teamName: "Team", transcript: "   " }), null)

const local = buildReport(sampleInput(), "local")
const grounded = groundModelReport(
  {
    executiveSummary: {
      strengths: "The group reused an idea.",
      challenges: "Airtime was uneven.",
      priority: "Run a first round.",
    },
    participation: {
      summary: "Invented counts.",
      speakers: [{ name: "Invented", turns: 99, words: 9999, wordShare: 1, questions: 0, buildOns: 0 }],
    },
    communication: { summary: "Questions were answered." },
    roles: { summary: "No charter check." },
    strengths: [{ title: "Uptake", detail: "An idea moved." }, { title: "Work challenge", detail: "A reason was attached." }],
    opportunities: [
      {
        title: "Airtime",
        observation: "One person held the floor.",
        evidence: "A short quote.",
        whyItMatters: "Later speakers inherit the menu.",
        confidence: "low",
        limitations: "One meeting.",
      },
    ],
    actions: [
      { problem: "Thin", action: "Too short", owner: "Facilitator", when: "Now", evaluate: "Look" },
      { problem: "Thin two", action: "Also short", owner: "Facilitator", when: "Now", evaluate: "Look" },
      { problem: "Thin three", action: "Still short", owner: "Facilitator", when: "Now", evaluate: "Look" },
    ],
    discussionQuestions: ["Q1?", "Q2?", "Q3?"],
  },
  sampleInput(),
  local,
)
assert.ok(grounded)
assert.deepEqual(grounded.participation.speakers, local.participation.speakers)
assert.deepEqual(grounded.actions, local.actions)

console.log("report checks ok")
console.log(sample.executiveSummary.priority.slice(0, 180))
console.log("---")
console.log(sample.opportunities.map((item) => item.title).join(" | "))
console.log(sample.strengths.map((item) => item.title).join(" | "))
