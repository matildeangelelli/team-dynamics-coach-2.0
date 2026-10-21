import type { AnalysisInput } from "./types.ts"

export const SAMPLE_TRANSCRIPT = `[00:00] Member A: Before we restate the decision, I already compared three vendors and I think we should go with Northline. They are cheaper, they replied fastest, and I can send the contract tonight. If we wait we will lose a week, so I want us to decide now and I will take the owner role.

[00:42] Member D: I am not sure Northline is the right call. Their portfolio looks thin on accessibility, and the brief says that is a requirement. The risk is we save money and then redo the work.

[01:05] Member A: You always shoot ideas down before we can move. We do not have time for another review cycle.

[01:18] Member C: I might be wrong, but Member D's point about accessibility is the requirement we wrote down. What if we ask Northline one question about it before we sign?

[01:40] Member A: Member B, any thoughts? We need to wrap.

[01:48] Member B: I guess Northline is fine.

[02:00] Member C: We said each person speaks once before anyone takes a second turn. Member D, what would you need to see from Northline?

[02:16] Member D: A short note on how they test with a screen reader. If they can send that by Thursday, I can live with the choice.

[02:32] Member A: Okay. I will email them tonight and ask for that note by Thursday. We decide Friday if the note is real.

[02:48] Member C: I can draft the question so it matches the brief.`

export function sampleInput(): AnalysisInput {
  return {
    teamName: "Campus App Team",
    transcript: SAMPLE_TRANSCRIPT,
    charter: `Purpose: Choose a vendor for the student organization website by Friday.
Decision rule: Consent. Proceed only if nobody objects after a full round.
Participation norm: Each person speaks once before anyone takes a second turn. Invite quiet members by name. Challenge ideas, not people.
Roles: Member A facilitates. Member B researches requirements. Member C watches the experience. Member D tests the decision against the brief.
Opening and closing: Start by restating the decision. End with an owner and a date.`,
    feedback: `Breakout Learning, case discussion: Member A took 8 of 18 turns and opened with a full proposal. Member B spoke once, after a prompt, near the end. Member C asked questions that brought other people in. Member D challenged the recommendation with evidence from the case. Invitations came late.`,
    assessments: `Member A: Thinks out loud and moves fast. Energy goes up when the group stalls.
Member B: Prefers to read first. Speaks when asked a specific question, not a general one.
Member C: Builds on other people's ideas. Tends to avoid open conflict.
Member D: Direct and task-focused. Comfortable disagreeing about the work.
Shared with permission. Labels are anonymous.`,
    focus: ["participation", "communication", "roles", "coordination", "feedback"],
  }
}
