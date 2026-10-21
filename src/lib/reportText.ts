import { focusLabel, type Report } from "./types.ts"

export function reportToText(report: Report): string {
  const lines = [
    `Team Dynamics Coach — ${report.teamName}`,
    report.disclaimer,
    "",
    `Focus: ${report.focus.map(focusLabel).join(", ")}`,
    "",
    "Executive summary",
    `Strengths: ${report.executiveSummary.strengths}`,
    `Challenges: ${report.executiveSummary.challenges}`,
    `Priority: ${report.executiveSummary.priority}`,
    "",
    "Participation and inclusion",
    report.participation.summary,
  ]
  for (const speaker of report.participation.speakers) {
    lines.push(
      `- ${speaker.name}: ${Math.round(speaker.wordShare * 100)}% of words, ${speaker.turns} turns, ${speaker.questions} questions`,
    )
  }
  lines.push("", "Communication and psychological safety", report.communication.summary, "", "Roles and coordination", report.roles.summary, "", "Strengths")
  if (!report.strengths.length) lines.push("Not enough evidence to name a strength.")
  for (const strength of report.strengths) lines.push(`${strength.title}: ${strength.detail}`)
  lines.push("", "Opportunities")
  for (const item of report.opportunities) {
    lines.push(
      `${item.title} (${item.confidence} confidence)`,
      item.observation,
      `Evidence: ${item.evidence}`,
      `Why it might matter: ${item.whyItMatters}`,
      `Limitations: ${item.limitations}`,
      "",
    )
  }
  lines.push("Action plan")
  report.actions.forEach((action, index) => {
    lines.push(
      `${index + 1}. ${action.problem}`,
      `Action: ${action.action}`,
      `Owner: ${action.owner}`,
      `When: ${action.when}`,
      `How to tell: ${action.evaluate}`,
      "",
    )
  })
  lines.push("Discussion questions")
  report.discussionQuestions.forEach((question, index) => lines.push(`${index + 1}. ${question}`))
  lines.push("", "Limitations")
  for (const note of report.limitations) lines.push(`- ${note}`)
  return lines.join("\n").trim()
}
