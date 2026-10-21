import assert from "node:assert/strict"
import { buildReport } from "../src/lib/analyze.ts"
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

console.log("report checks ok")
console.log(sample.executiveSummary.priority.slice(0, 180))
console.log("---")
console.log(sample.opportunities.map((item) => item.title).join(" | "))
console.log(sample.strengths.map((item) => item.title).join(" | "))
