import {
  FOCUS_OPTIONS,
  type ActionItem,
  type AnalysisInput,
  type Confidence,
  type FocusId,
  type Opportunity,
  type Report,
  type ReportMode,
  type SpeakerStat,
  type Strength,
} from "./types.ts"

const RELATIONSHIP =
  /\b(you always|you never|your fault|you don't listen|you do not listen|you're being|you are being)\b/i
const HEDGE = /\b(i might be wrong|i may be wrong|i could be wrong|i'm not sure|i am not sure)\b/i
const TASK =
  /\b(i disagree|i don't agree|i do not agree|not sure|the risk|push back|another option|on the other hand)\b/i
const BUILD =
  /\b(building on|build on|adding to|add to|i agree|agree with|your point|that point|['’]s point|what \w+ said|as \w+ said)\b/i

type Turn = {
  speaker: string
  text: string
  words: number
  question: boolean
  buildOn: boolean
}

type Scored = SpeakerStat & {
  quotes: string[]
  assessment: string
}

type OppDraft = Opportunity & { rank: number }

export function buildReport(input: AnalysisInput, mode: ReportMode): Report {
  const focus = sanitizeFocus(input.focus)
  const teamName = input.teamName.trim() || "Untitled team"
  const transcript = input.transcript
  const turns = parseTranscript(transcript)
  const names = uniqueNames(turns)
  const scored = names.map((name) => scoreSpeaker(name, turns, input.assessments))
  const totalWords = turns.reduce((sum, turn) => sum + turn.words, 0) || 1
  for (const row of scored) row.wordShare = row.words / totalWords
  const speakers = [...scored].sort((a, b) => b.words - a.words)
  const limitations = baseLimitations(input)
  const disclaimer = disclaimerFor(mode)
  const rawWords = wordCount(transcript)

  if (rawWords < 40) {
    return thinReport({ teamName, focus, mode, disclaimer, speakers, limitations, turns: turns.length })
  }

  const top = speakers[0]
  const low = speakers[speakers.length - 1]
  const relTurns = turns.filter((turn) => RELATIONSHIP.test(turn.text))
  const taskTurns = turns.filter((turn) => TASK.test(turn.text) && !RELATIONSHIP.test(turn.text))
  const questions = turns.filter((turn) => turn.question)
  const answered = questions.filter((turn) => {
    const index = turns.indexOf(turn)
    const next = turns[index + 1]
    return Boolean(next && next.speaker !== turn.speaker)
  })
  const uptake = findUptake(turns)
  const normHit = findNormHit(input.charter, turns)
  const commitments = findCommitments(turns)
  const vagueInvite = findVagueInvite(turns, speakers)
  const namedMissing = missingLabels(input, names)
  const feedbackNote = relevantFeedback(input.feedback, top, low)

  const participation = participationSummary({
    speakers,
    totalTurns: turns.length,
    top,
    low,
    uptake,
    vagueInvite,
    namedMissing,
    feedbackNote,
  })
  const communication = communicationSummary({
    relTurns,
    taskTurns,
    questions,
    answered,
    hedgeCount: turns.filter((turn) => HEDGE.test(turn.text)).length,
    repair: findRepair(turns, relTurns),
  })
  const roles = rolesSummary({ input, turns, normHit, commitments })

  const strengths = collectStrengths({ uptake, taskTurns, commitments, answered, questions, normHit })
  const opportunities = collectOpportunities({
    focus,
    top,
    low,
    totalTurns: turns.length,
    relTurns,
    vagueInvite,
    normHit,
    commitments,
    input,
    feedbackNote,
    namedMissing,
  })
  const actions = collectActions(opportunities, {
    top,
    low,
    totalTurns: turns.length,
    norm: participationNorm(input.charter),
    hasConsent: /consent|object|full round/i.test(input.charter),
  })
  const discussionQuestions = collectQuestions(opportunities, focus)

  const leadOpp = opportunities[0]
  const leadStrength = strengths[0]
  const focusText = focus.map(labelFor).join(", ")

  return {
    mode,
    teamName,
    focus,
    disclaimer,
    executiveSummary: {
      strengths: leadStrength
        ? leadStrength.detail
        : "This meeting does not yet show two clear, evidence-backed strengths.",
      challenges: leadOpp
        ? leadOpp.observation
        : "No strong process problem stood out beyond the limits of a single transcript.",
      priority: `You asked about ${focusText}. ${actions[0]?.action ?? "Use the next meeting to gather a fuller sample."}`,
    },
    participation: { summary: participation, speakers: speakers.map(publicSpeaker) },
    communication: { summary: communication },
    roles: { summary: roles },
    strengths,
    opportunities: opportunities.map(stripRank),
    actions,
    discussionQuestions,
    limitations,
  }
}

export function coerceReport(value: unknown, input: AnalysisInput): Report | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<Report>
  const focus = sanitizeFocus(Array.isArray(raw.focus) ? raw.focus : input.focus)
  if (!raw.executiveSummary || !raw.participation || !raw.communication || !raw.roles) return null
  if (!isText(raw.executiveSummary.strengths) || !isText(raw.executiveSummary.challenges) || !isText(raw.executiveSummary.priority)) {
    return null
  }
  if (!isText(raw.participation.summary) || !isText(raw.communication.summary) || !isText(raw.roles.summary)) return null
  const strengths = asStrengths(raw.strengths)
  const opportunities = asOpportunities(raw.opportunities)
  const actions = asActions(raw.actions)
  const discussionQuestions = asQuestions(raw.discussionQuestions)
  if (!strengths || !opportunities || !actions || !discussionQuestions) return null
  const speakers = Array.isArray(raw.participation.speakers)
    ? raw.participation.speakers.filter(isSpeaker).slice(0, 12)
    : []
  return {
    mode: "openai",
    teamName: input.teamName.trim() || "Untitled team",
    focus,
    disclaimer:
      "This report was drafted by a language model from the text you submitted. Check the quotes against the transcript before you share it. It is a suggestion, not a judgment about any person.",
    executiveSummary: {
      strengths: raw.executiveSummary.strengths.trim(),
      challenges: raw.executiveSummary.challenges.trim(),
      priority: raw.executiveSummary.priority.trim(),
    },
    participation: { summary: raw.participation.summary.trim(), speakers },
    communication: { summary: raw.communication.summary.trim() },
    roles: { summary: raw.roles.summary.trim() },
    strengths,
    opportunities,
    actions,
    discussionQuestions,
    limitations: Array.isArray(raw.limitations)
      ? raw.limitations.filter(isText).map((item) => item.trim()).slice(0, 6)
      : ["A transcript cannot show how anyone felt. Review every claim against the source text."],
  }
}

function thinReport(args: {
  teamName: string
  focus: FocusId[]
  mode: ReportMode
  disclaimer: string
  speakers: Scored[]
  limitations: string[]
  turns: number
}): Report {
  const observation = `The transcript has ${args.turns} recognizable turn${args.turns === 1 ? "" : "s"}. That is too little text to describe a team pattern.`
  return {
    mode: args.mode,
    teamName: args.teamName,
    focus: args.focus,
    disclaimer: args.disclaimer,
    executiveSummary: {
      strengths: "There is not enough meeting text to name a team strength without guessing.",
      challenges: observation,
      priority: "Record one full working meeting, with permission, and read that transcript before changing how people work.",
    },
    participation: {
      summary: `${observation} Speaking time is not contribution quality, and this sample is too small to separate the two.`,
      speakers: args.speakers.map(publicSpeaker),
    },
    communication: {
      summary:
        "Questions, disagreement, and listening cannot be judged from a fragment. A transcript also cannot establish psychological safety, which is someone’s experience, not a word count.",
    },
    roles: {
      summary: "Roles, norms, and decision rules need a fuller meeting, and a charter if you have one, before they can be compared.",
    },
    strengths: [],
    opportunities: [
      {
        title: "The sample is too thin",
        observation,
        evidence: "Fewer than four speaker turns, or fewer than 80 words, were available.",
        whyItMatters: "Advice based on a fragment can send a leader after the wrong problem.",
        confidence: "low",
        limitations: "Absence of evidence in a short paste is not evidence that the team lacks a strength.",
      },
    ],
    actions: [
      {
        problem: "The current text cannot support an evidence-based reading.",
        action:
          "Record the next working meeting with the team’s agreement. Replace names with Member A, Member B, and so on. Paste the full arc: opening, discussion, and close.",
        owner: "Team leader",
        when: "The next scheduled meeting",
        evaluate: "The new transcript includes several speakers and both the start and the end of the decision.",
      },
      {
        problem: "Norms cannot be compared until they are written down.",
        action: "Add the team charter, even as a short note: purpose, roles, decision rule, and one participation norm.",
        owner: "Facilitator",
        when: "Before the next analysis",
        evaluate: "The charter states who facilitates and how a decision is closed.",
      },
      {
        problem: "Individual preferences should not be guessed.",
        action: "If you have permission, add a line per person about how they enter a conversation. Leave the field blank if you do not.",
        owner: "Team leader",
        when: "Before the next analysis",
        evaluate: "Any preference in the report is tied to a sentence the person agreed to share.",
      },
    ],
    discussionQuestions: [
      "What part of our next meeting would we want a facilitator to protect?",
      "How do we want disagreement to sound when it is about the work?",
      "What would a useful close include: an owner, a date, or a check for objections?",
    ],
    limitations: args.limitations,
  }
}

function participationSummary(args: {
  speakers: Scored[]
  totalTurns: number
  top: Scored
  low: Scored
  uptake: { word: string; from: string; to: string } | null
  vagueInvite: { speaker: string; by: string; quote: string } | null
  namedMissing: string[]
  feedbackNote: string
}): string {
  const { top, low, speakers, totalTurns } = args
  if (speakers.length < 2) {
    return "Only one speaker label was recognized. A participation comparison needs more than one voice, or speaker names at the start of each line."
  }
  const parts = [
    `${top.name} used ${pct(top.wordShare)} of the words (${top.turns} of ${totalTurns} turns). ${low.name} used ${pct(low.wordShare)} (${low.words} words).`,
    "Speaking time is not the same as contribution quality. Frequency, length, and whether a turn added a reason or a question are separate.",
  ]
  if (args.uptake && args.uptake.from !== top.name) {
    parts.push(
      `${args.uptake.from} introduced “${args.uptake.word},” and ${args.uptake.to} picked it up. That is a substantive contribution even if it was not the longest turn.`,
    )
  }
  if (args.vagueInvite) {
    parts.push(
      `${args.vagueInvite.by} invited ${args.vagueInvite.speaker} with a broad prompt: “${tidy(args.vagueInvite.quote, 90)}.” The following turn from ${args.vagueInvite.speaker} stayed short. The transcript does not show an interruption.`,
    )
  }
  const preference = args.low.assessment
  if (preference && /specific question|read first|when asked/i.test(preference)) {
    parts.push(
      `A shared preference for ${args.low.name} says: “${tidy(preference, 140)}.” That is self-report, not an observation of motive.`,
    )
  }
  if (args.namedMissing.length) {
    parts.push(
      `${args.namedMissing.join(", ")} ${args.namedMissing.length === 1 ? "is" : "are"} named in the other materials and ${args.namedMissing.length === 1 ? "does" : "do"} not speak here. They may have been absent, or they may have been overlooked. This transcript cannot tell those apart.`,
    )
  }
  if (args.feedbackNote) {
    parts.push(`Separate feedback, not this transcript: “${tidy(args.feedbackNote, 180)}.”`)
  }
  return parts.join(" ")
}

function communicationSummary(args: {
  relTurns: Turn[]
  taskTurns: Turn[]
  questions: Turn[]
  answered: Turn[]
  hedgeCount: number
  repair: string
}): string {
  const bits = [
    `${args.questions.length} question${args.questions.length === 1 ? "" : "s"} appear, and ${args.answered.length} ${args.answered.length === 1 ? "is" : "are"} followed by someone else.`,
  ]
  if (args.taskTurns.length && !args.relTurns.length) {
    bits.push(
      `${args.taskTurns[0].speaker} challenges an idea and gives a reason: “${tidy(sentenceWith(args.taskTurns[0].text, TASK), 140)}.” The words stay on the work.`,
    )
  }
  if (args.relTurns.length) {
    bits.push(
      `One disagreement aims at a person: “${tidy(sentenceWith(args.relTurns[0].text, RELATIONSHIP), 120)}.”`,
    )
    if (args.taskTurns.length) {
      bits.push(
        `Earlier, ${args.taskTurns[0].speaker} had challenged the idea itself: “${tidy(sentenceWith(args.taskTurns[0].text, TASK), 120)}.”`,
      )
    }
    if (args.repair) bits.push(`A later turn returns to “${args.repair}.” That is observable repair of the topic, not evidence about anyone’s feelings.`)
  } else if (args.hedgeCount) {
    bits.push("Someone marks uncertainty out loud. That is a sign of careful speech, not proof that the room feels safe.")
  }
  bits.push(
    "Psychological safety is an experience. A transcript can show questions, acknowledgment, and the tone of disagreement. It cannot establish how safe anyone felt.",
  )
  return bits.join(" ")
}

function rolesSummary(args: {
  input: AnalysisInput
  turns: Turn[]
  normHit: { speaker: string; text: string; late: boolean } | null
  commitments: string[]
}): string {
  const charter = args.input.charter.trim()
  if (!charter) {
    return "No team charter was provided, so roles, norms, and the decision rule cannot be compared with this meeting. Commitments can still be read from the close."
      + closeSentence(args.commitments)
  }
  const bits: string[] = []
  const purpose = fieldValue(charter, /purpose/i)
  if (purpose && !openingMatches(args.turns, purpose)) {
    bits.push("The charter asks the meeting to start from its purpose. The opening moves straight to a proposal.")
  } else if (purpose) {
    bits.push("The opening touches the purpose written in the charter.")
  }
  if (args.normHit) {
    bits.push(
      args.normHit.late
        ? `${args.normHit.speaker} cites a participation norm after the pattern is already underway: “${tidy(args.normHit.text, 140)}.”`
        : `${args.normHit.speaker} cites a participation norm early enough to shape the meeting.`,
    )
  } else if (participationNorm(charter)) {
    bits.push(`The charter contains a participation norm (“${tidy(participationNorm(charter), 140)}”), and nobody says it in this transcript.`)
  }
  if (/consent|nobody objects|full round/i.test(charter)) {
    const end = args.turns.slice(Math.floor(args.turns.length * 0.55)).map((turn) => turn.text).join(" ")
    bits.push(
      /object|consent|live with|we agree/i.test(end)
        ? "The ending includes language that resembles a consent check."
        : "The decision rule calls for a check that nobody still objects. The ending does not show that check.",
    )
  }
  const roles = fieldValue(charter, /roles?/i)
  if (roles) bits.push(`The charter assigns roles this way: “${tidy(roles, 180)}.” The transcript shows who spoke, not whether each role was fulfilled.`)
  bits.push(closeSentence(args.commitments).trim())
  return bits.filter(Boolean).join(" ")
}

function collectStrengths(args: {
  uptake: { word: string; from: string; to: string } | null
  taskTurns: Turn[]
  commitments: string[]
  answered: Turn[]
  questions: Turn[]
  normHit: { speaker: string; text: string; late: boolean } | null
}): Strength[] {
  const strengths: Strength[] = []
  if (args.uptake) {
    strengths.push({
      title: "Ideas moved between people",
      detail: `“${args.uptake.word}” starts with ${args.uptake.from} and is picked up by ${args.uptake.to}. The group did not only stack separate opinions.`,
    })
  }
  if (args.taskTurns.length) {
    strengths.push({
      title: "A challenge stayed on the work",
      detail: `${args.taskTurns[0].speaker} disagreed with a reason attached: “${tidy(sentenceWith(args.taskTurns[0].text, TASK), 140)}.”`,
    })
  }
  if (args.commitments.length) {
    strengths.push({
      title: "The close named a next step",
      detail: `The ending includes a concrete offer: “${tidy(args.commitments[0], 140)}.”`,
    })
  }
  if (args.questions.length && args.answered.length >= Math.ceil(args.questions.length * 0.5)) {
    strengths.push({
      title: "Questions received a response",
      detail: `${args.answered.length} of ${args.questions.length} questions are followed by a different speaker.`,
    })
  }
  if (args.normHit) {
    strengths.push({
      title: "Someone brought the charter into the room",
      detail: `${args.normHit.speaker} said the norm out loud: “${tidy(args.normHit.text, 140)}.”`,
    })
  }
  return strengths.slice(0, 3)
}

function collectOpportunities(args: {
  focus: FocusId[]
  top: Scored
  low: Scored
  totalTurns: number
  relTurns: Turn[]
  vagueInvite: { speaker: string; by: string; quote: string } | null
  normHit: { speaker: string; text: string; late: boolean } | null
  commitments: string[]
  input: AnalysisInput
  feedbackNote: string
  namedMissing: string[]
}): OppDraft[] {
  const items: OppDraft[] = []
  const norm = participationNorm(args.input.charter)

  if (args.relTurns.length) {
    items.push({
      rank: rank("feedback", args.focus, 0),
      title: "Disagreement landed on a person",
      observation: `${args.relTurns[0].speaker} answered a challenge by characterizing the person, not only the option.`,
      evidence: `“${tidy(sentenceWith(args.relTurns[0].text, RELATIONSHIP), 160)}.”`,
      whyItMatters:
        "Direct feedback helps a team when it stays on the work. A personal frame makes the next disagreement harder to offer, even when you cannot know how it felt.",
      confidence: "medium",
      limitations: "This is one sentence in one meeting. It shows the wording. It does not show intent, history, or anyone’s private reaction.",
    })
  }

  if (args.top && args.low && args.top.name !== args.low.name && (args.top.wordShare >= 0.4 || args.low.wordShare <= 0.08)) {
    const agreed = args.feedbackNote && namesIn(args.feedbackNote, [args.top.name, args.low.name])
    items.push({
      rank: rank("participation", args.focus, 1),
      title: "Airtime was uneven",
      observation: `${args.top.name} used ${pct(args.top.wordShare)} of the words. ${args.low.name} used ${pct(args.low.wordShare)}.`,
      evidence: agreed
        ? `In this transcript, ${args.top.name} has ${args.top.turns} of ${args.totalTurns} turns and ${args.low.name} has ${args.low.words} words. Separate feedback points the same way: “${tidy(args.feedbackNote, 160)}.”`
        : `${args.top.name}: “${tidy(args.top.quotes[0] || "", 120)}.” ${args.low.name}: “${tidy(args.low.quotes[0] || "", 80)}.”`,
      whyItMatters:
        "A first proposal can set the menu before other requirements are heard. Uneven airtime is a process pattern, not a measure of who had the better idea.",
      confidence: agreed ? "medium" : "low",
      limitations: agreed
        ? "Two samples agree on the shape of airtime. They still cannot say whether the quieter person was thinking, unprepared, or left out."
        : "One meeting can be a bad day or a role that required a long update. Do not treat this share as a stable trait.",
    })
  }

  if (args.vagueInvite) {
    items.push({
      rank: rank("participation", args.focus, 2),
      title: "The invitation was too broad",
      observation: `${args.vagueInvite.speaker} was asked for a view in a general way and answered briefly.`,
      evidence: `${args.vagueInvite.by}: “${tidy(args.vagueInvite.quote, 120)}.”`,
      whyItMatters:
        "A specific question gives a quieter role something concrete to answer. “Any thoughts?” often produces a polite pass.",
      confidence: "medium",
      limitations: "A short reply can be agreement. The transcript shows the shape of the invitation, not the reason for the short answer.",
    })
  }

  if (norm && (!args.normHit || args.normHit.late)) {
    items.push({
      rank: rank("roles", args.focus, 3),
      title: args.normHit ? "The norm arrived late" : "The participation norm stayed on paper",
      observation: args.normHit
        ? "Someone did cite the charter, after the airtime pattern was already visible."
        : "The charter states a participation norm that this meeting never says aloud.",
      evidence: args.normHit
        ? `${args.normHit.speaker}: “${tidy(args.normHit.text, 160)}.”`
        : `Charter: “${tidy(norm, 160)}.”`,
      whyItMatters: "A norm changes the meeting only if it is used before the first proposal, not remembered afterward.",
      confidence: "medium",
      limitations: "People can follow a norm without quoting it. Silence about the charter is not proof they ignored every part of it.",
    })
  }

  if (!args.commitments.length) {
    items.push({
      rank: rank("coordination", args.focus, 4),
      title: "The close did not name an owner",
      observation: "The last part of the transcript does not show a person taking a next step with a time attached.",
      evidence: "No turn near the end matches a clear commitment such as “I will” plus a task.",
      whyItMatters: "Without an owner and a date, a lively discussion can expire before the next meeting.",
      confidence: "low",
      limitations: "Owners may have been assigned in a document that was not pasted here.",
    })
  }

  if (args.namedMissing.length) {
    items.push({
      rank: rank("participation", args.focus, 2),
      title: "A named person does not appear",
      observation: `${args.namedMissing.join(" and ")} ${args.namedMissing.length === 1 ? "is" : "are"} in the supporting materials and absent from the transcript.`,
      evidence: "The label appears in the charter, feedback, or assessments, and not as a speaker.",
      whyItMatters: "Inclusion starts by noticing who was expected in the room. The next step is to ask, not to assume they were shut out.",
      confidence: "low",
      limitations: "They may have been absent, or the transcript may be a partial paste.",
    })
  }

  return items.sort((a, b) => a.rank - b.rank).slice(0, 3)
}

function collectActions(
  opportunities: OppDraft[],
  ctx: { top: Scored; low: Scored; totalTurns: number; norm: string; hasConsent: boolean },
): ActionItem[] {
  const actions: ActionItem[] = []
  for (const item of opportunities) {
    if (/person/i.test(item.title)) {
      actions.push({
        problem: "A disagreement was worded at a person.",
        action:
          "Set one line before the next decision: disagreements name the option. If a comment lands on someone, the facilitator restates it as a question about the choice, then asks what evidence would resolve it.",
        owner: "Facilitator",
        when: "The next decision discussion",
        evaluate: "In the next transcript, challenges name an option or a requirement. Phrases such as “you always” or “you never” do not appear.",
      })
    } else if (/Airtime/i.test(item.title)) {
      actions.push({
        problem: `${ctx.top.name} used ${pct(ctx.top.wordShare)} of the words and ${ctx.low.name} used ${pct(ctx.low.wordShare)}.`,
        action:
          "Run a first round before open debate: one point each, no second turns. Ask a specific question of anyone who has not spoken. The person who usually opens waits until that round is finished.",
        owner: "Facilitator",
        when: "The start of the next working meeting",
        evaluate: `Every person present speaks once before anyone takes a third turn. Equal minutes are not the goal. Look for a reason or a question from ${ctx.low.name}, not a longer speech.`,
      })
    } else if (/invitation/i.test(item.title)) {
      actions.push({
        problem: "A general prompt produced a very short reply.",
        action: `Replace “any thoughts?” with one question tied to the role. For the person in ${ctx.low.name}’s seat, ask for a requirement, a risk, or a missing fact.`,
        owner: "Facilitator",
        when: "During the first round of the next meeting",
        evaluate: "The invitation names a concrete topic, and the reply adds a requirement, a risk, or a question.",
      })
    } else if (/norm/i.test(item.title)) {
      actions.push({
        problem: "The participation norm was missing at the start.",
        action: `Put this sentence at the top of the agenda and read it before the first proposal: “${tidy(ctx.norm || "Each person speaks once before anyone takes a second turn.", 160)}”`,
        owner: "Facilitator",
        when: "Before content, next meeting",
        evaluate: "The norm is spoken in the first third of the meeting.",
      })
    } else if (/owner/i.test(item.title) || /close/i.test(item.title)) {
      actions.push({
        problem: "The meeting did not leave a visible owner and date.",
        action: ctx.hasConsent
          ? "Save the last five minutes. The note-taker writes one owner and one date. The facilitator asks whether anyone still objects."
          : "Save the last five minutes. The note-taker writes one owner and one date before the meeting ends.",
        owner: "Note-taker",
        when: "The end of the next decision meeting",
        evaluate: "The notes name an owner and a date. If the rule is consent, they also note that objections were invited.",
      })
    } else if (/named person/i.test(item.title)) {
      actions.push({
        problem: "Someone named in the materials does not appear in the transcript.",
        action: "At the start, the facilitator checks who is missing and whether their input is required before a decision. Do not treat absence as a lack of interest.",
        owner: "Facilitator",
        when: "Opening of the next meeting",
        evaluate: "The notes say who was absent and whether the decision waited for them.",
      })
    }
  }

  const fillers: ActionItem[] = [
    {
      problem: "The team needs a repeatable way to hear a second view before a proposal hardens.",
      action: "Ask each person for one risk or one requirement before anyone argues for a vendor, tool, or plan.",
      owner: "Facilitator",
      when: "Next working meeting",
      evaluate: "At least one requirement appears before the second defense of the opening proposal.",
    },
    {
      problem: "Care and directness can be practiced on purpose.",
      action:
        "When you challenge an idea, name what you are trying to protect, then ask what the other person would need to see. Direct words, aimed at the work.",
      owner: "Any team member offering a challenge",
      when: "The next time a recommendation is on the table",
      evaluate: "The challenge names the work product and a piece of evidence, then leaves room for a reply.",
    },
    {
      problem: "The team has not yet checked whether this reading matches their experience.",
      action: "Share the discussion questions with the team, not the speaker percentages, and agree on one practice to try next time.",
      owner: "Team leader",
      when: "Within a week of this reading",
      evaluate: "The team names one practice, and the next transcript shows that practice in use.",
    },
  ]
  for (const filler of fillers) {
    if (actions.length >= 3) break
    if (!actions.some((item) => item.action === filler.action)) actions.push(filler)
  }
  return actions.slice(0, 3)
}

function collectQuestions(opportunities: OppDraft[], focus: FocusId[]): string[] {
  const pool: string[] = []
  if (opportunities.some((item) => /Airtime|invitation|named/i.test(item.title)) || focus.includes("participation")) {
    pool.push("What should the first round of our next meeting protect before anyone makes a full proposal?")
  }
  if (opportunities.some((item) => /person|invitation/i.test(item.title)) || focus.includes("feedback") || focus.includes("communication")) {
    pool.push("When we disagree, what wording helps us stay on the option and still take the concern seriously?")
  }
  if (opportunities.some((item) => /norm|owner|close/i.test(item.title)) || focus.includes("roles") || focus.includes("coordination")) {
    pool.push("Which sentence from our charter do we want read aloud before we open the decision?")
  }
  pool.push("What would we need to see in the last five minutes to trust that this decision has an owner?")
  pool.push("Which contribution in the last meeting changed the decision because someone else picked it up?")
  const unique: string[] = []
  for (const question of pool) {
    if (!unique.includes(question)) unique.push(question)
    if (unique.length === 3) break
  }
  return unique
}

function parseTranscript(text: string): Turn[] {
  const colonTurns = parseColonTurns(text)
  const headerTurns = parseHeaderTurns(text)
  const rawWords = wordCount(text)
  const chosen = betterParse(colonTurns, headerTurns, rawWords)
  const turns = chosen.length ? chosen : parseParagraphs(text)
  return finishTurns(turns)
}

function betterParse(colonTurns: Turn[], headerTurns: Turn[], rawWords: number): Turn[] {
  const colonWords = colonTurns.reduce((sum, turn) => sum + turn.words, 0)
  const headerWords = headerTurns.reduce((sum, turn) => sum + turn.words, 0)
  if (colonTurns.length >= 2 && colonWords >= rawWords * 0.35) return colonTurns
  if (headerTurns.length >= 2 && headerWords >= rawWords * 0.35) return headerTurns
  if (colonTurns.length >= 2) return colonTurns
  if (headerTurns.length >= 2) return headerTurns
  return []
}

function parseColonTurns(text: string): Turn[] {
  const turns: Turn[] = []
  const lineRe =
    /^(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?(?:\[([^\]]+)\]\s*|([^:\n]{1,120}?)\s*[:\-–—]\s*)(.+)$/
  for (const raw of text.split(/\n/)) {
    const line = raw.trim()
    if (!line || isTimingLine(line)) continue
    const match = line.match(lineRe)
    if (!match) {
      if (turns.length) turns[turns.length - 1].text += ` ${line}`
      continue
    }
    const speaker = cleanSpeaker(match[2] || match[3] || "")
    const body = (match[4] || "").trim()
    if (!speaker || !body || isTimingLine(speaker)) continue
    turns.push(blankTurn(speaker, body))
  }
  return turns
}

function parseHeaderTurns(text: string): Turn[] {
  const turns: Turn[] = []
  let speaker = ""
  let body: string[] = []
  const flush = () => {
    const textBody = body.join(" ").trim()
    if (speaker && textBody) turns.push(blankTurn(speaker, textBody))
    body = []
  }
  for (const raw of text.split(/\n/)) {
    const line = raw.trim()
    if (!line || isTimingLine(line)) continue
    const header = speakerHeader(line)
    if (header) {
      flush()
      speaker = header
      continue
    }
    if (!speaker) speaker = "Meeting"
    body.push(line)
  }
  flush()
  return turns
}

function parseParagraphs(text: string): Turn[] {
  const blocks = text.split(/\n\s*\n/).map((block) => block.replace(/\s+/g, " ").trim()).filter(Boolean)
  const source = blocks.length ? blocks : [text.replace(/\s+/g, " ").trim()].filter(Boolean)
  return source.map((block) => {
    const match = block.match(/^([^:\n]{1,80}?)\s*[:\-–—]\s*(.+)$/)
    if (match && !isTimingLine(match[1])) return blankTurn(cleanSpeaker(match[1]), match[2])
    return blankTurn("Meeting", block)
  })
}

function speakerHeader(line: string): string | null {
  if (line.length > 90 || isTimingLine(line)) return null
  const match = line.match(
    /^(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?(?:(\d{1,2}:\d{2}(?::\d{2})?)\s+)?([A-Za-z][\w .'-]{1,70}?)(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/,
  )
  if (!match || !(match[1] || match[2] || match[4])) return null
  const name = cleanSpeaker(match[3] || "")
  if (name.length < 2 || isTimingLine(name)) return null
  return name
}

function isTimingLine(line: string): boolean {
  return /-->/.test(line) || /^WEBVTT\b/i.test(line) || /^\d+$/.test(line.trim())
}

function blankTurn(speaker: string, text: string): Turn {
  return { speaker, text, words: wordCount(text), question: false, buildOn: false }
}

function finishTurns(turns: Turn[]): Turn[] {
  for (const turn of turns) {
    turn.words = wordCount(turn.text)
    turn.question = /\?/.test(turn.text) || /^(what|why|how|when|who|could|would|should)\b/i.test(turn.text)
    const others = turns.some((other) => other.speaker !== turn.speaker && nameIn(turn.text, other.speaker))
    turn.buildOn = BUILD.test(turn.text) || (others && /\b(point|idea|requirement|because)\b/i.test(turn.text))
  }
  return turns.filter((turn) => turn.speaker && turn.text && turn.words > 0)
}

function scoreSpeaker(name: string, turns: Turn[], assessments: string): Scored {
  const mine = turns.filter((turn) => turn.speaker === name)
  return {
    name,
    turns: mine.length,
    words: mine.reduce((sum, turn) => sum + turn.words, 0),
    wordShare: 0,
    questions: mine.filter((turn) => turn.question).length,
    buildOns: mine.filter((turn) => turn.buildOn).length,
    quotes: mine.map((turn) => turn.text),
    assessment: assessmentLine(assessments, name),
  }
}

function publicSpeaker(row: Scored): SpeakerStat {
  return {
    name: row.name,
    turns: row.turns,
    words: row.words,
    wordShare: row.wordShare,
    questions: row.questions,
    buildOns: row.buildOns,
  }
}

function findUptake(turns: Turn[]): { word: string; from: string; to: string } | null {
  const seen = new Map<string, { speaker: string; count: number }>()
  const hits: { word: string; from: string; to: string; freq: number }[] = []
  for (const turn of turns) {
    for (const word of contentWords(turn.text)) {
      const info = seen.get(word) ?? { speaker: turn.speaker, count: 0 }
      info.count += 1
      seen.set(word, info)
      if (info.speaker !== turn.speaker && info.count <= Math.ceil(turns.length * 0.45)) {
        hits.push({ word, from: info.speaker, to: turn.speaker, freq: info.count })
      }
    }
  }
  hits.sort((a, b) => a.freq - b.freq || b.word.length - a.word.length)
  const best = hits.find((hit) => turnFreq(hit.word, turns) <= Math.ceil(turns.length * 0.4))
  return best ? { word: best.word, from: best.from, to: best.to } : null
}

function findRepair(turns: Turn[], relTurns: Turn[]): string {
  if (!relTurns.length) return ""
  const index = turns.indexOf(relTurns[0])
  const previous = turns[index - 1]
  if (!previous) return ""
  const later = turns.slice(index + 1).filter((turn) => turn.speaker !== relTurns[0].speaker)
  const hits = contentWords(previous.text)
    .map((word) => ({ word, freq: turnFreq(word, turns), reused: later.some((turn) => new RegExp(`\\b${escapeReg(word)}\\b`, "i").test(turn.text)) }))
    .filter((hit) => hit.reused && hit.freq <= Math.ceil(turns.length * 0.45))
  hits.sort((a, b) => a.freq - b.freq)
  return hits[0]?.word ?? ""
}

function findNormHit(charter: string, turns: Turn[]): { speaker: string; text: string; late: boolean } | null {
  const phrases = normPhrases(participationNorm(charter))
  if (!phrases.length) return null
  for (let index = 0; index < turns.length; index += 1) {
    const hay = turns[index].text.toLowerCase()
    if (phrases.some((phrase) => hay.includes(phrase)) || /\b(we said|we agreed|our norm|the charter)\b/i.test(hay)) {
      return { speaker: turns[index].speaker, text: turns[index].text, late: index > turns.length * 0.4 }
    }
  }
  return null
}

function findCommitments(turns: Turn[]): string[] {
  const start = Math.floor(turns.length * 0.65)
  const found: string[] = []
  for (const turn of turns.slice(start)) {
    const sentence = turn.text
      .split(/(?<=[.!?])\s+/)
      .find((part) => /\b(i will|i'll|we will|we'll)\b/i.test(part) || /\bi can (draft|send|take|email|write|ask|own|do|bring|make|put|check|follow|handle|set)\b/i.test(part))
    if (sentence) found.push(`${turn.speaker}: ${sentence}`)
  }
  return found
}

function findVagueInvite(turns: Turn[], speakers: Scored[]): { speaker: string; by: string; quote: string } | null {
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index]
    for (const speaker of speakers) {
      if (speaker.name === turn.speaker) continue
      if (!nameIn(turn.text, speaker.name)) continue
      if (!/(\?|thoughts|think)/i.test(turn.text)) continue
      const reply = turns.slice(index + 1).find((later) => later.speaker === speaker.name)
      if (!reply || reply.words > 12) continue
      if (isSpecificInvite(turn.text, speaker.name)) continue
      return { speaker: speaker.name, by: turn.speaker, quote: turn.text }
    }
  }
  return null
}

function isSpecificInvite(text: string, name: string): boolean {
  if (!/\?/.test(text)) return false
  const generic = new Set("thoughts anyone something anything people really before should would could there about after where which think thank thanks guess".split(" "))
  const stripped = text.replace(new RegExp(escapeReg(name), "ig"), " ")
  const words = stripped.toLowerCase().match(/\b[a-z]{6,}\b/g) || []
  return words.some((word) => !generic.has(word))
}

function missingLabels(input: AnalysisInput, speakers: string[]): string[] {
  const blob = `${input.charter}\n${input.feedback}\n${input.assessments}`
  const labels = blob.match(/Member\s+[A-Z]\b/g) || []
  const unique = [...new Set(labels.map((label) => label.replace(/\s+/g, " ")))]
  return unique.filter((label) => !speakers.some((speaker) => speaker.toLowerCase() === label.toLowerCase()))
}

function relevantFeedback(feedback: string, top?: Scored, low?: Scored): string {
  const clean = feedback.replace(/\s+/g, " ").trim()
  if (!clean || !top || !low) return ""
  const sentence = clean.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")
  if (namesIn(sentence, [top.name, low.name]) || /turn|spoke|quiet|prompt|airtime|dominat/i.test(sentence)) return sentence
  return ""
}

function openingMatches(turns: Turn[], purpose: string): boolean {
  const slice = turns.slice(0, Math.max(2, Math.ceil(turns.length * 0.25))).map((turn) => turn.text).join(" ")
  const keys = contentWords(purpose).filter((word) => word.length >= 5)
  const hits = keys.filter((word) => new RegExp(`\\b${escapeReg(word)}`, "i").test(slice))
  return hits.length >= 2
}

function closeSentence(commitments: string[]): string {
  if (!commitments.length) return " The ending does not show a clear owner and date."
  return ` The ending names a next step: “${tidy(commitments[0], 140)}.”`
}

function participationNorm(charter: string): string {
  return fieldValue(charter, /participation|norm/i)
}

function fieldValue(charter: string, label: RegExp): string {
  const lines = charter.split(/\n/).map((line) => line.trim()).filter(Boolean)
  const hit = lines.find((line) => label.test(line.split(":")[0] || ""))
  if (!hit) return ""
  const value = hit.includes(":") ? hit.slice(hit.indexOf(":") + 1).trim() : hit
  return value
}

function assessmentLine(assessments: string, name: string): string {
  const line = assessments
    .split(/\n/)
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(name.toLowerCase()))
  if (!line) return ""
  return line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : line
}

function normPhrases(norm: string): string[] {
  const words = norm.toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).filter((word) => word.length > 2)
  const phrases: string[] = []
  for (let index = 0; index < words.length - 3; index += 1) phrases.push(words.slice(index, index + 4).join(" "))
  return phrases.slice(0, 8)
}

function contentWords(text: string): string[] {
  const stop = new Set("about after already another because before being between could every people really should something their there these think those through where which while would".split(" "))
  const words = (text.toLowerCase().match(/\b[a-z][a-z'-]{5,}\b/g) || []).map((word) => word.replace(/'s$/, ""))
  return [...new Set(words.filter((word) => !stop.has(word)))]
}

function turnFreq(word: string, turns: Turn[]): number {
  const re = new RegExp(`\\b${escapeReg(word)}\\b`, "i")
  return turns.filter((turn) => re.test(turn.text)).length
}

function uniqueNames(turns: Turn[]): string[] {
  const names: string[] = []
  for (const turn of turns) if (!names.includes(turn.speaker)) names.push(turn.speaker)
  return names
}

function nameIn(text: string, name: string): boolean {
  return new RegExp(`\\b${escapeReg(name)}\\b`, "i").test(text)
}

function namesIn(text: string, names: string[]): boolean {
  return names.every((name) => nameIn(text, name))
}

function sentenceWith(text: string, pattern: RegExp): string {
  return text.split(/(?<=[.!?])\s+/).find((part) => pattern.test(part)) || text
}

function wordCount(text: string): number {
  return (text.match(/\b[\w’']+\b/g) || []).length
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function tidy(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  const cut = clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`
  return cut.replace(/[.!?…]+$/g, "")
}

function cleanSpeaker(name: string): string {
  return name.replace(/\(\d{1,2}:\d{2}(?::\d{2})?\)/g, "").replace(/\s+/g, " ").trim()
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function sanitizeFocus(value: readonly string[]): FocusId[] {
  const allowed = new Set(FOCUS_OPTIONS.map((option) => option.id))
  const focus = value.filter((item): item is FocusId => allowed.has(item as FocusId))
  return focus.length ? focus : FOCUS_OPTIONS.map((option) => option.id)
}

function labelFor(id: FocusId): string {
  return FOCUS_OPTIONS.find((option) => option.id === id)?.label.toLowerCase() ?? id
}

function rank(area: FocusId, focus: FocusId[], severity: number): number {
  const index = focus.indexOf(area)
  return severity + (index === -1 ? 3 : index * 0.15)
}

function stripRank(item: OppDraft): Opportunity {
  return {
    title: item.title,
    observation: item.observation,
    evidence: item.evidence,
    whyItMatters: item.whyItMatters,
    confidence: item.confidence,
    limitations: item.limitations,
  }
}

function disclaimerFor(mode: ReportMode): string {
  if (mode === "openai") {
    return "This report was drafted by a language model from the text you submitted. Check every quote before you share it. It is a suggestion, not a judgment."
  }
  if (mode === "sample") {
    return "Demo report for the sample Campus App meeting. It was produced by the on-device reader from the sample transcript. A language model was not used."
  }
  return "Demo Mode. No language model was used. This reading was produced on this computer from the text you submitted."
}

function baseLimitations(input: AnalysisInput): string[] {
  const notes = [
    "One meeting is a sample, not a verdict about the people on the team.",
    "A transcript cannot show tone, side conversations, or how anyone felt. Psychological safety is not diagnosed here.",
  ]
  if (!input.charter.trim()) notes.push("No charter was provided, so agreed norms were not available to compare.")
  if (!input.assessments.trim()) notes.push("No individual assessments were provided, and none were inferred.")
  return notes
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isSpeaker(value: unknown): value is SpeakerStat {
  if (!value || typeof value !== "object") return false
  const row = value as SpeakerStat
  return isText(row.name) && typeof row.words === "number" && typeof row.turns === "number"
}

function asStrengths(value: unknown): Strength[] | null {
  if (!Array.isArray(value)) return null
  const items = value.filter((item) => item && isText(item.title) && isText(item.detail)) as Strength[]
  return items.slice(0, 4)
}

function asOpportunities(value: unknown): Opportunity[] | null {
  if (!Array.isArray(value)) return null
  const items: Opportunity[] = []
  for (const item of value) {
    if (!item || !isText(item.title) || !isText(item.observation) || !isText(item.evidence)) continue
    const confidence = String(item.confidence || "low").toLowerCase()
    items.push({
      title: item.title.trim(),
      observation: item.observation.trim(),
      evidence: item.evidence.trim(),
      whyItMatters: isText(item.whyItMatters) ? item.whyItMatters.trim() : "The pattern is worth testing in the next meeting.",
      confidence: confidence === "high" || confidence === "medium" || confidence === "low" ? (confidence as Confidence) : "low",
      limitations: isText(item.limitations) ? item.limitations.trim() : "This is one observation from the supplied text.",
    })
  }
  return items.length ? items.slice(0, 3) : null
}

function asActions(value: unknown): ActionItem[] | null {
  if (!Array.isArray(value)) return null
  const items = value.filter(
    (item) => item && isText(item.problem) && isText(item.action) && isText(item.owner) && isText(item.when) && isText(item.evaluate),
  ) as ActionItem[]
  return items.length ? items.slice(0, 3) : null
}

function asQuestions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const items = value.filter(isText).map((item) => item.trim())
  return items.length >= 3 ? items.slice(0, 3) : null
}
