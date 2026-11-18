import type { ReplayMoment } from "./types.ts"

export type PracticeResult = {
  verdict: "strong" | "mixed" | "weak"
  kept: string[]
  missing: string[]
}

export function coachFacilitatorLine(draft: string, moment: ReplayMoment): PracticeResult {
  const text = draft.replace(/\s+/g, " ").trim()
  const kept: string[] = []
  const missing: string[] = []
  if (text.length < 12) {
    return {
      verdict: "weak",
      kept: [],
      missing: ["Write a full facilitator line, the way you would say it out loud."],
    }
  }

  const personal = /\b(you always|you never|your fault|you're being|you are being|calm down|just be quiet)\b/i.test(text)
  const work = /\b(option|requirement|risk|evidence|brief|accessibility|vendor|proposal|decision|date|owner)\b/i.test(text)
  const question = /\?/.test(text)
  const namesWork = /\b(the (idea|option|plan|requirement|risk))\b/i.test(text)
  const generic = /\b(any thoughts|thoughts\?|anyone\?)\b/i.test(text)
  const invited = moment.inviteName && new RegExp(`\\b${escapeReg(moment.inviteName)}\\b`, "i").test(text)
  const firstRound = /\b(first round|one point|before (anyone|we) (takes?|take) a second|each person speaks)\b/i.test(text)
  const owner = /\b(i will|owner|by (monday|tuesday|wednesday|thursday|friday|tonight|tomorrow)|\bdate\b)\b/i.test(text)

  if (personal) missing.push("The line still aims at a person. Name the option, the requirement, or the risk.")
  else kept.push("The wording stays off personal labels such as “you always.”")

  if (moment.kind === "relationship") {
    if (work || namesWork) kept.push("The challenge is aimed at the work.")
    else missing.push("Name the option or the requirement you want the group to look at.")
    if (question) kept.push("You left room for a reply.")
    else missing.push("End with a question so the group can answer the work, not the person.")
  }

  if (moment.kind === "invite") {
    if (generic) missing.push("“Any thoughts?” is the pattern that produced a short pass. Ask for a risk, a requirement, or a missing fact.")
    if (invited) kept.push(`You asked ${moment.inviteName} by name.`)
    else if (moment.inviteName) missing.push(`Ask ${moment.inviteName} by name, with a concrete topic.`)
    if (/\b(risk|requirement|missing|evidence|unclear|need to see)\b/i.test(text)) kept.push("The question is specific enough to answer.")
    else missing.push("Ask for one risk, one requirement, or one missing fact.")
  }

  if (moment.kind === "norm") {
    if (firstRound) kept.push("You brought the participation rule into the room before the debate hardened.")
    else missing.push("Say the first-round rule out loud before the next proposal.")
  }

  if (moment.kind === "close") {
    if (owner) kept.push("The close names a next step with a time attached.")
    else missing.push("Name an owner and a time before the meeting ends.")
    if (question && /\bobject|live with|consent\b/i.test(text)) kept.push("You invited a last check before locking the choice.")
  }

  if (question && !missing.some((item) => /question/i.test(item))) {
    if (!kept.includes("You left room for a reply.")) kept.push("You left room for a reply.")
  }

  const uniqueKept = [...new Set(kept)]
  const uniqueMissing = [...new Set(missing)]
  const verdict = uniqueMissing.length === 0 ? "strong" : uniqueKept.length >= uniqueMissing.length ? "mixed" : "weak"
  return { verdict, kept: uniqueKept, missing: uniqueMissing }
}

export function exampleLine(moment: ReplayMoment): string {
  if (moment.kind === "relationship") {
    return moment.inviteName
      ? `I want us to stay on the option. What evidence would settle the requirement that just came up? ${moment.inviteName}, which risk still looks real to you?`
      : "I want us to stay on the option. What evidence would we need to see before we lock this choice?"
  }
  if (moment.kind === "invite") {
    return `${moment.inviteName || "Member B"}, before we wrap: what requirement or risk is still missing from this proposal?`
  }
  if (moment.kind === "norm") {
    return "Before the next proposal, a first round: one point each, no second turns. I will wait until everyone has spoken once."
  }
  return "Before we leave: who owns the next step, and by when? Does anyone still object?"
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
