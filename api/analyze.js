var FOCUS_IDS = [
	{
		id: "participation",
		label: "Participation and inclusion",
		hint: "Who speaks, who is invited, and whether airtime is shared."
	},
	{
		id: "communication",
		label: "Communication and psychological safety",
		hint: "Questions, listening, disagreement, and respectful feedback."
	},
	{
		id: "roles",
		label: "Roles and responsibilities",
		hint: "Whether the charter’s roles show up in the meeting."
	},
	{
		id: "coordination",
		label: "Coordination and decision-making",
		hint: "How the group opens, decides, and leaves with owners."
	},
	{
		id: "feedback",
		label: "Constructive feedback",
		hint: "Whether challenge stays on the work and still shows care."
	}
].map((option) => option.id);
var INPUT_LIMITS = {
	teamName: 120,
	supporting: 4e4,
	bodyBytes: 2e6,
	modelSingleChars: 6e4,
	modelChunkChars: 2e4,
	modelMaxChunks: 12
};
//#endregion
//#region src/lib/input.ts
function parseAnalysisInput(value) {
	if (!value || typeof value !== "object") return null;
	const raw = value;
	if (typeof raw.teamName !== "string" || !raw.teamName.trim()) return null;
	if (typeof raw.transcript !== "string" || !raw.transcript.trim()) return null;
	const focus = Array.isArray(raw.focus) ? raw.focus.filter((item) => FOCUS_IDS.includes(item)) : [];
	return {
		teamName: raw.teamName.slice(0, INPUT_LIMITS.teamName),
		transcript: raw.transcript,
		charter: clip(raw.charter),
		feedback: clip(raw.feedback),
		assessments: clip(raw.assessments),
		focus
	};
}
function clip(value) {
	return typeof value === "string" ? value.slice(0, INPUT_LIMITS.supporting) : "";
}
//#endregion
//#region src/lib/analyze.ts
var RELATIONSHIP = /\b(you always|you never|your fault|you don't listen|you do not listen|you're being|you are being)\b/i;
var HEDGE = /\b(i might be wrong|i may be wrong|i could be wrong|i'm not sure|i am not sure)\b/i;
var TASK = /\b(i disagree|i don't agree|i do not agree|not sure|the risk|push back|another option|on the other hand)\b/i;
var BUILD = /\b(building on|build on|adding to|add to|i agree|agree with|your point|that point|['’]s point|what \w+ said|as \w+ said)\b/i;
function buildReport(input, mode) {
	const focus = sanitizeFocus(input.focus);
	const teamName = input.teamName.trim() || "Untitled team";
	const transcript = input.transcript;
	const turns = parseTranscript(transcript);
	const names = uniqueNames(turns);
	const scored = names.map((name) => scoreSpeaker(name, turns, input.assessments));
	const totalWords = turns.reduce((sum, turn) => sum + turn.words, 0) || 1;
	for (const row of scored) row.wordShare = row.words / totalWords;
	const speakers = [...scored].sort((a, b) => b.words - a.words);
	const limitations = baseLimitations(input);
	const disclaimer = disclaimerFor(mode);
	if (wordCount(transcript) < 40) return thinReport({
		teamName,
		focus,
		mode,
		disclaimer,
		speakers,
		limitations,
		turns: turns.length
	});
	const top = speakers[0];
	const low = speakers[speakers.length - 1];
	const relTurns = turns.filter((turn) => RELATIONSHIP.test(turn.text));
	const taskTurns = turns.filter((turn) => TASK.test(turn.text) && !RELATIONSHIP.test(turn.text));
	const questions = turns.filter((turn) => turn.question);
	const answered = questions.filter((turn) => {
		const index = turns.indexOf(turn);
		const next = turns[index + 1];
		return Boolean(next && next.speaker !== turn.speaker);
	});
	const uptake = findUptake(turns);
	const normHit = findNormHit(input.charter, turns);
	const commitments = findCommitments(turns);
	const vagueInvite = findVagueInvite(turns, speakers);
	const namedMissing = missingLabels(input, names);
	const feedbackNote = relevantFeedback(input.feedback, top, low);
	const participation = participationSummary({
		speakers,
		totalTurns: turns.length,
		top,
		low,
		uptake,
		vagueInvite,
		namedMissing,
		feedbackNote
	});
	const communication = communicationSummary({
		relTurns,
		taskTurns,
		questions,
		answered,
		hedgeCount: turns.filter((turn) => HEDGE.test(turn.text)).length,
		repair: findRepair(turns, relTurns)
	});
	const roles = rolesSummary({
		input,
		turns,
		normHit,
		commitments
	});
	const strengths = collectStrengths({
		uptake,
		taskTurns,
		commitments,
		answered,
		questions,
		normHit
	});
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
		namedMissing
	});
	const actions = collectActions(opportunities, {
		top,
		low,
		totalTurns: turns.length,
		norm: participationNorm(input.charter),
		hasConsent: /consent|object|full round/i.test(input.charter)
	});
	const discussionQuestions = collectQuestions(opportunities, focus);
	const studio = collectStudio({
		turns,
		relTurns,
		vagueInvite,
		normHit,
		commitments,
		input,
		top,
		low,
		opportunities,
		feedbackNote
	});
	const leadOpp = opportunities[0];
	const leadStrength = strengths[0];
	const leadAction = actions[0];
	return {
		mode,
		teamName,
		focus,
		disclaimer,
		executiveSummary: {
			strengths: leadStrength ? leadStrength.detail : "This meeting does not yet show two clear, evidence-backed strengths.",
			challenges: leadOpp ? leadOpp.observation : "No strong process problem stood out beyond the limits of a single transcript.",
			priority: leadAction ? `${leadAction.action} Give this to the ${leadAction.owner.toLowerCase()} ${leadAction.when.toLowerCase()}.` : "Use the next meeting to gather a fuller sample."
		},
		participation: {
			summary: participation,
			speakers: speakers.map(publicSpeaker)
		},
		communication: { summary: communication },
		roles: { summary: roles },
		strengths,
		opportunities: opportunities.map(stripRank),
		actions,
		discussionQuestions,
		limitations,
		path: studio.path,
		echo: studio.echo,
		replay: studio.replay,
		script: studio.script
	};
}
function factsFromReport(report) {
	return {
		speakers: report.participation.speakers,
		strengths: report.strengths.map((item) => ({
			title: item.title,
			detail: item.detail
		})),
		opportunities: report.opportunities.map((item) => ({
			title: item.title,
			observation: item.observation,
			evidence: item.evidence,
			confidence: item.confidence
		})),
		candidateActions: report.actions
	};
}
function groundModelReport(value, input, local = buildReport(input, "local")) {
	const model = coerceReport(value, input);
	if (!model) return null;
	return {
		...model,
		executiveSummary: {
			strengths: model.executiveSummary.strengths || local.executiveSummary.strengths,
			challenges: model.executiveSummary.challenges || local.executiveSummary.challenges,
			priority: model.executiveSummary.priority || local.executiveSummary.priority
		},
		participation: {
			summary: model.participation.summary || local.participation.summary,
			speakers: local.participation.speakers
		},
		communication: { summary: model.communication.summary || local.communication.summary },
		roles: { summary: model.roles.summary || local.roles.summary },
		strengths: model.strengths.length ? model.strengths : local.strengths,
		opportunities: model.opportunities.length ? model.opportunities : local.opportunities,
		actions: usableActions(model.actions) ? model.actions : local.actions,
		discussionQuestions: model.discussionQuestions.length === 3 ? model.discussionQuestions : local.discussionQuestions,
		path: local.path,
		echo: local.echo,
		replay: local.replay,
		script: local.script
	};
}
function usableActions(actions) {
	return actions.length === 3 && actions.every((item) => item.action.trim().length > 40 && item.evaluate.trim().length > 20);
}
function coerceReport(value, input) {
	if (!value || typeof value !== "object") return null;
	const unwrapped = value;
	const raw = unwrapped.report && typeof unwrapped.report === "object" ? unwrapped.report : value;
	const focus = sanitizeFocus(Array.isArray(raw.focus) ? raw.focus : input.focus);
	const exec = asExecutive(raw.executiveSummary);
	const participationSummary = asBlockText(raw.participation);
	const communicationSummary = asBlockText(raw.communication);
	const rolesSummary = asBlockText(raw.roles);
	if (!exec || !participationSummary || !communicationSummary || !rolesSummary) return null;
	const speakers = raw.participation && typeof raw.participation === "object" && Array.isArray(raw.participation.speakers) ? raw.participation.speakers.filter(isSpeaker).slice(0, 12) : [];
	return {
		mode: "openai",
		teamName: input.teamName.trim() || "Untitled team",
		focus,
		disclaimer: "This report was drafted by a language model from the text you submitted. Check the quotes against the transcript before you share it. It is a suggestion, not a judgment about any person.",
		executiveSummary: exec,
		participation: {
			summary: participationSummary,
			speakers
		},
		communication: { summary: communicationSummary },
		roles: { summary: rolesSummary },
		strengths: asStrengths(raw.strengths),
		opportunities: asOpportunities(raw.opportunities),
		actions: asActions(raw.actions),
		discussionQuestions: asQuestions(raw.discussionQuestions),
		limitations: Array.isArray(raw.limitations) ? raw.limitations.filter(isText).map((item) => item.trim()).slice(0, 6) : ["A transcript cannot show how anyone felt. Review every claim against the source text."],
		path: [],
		echo: null,
		replay: [],
		script: []
	};
}
function asExecutive(value) {
	if (!value || typeof value !== "object") return null;
	const raw = value;
	const strengths = isText(raw.strengths) ? raw.strengths.trim() : "";
	const challenges = isText(raw.challenges) ? raw.challenges.trim() : "";
	const priority = isText(raw.priority) ? raw.priority.trim() : "";
	if (!strengths && !challenges && !priority) return null;
	return {
		strengths,
		challenges,
		priority
	};
}
function asBlockText(value) {
	if (isText(value)) return value.trim();
	if (!value || typeof value !== "object") return null;
	const raw = value;
	if (isText(raw.summary)) return raw.summary.trim();
	if (isText(raw.text)) return raw.text.trim();
	return null;
}
function thinReport(args) {
	const observation = `The transcript has ${args.turns} recognizable turn${args.turns === 1 ? "" : "s"}. That is too little text to describe a team pattern.`;
	return {
		mode: args.mode,
		teamName: args.teamName,
		focus: args.focus,
		disclaimer: args.disclaimer,
		executiveSummary: {
			strengths: "There is not enough meeting text to name a team strength without guessing.",
			challenges: observation,
			priority: "Record one full working meeting, with permission, and read that transcript before changing how people work."
		},
		participation: {
			summary: `${observation} Speaking time is not contribution quality, and this sample is too small to separate the two.`,
			speakers: args.speakers.map(publicSpeaker)
		},
		communication: { summary: "Questions, disagreement, and listening cannot be judged from a fragment. A transcript also cannot establish psychological safety, which is someone’s experience, not a word count." },
		roles: { summary: "Roles, norms, and decision rules need a fuller meeting, and a charter if you have one, before they can be compared." },
		strengths: [],
		opportunities: [{
			title: "The sample is too thin",
			observation,
			evidence: "The paste has fewer than 40 words, which is too little to describe a team pattern.",
			whyItMatters: "Advice based on a fragment can send a leader after the wrong problem.",
			confidence: "low",
			limitations: "Absence of evidence in a short paste is not evidence that the team lacks a strength."
		}],
		actions: [
			{
				problem: "The current text cannot support an evidence-based reading.",
				action: "Record the next working meeting with the team’s agreement. Replace names with Member A, Member B, and so on. Paste the full arc: opening, discussion, and close.",
				owner: "Team leader",
				when: "The next scheduled meeting",
				evaluate: "The new transcript includes several speakers and both the start and the end of the decision."
			},
			{
				problem: "Norms cannot be compared until they are written down.",
				action: "Add the team charter, even as a short note: purpose, roles, decision rule, and one participation norm.",
				owner: "Facilitator",
				when: "Before the next analysis",
				evaluate: "The charter states who facilitates and how a decision is closed."
			},
			{
				problem: "Individual preferences should not be guessed.",
				action: "If you have permission, add a line per person about how they enter a conversation. Leave the field blank if you do not.",
				owner: "Team leader",
				when: "Before the next analysis",
				evaluate: "Any preference in the report is tied to a sentence the person agreed to share."
			}
		],
		discussionQuestions: [
			"What part of our next meeting would we want a facilitator to protect?",
			"How do we want disagreement to sound when it is about the work?",
			"What would a useful close include: an owner, a date, or a check for objections?"
		],
		limitations: args.limitations,
		path: args.speakers.map((speaker) => speaker.name),
		echo: null,
		replay: [],
		script: [{
			clock: "0:00",
			owner: "Team leader",
			say: "This paste is too short to rehearse a moment. Record a full working meeting, then come back.",
			why: "A replay and a 12-minute script need an opening, a disagreement, and a close."
		}]
	};
}
function participationSummary(args) {
	const { top, low, speakers, totalTurns } = args;
	if (speakers.length < 2) return "Only one speaker label was recognized. A participation comparison needs more than one voice, or speaker names at the start of each line.";
	const parts = [`${top.name} used ${pct(top.wordShare)} of the words (${top.turns} of ${totalTurns} turns). ${low.name} used ${pct(low.wordShare)} (${low.words} words).`, "Speaking time is not the same as contribution quality. Frequency, length, and whether a turn added a reason or a question are separate."];
	if (args.uptake && args.uptake.from !== top.name) parts.push(`${args.uptake.from} introduced “${args.uptake.word},” and ${args.uptake.to} picked it up. That is a substantive contribution even if it was not the longest turn.`);
	if (args.vagueInvite) parts.push(`${args.vagueInvite.by} invited ${args.vagueInvite.speaker} with a broad prompt: “${tidy(args.vagueInvite.quote, 90)}.” The following turn from ${args.vagueInvite.speaker} stayed short. The transcript does not show an interruption.`);
	const preference = args.low.assessment;
	if (preference && /specific question|read first|when asked/i.test(preference)) parts.push(`A shared preference for ${args.low.name} says: “${tidy(preference, 140)}.” That is self-report, not an observation of motive.`);
	if (args.namedMissing.length) parts.push(`${args.namedMissing.join(", ")} ${args.namedMissing.length === 1 ? "is" : "are"} named in the other materials and ${args.namedMissing.length === 1 ? "does" : "do"} not speak here. They may have been absent, or they may have been overlooked. This transcript cannot tell those apart.`);
	if (args.feedbackNote) parts.push(`Separate feedback, not this transcript: “${tidy(args.feedbackNote, 180)}.”`);
	return parts.join(" ");
}
function communicationSummary(args) {
	const bits = [`${args.questions.length} question${args.questions.length === 1 ? "" : "s"} appear, and ${args.answered.length} ${args.answered.length === 1 ? "is" : "are"} followed by someone else.`];
	if (args.taskTurns.length && !args.relTurns.length) bits.push(`${args.taskTurns[0].speaker} challenges an idea and gives a reason: “${tidy(sentenceWith(args.taskTurns[0].text, TASK), 140)}.” The words stay on the work.`);
	if (args.relTurns.length) {
		bits.push(`One disagreement aims at a person: “${tidy(sentenceWith(args.relTurns[0].text, RELATIONSHIP), 120)}.”`);
		if (args.taskTurns.length) bits.push(`Earlier, ${args.taskTurns[0].speaker} had challenged the idea itself: “${tidy(sentenceWith(args.taskTurns[0].text, TASK), 120)}.”`);
		if (args.repair) bits.push(`A later turn returns to “${args.repair}.” That is observable repair of the topic, not evidence about anyone’s feelings.`);
	} else if (args.hedgeCount) bits.push("Someone marks uncertainty out loud. That is a sign of careful speech, not proof that the room feels safe.");
	bits.push("Psychological safety is an experience. A transcript can show questions, acknowledgment, and the tone of disagreement. It cannot establish how safe anyone felt.");
	return bits.join(" ");
}
function rolesSummary(args) {
	const charter = args.input.charter.trim();
	if (!charter) return "No team charter was provided, so roles, norms, and the decision rule cannot be compared with this meeting. Commitments can still be read from the close." + closeSentence(args.commitments);
	const bits = [];
	const purpose = fieldValue(charter, /purpose/i);
	if (purpose && !openingMatches(args.turns, purpose)) bits.push("The charter asks the meeting to start from its purpose. The opening moves straight to a proposal.");
	else if (purpose) bits.push("The opening touches the purpose written in the charter.");
	if (args.normHit) bits.push(args.normHit.late ? `${args.normHit.speaker} cites a participation norm after the pattern is already underway: “${tidy(args.normHit.text, 140)}.”` : `${args.normHit.speaker} cites a participation norm early enough to shape the meeting.`);
	else if (participationNorm(charter)) bits.push(`The charter contains a participation norm (“${tidy(participationNorm(charter), 140)}”), and nobody says it in this transcript.`);
	if (/consent|nobody objects|full round/i.test(charter)) {
		const end = args.turns.slice(Math.floor(args.turns.length * .55)).map((turn) => turn.text).join(" ");
		bits.push(/object|consent|live with|we agree/i.test(end) ? "The ending includes language that resembles a consent check." : "The decision rule calls for a check that nobody still objects. The ending does not show that check.");
	}
	const roles = fieldValue(charter, /roles?/i);
	if (roles) bits.push(`The charter assigns roles this way: “${tidy(roles, 180)}.” The transcript shows who spoke, not whether each role was fulfilled.`);
	bits.push(closeSentence(args.commitments).trim());
	return bits.filter(Boolean).join(" ");
}
function collectStrengths(args) {
	const strengths = [];
	if (args.uptake) strengths.push({
		title: "Ideas moved between people",
		detail: `“${args.uptake.word}” starts with ${args.uptake.from} and is picked up by ${args.uptake.to}. The group did not only stack separate opinions.`
	});
	if (args.taskTurns.length) strengths.push({
		title: "A challenge stayed on the work",
		detail: `${args.taskTurns[0].speaker} disagreed with a reason attached: “${tidy(sentenceWith(args.taskTurns[0].text, TASK), 140)}.”`
	});
	if (args.commitments.length) strengths.push({
		title: "The close named a next step",
		detail: `The ending includes a concrete offer: “${tidy(args.commitments[0], 140)}.”`
	});
	if (args.questions.length && args.answered.length >= Math.ceil(args.questions.length * .5)) strengths.push({
		title: "Questions received a response",
		detail: `${args.answered.length} of ${args.questions.length} questions are followed by a different speaker.`
	});
	if (args.normHit) strengths.push({
		title: "Someone brought the charter into the room",
		detail: `${args.normHit.speaker} said the norm out loud: “${tidy(args.normHit.text, 140)}.”`
	});
	return strengths.slice(0, 3);
}
function collectOpportunities(args) {
	const items = [];
	const norm = participationNorm(args.input.charter);
	if (args.relTurns.length) items.push({
		id: "relationship",
		rank: rank("feedback", args.focus, 0),
		title: "Disagreement landed on a person",
		observation: `${args.relTurns[0].speaker} answered a challenge by characterizing the person, not only the option.`,
		evidence: `“${tidy(sentenceWith(args.relTurns[0].text, RELATIONSHIP), 160)}.”`,
		whyItMatters: "Direct feedback helps a team when it stays on the work. A personal frame makes the next disagreement harder to offer, even when you cannot know how it felt.",
		confidence: "medium",
		limitations: "This is one sentence in one meeting. It shows the wording. It does not show intent, history, or anyone’s private reaction."
	});
	if (args.top && args.low && args.top.name !== args.low.name && (args.top.wordShare >= .4 || args.low.wordShare <= .08)) {
		const agreed = args.feedbackNote && namesIn(args.feedbackNote, [args.top.name, args.low.name]);
		items.push({
			id: "airtime",
			rank: rank("participation", args.focus, 1),
			title: "Airtime was uneven",
			observation: `${args.top.name} used ${pct(args.top.wordShare)} of the words. ${args.low.name} used ${pct(args.low.wordShare)}.`,
			evidence: agreed ? `In this transcript, ${args.top.name} has ${args.top.turns} of ${args.totalTurns} turns and ${args.low.name} has ${args.low.words} words. Separate feedback points the same way: “${tidy(args.feedbackNote, 160)}.”` : `${args.top.name}: “${tidy(args.top.quotes[0] || "", 120)}.” ${args.low.name}: “${tidy(args.low.quotes[0] || "", 80)}.”`,
			whyItMatters: "A first proposal can set the menu before other requirements are heard. Uneven airtime is a process pattern, not a measure of who had the better idea.",
			confidence: agreed ? "medium" : "low",
			limitations: agreed ? "Two samples agree on the shape of airtime. They still cannot say whether the quieter person was thinking, unprepared, or left out." : "One meeting can be a bad day or a role that required a long update. Do not treat this share as a stable trait."
		});
	}
	if (args.vagueInvite) items.push({
		id: "invite",
		rank: rank("participation", args.focus, 2),
		title: "The invitation was too broad",
		observation: `${args.vagueInvite.speaker} was asked for a view in a general way and answered briefly.`,
		evidence: `${args.vagueInvite.by}: “${tidy(args.vagueInvite.quote, 120)}.”`,
		whyItMatters: "A specific question gives a quieter role something concrete to answer. “Any thoughts?” often produces a polite pass.",
		confidence: "medium",
		limitations: "A short reply can be agreement. The transcript shows the shape of the invitation, not the reason for the short answer."
	});
	if (norm && (!args.normHit || args.normHit.late)) items.push({
		id: "norm",
		rank: rank("roles", args.focus, 3),
		title: args.normHit ? "The norm arrived late" : "The participation norm stayed on paper",
		observation: args.normHit ? "Someone did cite the charter, after the airtime pattern was already visible." : "The charter states a participation norm that this meeting never says aloud.",
		evidence: args.normHit ? `${args.normHit.speaker}: “${tidy(args.normHit.text, 160)}.”` : `Charter: “${tidy(norm, 160)}.”`,
		whyItMatters: "A norm changes the meeting only if it is used before the first proposal, not remembered afterward.",
		confidence: "medium",
		limitations: "People can follow a norm without quoting it. Silence about the charter is not proof they ignored every part of it."
	});
	if (!args.commitments.length) items.push({
		id: "close",
		rank: rank("coordination", args.focus, 4),
		title: "The close did not name an owner",
		observation: "The last part of the transcript does not show a person taking a next step with a time attached.",
		evidence: "No turn near the end matches a clear commitment such as “I will” plus a task.",
		whyItMatters: "Without an owner and a date, a lively discussion can expire before the next meeting.",
		confidence: "low",
		limitations: "Owners may have been assigned in a document that was not pasted here."
	});
	if (args.namedMissing.length) items.push({
		id: "missing",
		rank: rank("participation", args.focus, 2),
		title: "A named person does not appear",
		observation: `${args.namedMissing.join(" and ")} ${args.namedMissing.length === 1 ? "is" : "are"} in the supporting materials and absent from the transcript.`,
		evidence: "The label appears in the charter, feedback, or assessments, and not as a speaker.",
		whyItMatters: "Inclusion starts by noticing who was expected in the room. The next step is to ask, not to assume they were shut out.",
		confidence: "low",
		limitations: "They may have been absent, or the transcript may be a partial paste."
	});
	return items.sort((a, b) => a.rank - b.rank).slice(0, 3);
}
function collectActions(opportunities, ctx) {
	const actions = [];
	for (const item of opportunities) {
		const next = actionFor(item.id, ctx);
		if (next && !actions.some((action) => action.problem === next.problem)) actions.push(next);
	}
	for (const filler of [
		{
			problem: "The team needs a repeatable way to hear a second view before a proposal hardens.",
			action: "Ask each person for one risk or one requirement before anyone argues for a vendor, tool, or plan.",
			owner: "Facilitator",
			when: "Next working meeting",
			evaluate: "At least one requirement appears before the second defense of the opening proposal."
		},
		{
			problem: "Care and directness can be practiced on purpose.",
			action: "When you challenge an idea, name what you are trying to protect, then ask what the other person would need to see. Direct words, aimed at the work.",
			owner: "Any team member offering a challenge",
			when: "The next time a recommendation is on the table",
			evaluate: "The challenge names the work product and a piece of evidence, then leaves room for a reply."
		},
		{
			problem: "The team has not yet checked whether this reading matches their experience.",
			action: "Share the discussion questions with the team, not the speaker percentages, and agree on one practice to try next time.",
			owner: "Team leader",
			when: "Within a week of this reading",
			evaluate: "The team names one practice, and the next transcript shows that practice in use."
		}
	]) {
		if (actions.length >= 3) break;
		if (!actions.some((item) => item.action === filler.action)) actions.push(filler);
	}
	return actions.slice(0, 3);
}
function actionFor(id, ctx) {
	if (id === "relationship") return {
		problem: "A disagreement was worded at a person.",
		action: "Write one line on the agenda: “Challenge the option, not the person.” If wording lands on someone, the facilitator restates it as a question about the choice, then asks what evidence would settle it.",
		owner: "Facilitator",
		when: "the next decision discussion",
		evaluate: "The next transcript has challenges that name an option or a requirement. Phrases such as “you always” or “you never” do not appear."
	};
	if (id === "airtime") return {
		problem: `${ctx.top.name} used ${pct(ctx.top.wordShare)} of the words and ${ctx.low.name} used ${pct(ctx.low.wordShare)}.`,
		action: `Open with a first round: one point each, no second turns. Ask the quieter seat a specific question (a risk, a requirement, or a missing fact). ${ctx.top.name} waits until that round is finished.`,
		owner: "Facilitator",
		when: "the start of the next working meeting",
		evaluate: `Every person present speaks once before anyone takes a third turn. Look for a reason or a question from ${ctx.low.name}, not a longer speech.`
	};
	if (id === "invite") return {
		problem: "A general prompt produced a very short reply.",
		action: `Replace “any thoughts?” with one question tied to the quieter seat. For the person in ${ctx.low.name}’s role, ask for a requirement, a risk, or a missing fact.`,
		owner: "Facilitator",
		when: "the first round of the next meeting",
		evaluate: "The invitation names a concrete topic, and the reply adds a requirement, a risk, or a question."
	};
	if (id === "norm") return {
		problem: "The participation norm was missing at the start.",
		action: `Put this sentence at the top of the agenda and read it before the first proposal: “${tidy(ctx.norm || "Each person speaks once before anyone takes a second turn.", 160)}”`,
		owner: "Facilitator",
		when: "before content in the next meeting",
		evaluate: "The norm is spoken in the first third of the meeting."
	};
	if (id === "close") return {
		problem: "The meeting did not leave a visible owner and date.",
		action: ctx.hasConsent ? "Save the last five minutes. The note-taker writes one owner and one date. The facilitator asks whether anyone still objects." : "Save the last five minutes. The note-taker writes one owner and one date before the meeting ends.",
		owner: "Note-taker",
		when: "the end of the next decision meeting",
		evaluate: "The notes name an owner and a date. If the rule is consent, they also note that objections were invited."
	};
	if (id === "missing") return {
		problem: "Someone named in the materials does not appear in the transcript.",
		action: "At the start, the facilitator checks who is missing and whether their input is required before a decision. Do not treat absence as a lack of interest.",
		owner: "Facilitator",
		when: "the opening of the next meeting",
		evaluate: "The notes say who was absent and whether the decision waited for them."
	};
	return null;
}
function collectQuestions(opportunities, focus) {
	const ids = new Set(opportunities.map((item) => item.id));
	const pool = [];
	if (ids.has("relationship")) pool.push("If a challenge lands on a person, how do we restate it as a question about the option?");
	if (ids.has("airtime") || ids.has("invite") || ids.has("missing") || focus.includes("participation")) pool.push("What should the first round of our next meeting protect before anyone makes a full proposal?");
	if (ids.has("relationship") || ids.has("invite") || focus.includes("feedback") || focus.includes("communication")) pool.push("When we disagree, what wording helps us stay on the option and still take the concern seriously?");
	if (ids.has("norm") || ids.has("close") || focus.includes("roles") || focus.includes("coordination")) pool.push("Which sentence from our charter do we want read aloud before we open the decision?");
	pool.push("What would we need to see in the last five minutes to trust that this decision has an owner?");
	pool.push("Which contribution in the last meeting changed the decision because someone else picked it up?");
	const unique = [];
	for (const question of pool) {
		if (!unique.includes(question)) unique.push(question);
		if (unique.length === 3) break;
	}
	return unique;
}
function collectStudio(args) {
	const path = args.turns.map((turn) => turn.speaker).slice(0, 40);
	const replay = collectReplay(args);
	const script = collectScript(args);
	return {
		path,
		echo: collectEcho(args),
		replay,
		script
	};
}
function collectReplay(args) {
	const moments = [];
	if (args.relTurns[0]) {
		const line = args.relTurns[0];
		const index = args.turns.indexOf(line);
		const before = index > 0 ? args.turns[index - 1] : null;
		moments.push({
			id: "relationship",
			kind: "relationship",
			title: "The disagreement landed on a person",
			whyThisMoment: "This is the turn a facilitator can still catch. Restate it as a question about the option.",
			before: before ? {
				speaker: before.speaker,
				text: tidy(before.text, 180)
			} : null,
			line: {
				speaker: line.speaker,
				text: tidy(line.text, 180)
			},
			prompt: "You are the facilitator. What do you say in the next breath, so the group stays on the work?",
			inviteName: args.low.name
		});
	}
	if (args.vagueInvite) {
		const inviteTurn = args.turns.find((turn) => turn.speaker === args.vagueInvite?.by && turn.text === args.vagueInvite.quote);
		const index = inviteTurn ? args.turns.indexOf(inviteTurn) : -1;
		const before = index > 0 ? args.turns[index - 1] : null;
		moments.push({
			id: "invite",
			kind: "invite",
			title: "The invitation was too broad",
			whyThisMoment: "A named person was asked in a general way and answered briefly. A specific question is the practice.",
			before: before ? {
				speaker: before.speaker,
				text: tidy(before.text, 180)
			} : null,
			line: {
				speaker: args.vagueInvite.by,
				text: tidy(args.vagueInvite.quote, 180)
			},
			prompt: `Rewrite the invitation so ${args.vagueInvite.speaker} has something concrete to answer.`,
			inviteName: args.vagueInvite.speaker
		});
	}
	if (args.normHit?.late) moments.push({
		id: "norm",
		kind: "norm",
		title: "The charter arrived after the pattern",
		whyThisMoment: "The participation rule was spoken, but late. Practice saying it before the first proposal.",
		before: null,
		line: {
			speaker: args.normHit.speaker,
			text: tidy(args.normHit.text, 180)
		},
		prompt: "What do you say at the opening of the next meeting so this rule shows up before anyone proposes?",
		inviteName: args.low.name
	});
	if (!args.commitments.length && args.turns.length) {
		const last = args.turns[args.turns.length - 1];
		moments.push({
			id: "close",
			kind: "close",
			title: "The close did not name an owner",
			whyThisMoment: "The last turns do not show a person taking a next step with a time attached.",
			before: args.turns.length > 1 ? {
				speaker: args.turns[args.turns.length - 2].speaker,
				text: tidy(args.turns[args.turns.length - 2].text, 180)
			} : null,
			line: {
				speaker: last.speaker,
				text: tidy(last.text, 180)
			},
			prompt: "What do you say in the last minute so the notes leave with an owner and a date?",
			inviteName: ""
		});
	}
	return moments.slice(0, 3);
}
function collectScript(args) {
	const purpose = fieldValue(args.input.charter, /purpose/i) || "the decision in front of us";
	const norm = participationNorm(args.input.charter) || "Each person speaks once before anyone takes a second turn.";
	const ids = new Set(args.opportunities.map((item) => item.id));
	const beats = [
		{
			clock: "0:00",
			owner: "Facilitator",
			say: `Restate the purpose in one sentence: “${tidy(purpose, 140)}.” Do not open with a vendor, tool, or plan.`,
			why: "The charter asked the meeting to start from purpose. A proposal first sets the menu."
		},
		{
			clock: "0:01",
			owner: "Facilitator",
			say: `Read the participation rule aloud: “${tidy(norm, 140)}.” Then stop talking.`,
			why: "A norm changes the room only if it is heard before the first long turn."
		},
		{
			clock: "0:02",
			owner: "Facilitator",
			say: `First round, one point each. Ask ${args.low.name}: “What requirement or risk is still missing?” ${args.top.name} waits until everyone has spoken once.`,
			why: "Uneven airtime often starts with the first proposal. A round delays that."
		}
	];
	if (ids.has("relationship")) beats.push({
		clock: "0:08",
		owner: "Facilitator",
		say: "If wording lands on a person, restate it: “The concern is about the option. What evidence would settle it?” Then ask for that evidence.",
		why: "Directness belongs on the work. This is the repair move, not a verdict about anyone."
	});
	else if (ids.has("close") || !ids.has("relationship")) beats.push({
		clock: "0:08",
		owner: "Note-taker",
		say: "Write one owner and one date in the shared notes while the group can still hear it.",
		why: "A lively close disappears unless it is visible before people leave."
	});
	beats.push({
		clock: "0:12",
		owner: args.input.charter.match(/consent/i) ? "Facilitator" : "Note-taker",
		say: args.input.charter.match(/consent/i) ? "Read the owner and date. Ask: “Does anyone still object?” Wait through the silence." : "Read the owner and date. Ask whether anything still needs an owner before you leave.",
		why: "The last minute is a process, not leftover time."
	});
	return beats.slice(0, 5);
}
function collectEcho(args) {
	if (!args.feedbackNote) return null;
	const airtime = args.opportunities.find((item) => item.id === "airtime");
	const invite = args.opportunities.find((item) => item.id === "invite");
	if (!airtime && !invite) return null;
	return {
		source: tidy(args.feedbackNote, 180),
		meeting: airtime ? airtime.observation : invite?.observation || "",
		reading: `This meeting echoed a pattern already visible in the team’s other feedback. Treat it as a process that is repeating, not as a one-off mood. Try the 12-minute script once, then read the next transcript.`
	};
}
function parseTranscript(text) {
	const chosen = betterParse(parseColonTurns(text), parseHeaderTurns(text), wordCount(text));
	return finishTurns(chosen.length ? chosen : parseParagraphs(text));
}
function betterParse(colonTurns, headerTurns, rawWords) {
	const colonWords = colonTurns.reduce((sum, turn) => sum + turn.words, 0);
	const headerWords = headerTurns.reduce((sum, turn) => sum + turn.words, 0);
	if (colonTurns.length >= 2 && colonWords >= rawWords * .35) return colonTurns;
	if (headerTurns.length >= 2 && headerWords >= rawWords * .35) return headerTurns;
	if (colonTurns.length >= 2) return colonTurns;
	if (headerTurns.length >= 2) return headerTurns;
	return [];
}
function parseColonTurns(text) {
	const turns = [];
	const lineRe = /^(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?(?:\[([^\]]+)\]\s*|([^:\n]{1,120}?)\s*[:\-–—]\s*)(.+)$/;
	for (const raw of text.split(/\n/)) {
		const line = raw.trim();
		if (!line || isTimingLine(line)) continue;
		const match = line.match(lineRe);
		if (!match) {
			if (turns.length) turns[turns.length - 1].text += ` ${line}`;
			continue;
		}
		const speaker = cleanSpeaker(match[2] || match[3] || "");
		const body = (match[4] || "").trim();
		if (!speaker || !body || isTimingLine(speaker)) continue;
		turns.push(blankTurn(speaker, body));
	}
	return turns;
}
function parseHeaderTurns(text) {
	const turns = [];
	let speaker = "";
	let body = [];
	const flush = () => {
		const textBody = body.join(" ").trim();
		if (speaker && textBody) turns.push(blankTurn(speaker, textBody));
		body = [];
	};
	for (const raw of text.split(/\n/)) {
		const line = raw.trim();
		if (!line || isTimingLine(line)) continue;
		const header = speakerHeader(line);
		if (header) {
			flush();
			speaker = header;
			continue;
		}
		if (!speaker) speaker = "Meeting";
		body.push(line);
	}
	flush();
	return turns;
}
function parseParagraphs(text) {
	const blocks = text.split(/\n\s*\n/).map((block) => block.replace(/\s+/g, " ").trim()).filter(Boolean);
	return (blocks.length ? blocks : [text.replace(/\s+/g, " ").trim()].filter(Boolean)).map((block) => {
		const match = block.match(/^([^:\n]{1,80}?)\s*[:\-–—]\s*(.+)$/);
		if (match && !isTimingLine(match[1])) return blankTurn(cleanSpeaker(match[1]), match[2]);
		return blankTurn("Meeting", block);
	});
}
function speakerHeader(line) {
	if (line.length > 90 || isTimingLine(line)) return null;
	const match = line.match(/^(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?(?:(\d{1,2}:\d{2}(?::\d{2})?)\s+)?([A-Za-z][\w .'-]{1,70}?)(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/);
	if (!match || !(match[1] || match[2] || match[4])) return null;
	const name = cleanSpeaker(match[3] || "");
	if (name.length < 2 || isTimingLine(name)) return null;
	return name;
}
function isTimingLine(line) {
	return /-->/.test(line) || /^WEBVTT\b/i.test(line) || /^\d+$/.test(line.trim());
}
function blankTurn(speaker, text) {
	return {
		speaker,
		text,
		words: wordCount(text),
		question: false,
		buildOn: false
	};
}
function finishTurns(turns) {
	for (const turn of turns) {
		turn.words = wordCount(turn.text);
		turn.question = /\?/.test(turn.text) || /^(what|why|how|when|who|could|would|should)\b/i.test(turn.text);
		const others = turns.some((other) => other.speaker !== turn.speaker && nameIn(turn.text, other.speaker));
		turn.buildOn = BUILD.test(turn.text) || others && /\b(point|idea|requirement|because)\b/i.test(turn.text);
	}
	return turns.filter((turn) => turn.speaker && turn.text && turn.words > 0);
}
function scoreSpeaker(name, turns, assessments) {
	const mine = turns.filter((turn) => turn.speaker === name);
	return {
		name,
		turns: mine.length,
		words: mine.reduce((sum, turn) => sum + turn.words, 0),
		wordShare: 0,
		questions: mine.filter((turn) => turn.question).length,
		buildOns: mine.filter((turn) => turn.buildOn).length,
		quotes: mine.map((turn) => turn.text),
		assessment: assessmentLine(assessments, name)
	};
}
function publicSpeaker(row) {
	return {
		name: row.name,
		turns: row.turns,
		words: row.words,
		wordShare: row.wordShare,
		questions: row.questions,
		buildOns: row.buildOns
	};
}
function findUptake(turns) {
	const seen = /* @__PURE__ */ new Map();
	const hits = [];
	for (const turn of turns) for (const word of contentWords(turn.text)) {
		const info = seen.get(word) ?? {
			speaker: turn.speaker,
			count: 0
		};
		info.count += 1;
		seen.set(word, info);
		if (info.speaker !== turn.speaker && info.count <= Math.ceil(turns.length * .45)) hits.push({
			word,
			from: info.speaker,
			to: turn.speaker,
			freq: info.count
		});
	}
	hits.sort((a, b) => a.freq - b.freq || b.word.length - a.word.length);
	const best = hits.find((hit) => turnFreq(hit.word, turns) <= Math.ceil(turns.length * .4));
	return best ? {
		word: best.word,
		from: best.from,
		to: best.to
	} : null;
}
function findRepair(turns, relTurns) {
	if (!relTurns.length) return "";
	const index = turns.indexOf(relTurns[0]);
	const previous = turns[index - 1];
	if (!previous) return "";
	const later = turns.slice(index + 1).filter((turn) => turn.speaker !== relTurns[0].speaker);
	const hits = contentWords(previous.text).map((word) => ({
		word,
		freq: turnFreq(word, turns),
		reused: later.some((turn) => new RegExp(`\\b${escapeReg(word)}\\b`, "i").test(turn.text))
	})).filter((hit) => hit.reused && hit.freq <= Math.ceil(turns.length * .45));
	hits.sort((a, b) => a.freq - b.freq);
	return hits[0]?.word ?? "";
}
function findNormHit(charter, turns) {
	const phrases = normPhrases(participationNorm(charter));
	if (!phrases.length) return null;
	for (let index = 0; index < turns.length; index += 1) {
		const hay = turns[index].text.toLowerCase();
		if (phrases.some((phrase) => hay.includes(phrase)) || /\b(we said|we agreed|our norm|the charter)\b/i.test(hay)) return {
			speaker: turns[index].speaker,
			text: turns[index].text,
			late: index > turns.length * .4
		};
	}
	return null;
}
function findCommitments(turns) {
	const start = Math.floor(turns.length * .65);
	const found = [];
	for (const turn of turns.slice(start)) {
		const sentence = turn.text.split(/(?<=[.!?])\s+/).find((part) => /\b(i will|i'll|we will|we'll)\b/i.test(part) || /\bi can (draft|send|take|email|write|ask|own|do|bring|make|put|check|follow|handle|set)\b/i.test(part));
		if (sentence) found.push(`${turn.speaker}: ${sentence}`);
	}
	return found;
}
function findVagueInvite(turns, speakers) {
	for (let index = 0; index < turns.length; index += 1) {
		const turn = turns[index];
		for (const speaker of speakers) {
			if (speaker.name === turn.speaker) continue;
			if (!nameIn(turn.text, speaker.name)) continue;
			if (!/(\?|thoughts|think)/i.test(turn.text)) continue;
			const reply = turns.slice(index + 1).find((later) => later.speaker === speaker.name);
			if (!reply || reply.words > 12) continue;
			if (isSpecificInvite(turn.text, speaker.name)) continue;
			return {
				speaker: speaker.name,
				by: turn.speaker,
				quote: turn.text
			};
		}
	}
	return null;
}
function isSpecificInvite(text, name) {
	if (!/\?/.test(text)) return false;
	const generic = new Set("thoughts anyone something anything people really before should would could there about after where which think thank thanks guess".split(" "));
	return (text.replace(new RegExp(escapeReg(name), "ig"), " ").toLowerCase().match(/\b[a-z]{6,}\b/g) || []).some((word) => !generic.has(word));
}
function missingLabels(input, speakers) {
	const labels = `${input.charter}\n${input.feedback}\n${input.assessments}`.match(/Member\s+[A-Z]\b/g) || [];
	return [...new Set(labels.map((label) => label.replace(/\s+/g, " ")))].filter((label) => !speakers.some((speaker) => speaker.toLowerCase() === label.toLowerCase()));
}
function relevantFeedback(feedback, top, low) {
	const clean = feedback.replace(/\s+/g, " ").trim();
	if (!clean || !top || !low) return "";
	const sentence = clean.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
	if (namesIn(sentence, [top.name, low.name]) || /turn|spoke|quiet|prompt|airtime|dominat/i.test(sentence)) return sentence;
	return "";
}
function openingMatches(turns, purpose) {
	const slice = turns.slice(0, Math.max(2, Math.ceil(turns.length * .25))).map((turn) => turn.text).join(" ");
	return contentWords(purpose).filter((word) => word.length >= 5).filter((word) => new RegExp(`\\b${escapeReg(word)}`, "i").test(slice)).length >= 2;
}
function closeSentence(commitments) {
	if (!commitments.length) return " The ending does not show a clear owner and date.";
	return ` The ending names a next step: “${tidy(commitments[0], 140)}.”`;
}
function participationNorm(charter) {
	return fieldValue(charter, /participation|norm/i);
}
function fieldValue(charter, label) {
	const hit = charter.split(/\n/).map((line) => line.trim()).filter(Boolean).find((line) => label.test(line.split(":")[0] || ""));
	if (!hit) return "";
	return hit.includes(":") ? hit.slice(hit.indexOf(":") + 1).trim() : hit;
}
function assessmentLine(assessments, name) {
	const line = assessments.split(/\n/).map((item) => item.trim()).find((item) => item.toLowerCase().startsWith(name.toLowerCase()));
	if (!line) return "";
	return line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : line;
}
function normPhrases(norm) {
	const words = norm.toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).filter((word) => word.length > 2);
	const phrases = [];
	for (let index = 0; index < words.length - 3; index += 1) phrases.push(words.slice(index, index + 4).join(" "));
	return phrases.slice(0, 8);
}
function contentWords(text) {
	const stop = new Set("about after already another because before being between could every people really should something their there these think those through where which while would".split(" "));
	const words = (text.toLowerCase().match(/\b[a-z][a-z'-]{5,}\b/g) || []).map((word) => word.replace(/'s$/, ""));
	return [...new Set(words.filter((word) => !stop.has(word)))];
}
function turnFreq(word, turns) {
	const re = new RegExp(`\\b${escapeReg(word)}\\b`, "i");
	return turns.filter((turn) => re.test(turn.text)).length;
}
function uniqueNames(turns) {
	const names = [];
	for (const turn of turns) if (!names.includes(turn.speaker)) names.push(turn.speaker);
	return names;
}
function nameIn(text, name) {
	return new RegExp(`\\b${escapeReg(name)}\\b`, "i").test(text);
}
function namesIn(text, names) {
	return names.every((name) => nameIn(text, name));
}
function sentenceWith(text, pattern) {
	return text.split(/(?<=[.!?])\s+/).find((part) => pattern.test(part)) || text;
}
function wordCount(text) {
	return (text.match(/\b[\w’']+\b/g) || []).length;
}
function pct(value) {
	return `${Math.round(value * 100)}%`;
}
function tidy(text, max) {
	const clean = text.replace(/\s+/g, " ").trim();
	return (clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`).replace(/[.!?…]+$/g, "");
}
function cleanSpeaker(name) {
	return name.replace(/\(\d{1,2}:\d{2}(?::\d{2})?\)/g, "").replace(/\s+/g, " ").trim();
}
function escapeReg(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function sanitizeFocus(value) {
	const allowed = new Set(FOCUS_IDS);
	const focus = value.filter((item) => allowed.has(item));
	return focus.length ? focus : [...FOCUS_IDS];
}
function rank(area, focus, severity) {
	const index = focus.indexOf(area);
	return severity + (index === -1 ? 3 : index * .15);
}
function stripRank(item) {
	return {
		title: item.title,
		observation: item.observation,
		evidence: item.evidence,
		whyItMatters: item.whyItMatters,
		confidence: item.confidence,
		limitations: item.limitations
	};
}
function disclaimerFor(mode) {
	if (mode === "openai") return "This report was drafted by a language model from the text you submitted. Check every quote before you share it. It is a suggestion, not a judgment.";
	if (mode === "sample") return "Demo report for the sample Campus App meeting. It was produced by the on-device reader from the sample transcript. A language model was not used.";
	return "Demo Mode. No language model was used. This reading was produced on this computer from the text you submitted.";
}
function baseLimitations(input) {
	const notes = ["One meeting is a sample, not a verdict about the people on the team.", "A transcript cannot show tone, side conversations, or how anyone felt. Psychological safety is not diagnosed here."];
	if (!input.charter.trim()) notes.push("No charter was provided, so agreed norms were not available to compare.");
	if (!input.assessments.trim()) notes.push("No individual assessments were provided, and none were inferred.");
	return notes;
}
function isText(value) {
	return typeof value === "string" && value.trim().length > 0;
}
function isSpeaker(value) {
	if (!value || typeof value !== "object") return false;
	const row = value;
	return isText(row.name) && typeof row.words === "number" && typeof row.turns === "number";
}
function asStrengths(value) {
	if (!Array.isArray(value)) return [];
	return value.filter((item) => item && isText(item.title) && isText(item.detail)).slice(0, 4);
}
function asOpportunities(value) {
	if (!Array.isArray(value)) return [];
	const items = [];
	for (const item of value) {
		if (!item || !isText(item.title) || !isText(item.observation) || !isText(item.evidence)) continue;
		const confidence = String(item.confidence || "low").toLowerCase();
		items.push({
			title: item.title.trim(),
			observation: item.observation.trim(),
			evidence: item.evidence.trim(),
			whyItMatters: isText(item.whyItMatters) ? item.whyItMatters.trim() : "The pattern is worth testing in the next meeting.",
			confidence: confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : "low",
			limitations: isText(item.limitations) ? item.limitations.trim() : "This is one observation from the supplied text."
		});
	}
	return items.slice(0, 3);
}
function asActions(value) {
	if (!Array.isArray(value)) return [];
	return value.filter((item) => item && isText(item.problem) && isText(item.action) && isText(item.owner) && isText(item.when) && isText(item.evaluate)).slice(0, 3);
}
function asQuestions(value) {
	if (!Array.isArray(value)) return [];
	return value.filter(isText).map((item) => item.trim()).slice(0, 3);
}
//#endregion
//#region server/runAnalysis.ts
async function runAnalysis(input, env) {
	const key = readKey(env);
	const model = (env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
	const local = buildReport(input, "local");
	if (!key) return {
		status: 200,
		body: {
			report: local,
			notice: local.disclaimer
		}
	};
	try {
		const report = groundModelReport(await requestModel(input, local, key, model), input, local);
		if (!report) return {
			status: 200,
			body: {
				report: local,
				notice: "The model response could not be used, so Demo Mode produced this reading instead. A language-model report is not shown."
			}
		};
		return {
			status: 200,
			body: {
				report,
				notice: report.disclaimer
			}
		};
	} catch (error) {
		return {
			status: 200,
			body: {
				report: local,
				notice: `${error instanceof Error ? error.message : "The model request failed."} Demo Mode produced this reading instead.`
			}
		};
	}
}
function readKey(env) {
	return (env.OPENAI_API_KEY || "").trim();
}
var ModelLengthError = class extends Error {};
async function requestModel(input, local, key, model) {
	if (input.transcript.length <= INPUT_LIMITS.modelSingleChars) try {
		return await completeModel(promptFor(input, local), key, model);
	} catch (error) {
		if (!(error instanceof ModelLengthError) || input.transcript.length <= INPUT_LIMITS.modelChunkChars) throw error;
	}
	const chunks = splitTranscript(input.transcript, INPUT_LIMITS.modelChunkChars);
	const limited = chunks.slice(0, INPUT_LIMITS.modelMaxChunks);
	const omitted = chunks.length > limited.length;
	const notes = [];
	for (let index = 0; index < limited.length; index += 1) {
		const partial = await completeModel(partialPrompt(limited[index], index + 1, limited.length), key, model);
		notes.push(JSON.stringify(partial).slice(0, 4e3));
	}
	return completeModel(synthesisPrompt(input, local, notes, omitted), key, model);
}
async function completeModel(content, key, model) {
	let response;
	try {
		response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			signal: AbortSignal.timeout(9e4),
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model,
				temperature: .2,
				response_format: { type: "json_object" },
				messages: [{
					role: "system",
					content: "You help a university team leader reflect on observable team process. Return only JSON. Use only the supplied materials and measured facts. Do not invent quotes or speaker counts. If evidence is thin, say so. Do not claim to know how anyone felt, and do not diagnose psychological safety. Speaking time is not contribution quality. Recommendations name a role, not a personal failing. Direct challenge belongs on the work, with care for the person. The priority field names one next practice, not a list of every requested focus."
				}, {
					role: "user",
					content
				}]
			})
		});
	} catch {
		throw new Error("The model request did not finish. Your transcript is still in the form.");
	}
	const raw = await response.text();
	if (!response.ok) {
		if (modelRejectedForLength(response.status, raw)) throw new ModelLengthError("This transcript is too long for the model. It is still in the form. Paste a shorter excerpt.");
		throw new Error(`The model request failed (${response.status}). Your transcript is still in the form.`);
	}
	let payload;
	try {
		payload = JSON.parse(raw);
	} catch {
		throw new Error("The model service returned a page instead of a result. Your transcript is still in the form.");
	}
	const text = payload.choices?.[0]?.message?.content?.trim();
	if (!text) throw new Error("The model returned an empty response. Your transcript is still in the form.");
	const json = text.replace(/^```json\s*/i, "").replace(/```$/i, "");
	try {
		return JSON.parse(json);
	} catch {
		throw new Error("The model response was not valid JSON. Your transcript is still in the form.");
	}
}
function modelRejectedForLength(status, raw) {
	try {
		const body = JSON.parse(raw);
		const code = `${body.error?.code || ""} ${body.error?.type || ""} ${body.error?.message || ""}`;
		return /context_length|string_above_max|maximum context length/i.test(code);
	} catch {
		return status === 413;
	}
}
function splitTranscript(text, size) {
	if (text.length <= size) return [text];
	const parts = [];
	let rest = text;
	while (rest.length > size) {
		let cut = rest.lastIndexOf("\n\n", size);
		if (cut < size * .5) cut = rest.lastIndexOf("\n", size);
		if (cut < size * .5) cut = size;
		parts.push(rest.slice(0, cut));
		rest = rest.slice(cut).trimStart();
	}
	if (rest) parts.push(rest);
	return parts;
}
function partialPrompt(chunk, index, total) {
	return `Read transcript part ${index} of ${total}. Return JSON {"summary":"what this part shows about participation, disagreement, and decisions","evidence":["up to 5 short quotes"]}. Do not copy the whole transcript.

TRANSCRIPT PART:
${chunk}`;
}
function synthesisPrompt(input, local, notes, omitted) {
	return `${promptFor({
		...input,
		transcript: "(see part notes below; do not expect the raw transcript)"
	}, local)}

PART NOTES:
${notes.join("\n\n")}
${omitted ? "\nThe transcript continued beyond these parts. Say that the model reading covers the first 240,000 characters only." : ""}`;
}
function promptFor(input, local) {
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
${input.transcript}`;
}
//#endregion
//#region server/entries/analyze.ts
var maxDuration = 60;
async function handler(req, res) {
	res.setHeader("Content-Type", "application/json");
	if (req.method !== "POST") {
		res.status(405).json({ error: "Use POST for analysis." });
		return;
	}
	let parsed;
	try {
		parsed = decodeBody(req.body);
	} catch {
		res.status(400).json({ error: "The analysis request was not valid JSON." });
		return;
	}
	if (payloadBytes(parsed) > INPUT_LIMITS.bodyBytes) {
		res.status(413).json({ error: "That transcript is larger than 2 MB. It is still in the form. Paste a shorter excerpt, or remove attachments that were copied in with the text." });
		return;
	}
	const input = parseAnalysisInput(parsed);
	if (!input) {
		res.status(400).json({ error: "Add a team name and a meeting transcript." });
		return;
	}
	try {
		const result = await runAnalysis(input, process.env);
		res.status(result.status).json(result.body);
	} catch {
		res.status(500).json({ error: "The analysis service hit an unexpected error." });
	}
}
function decodeBody(body) {
	if (typeof body === "string") return JSON.parse(body);
	if (body instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(body));
	return body;
}
function payloadBytes(value) {
	try {
		return new TextEncoder().encode(JSON.stringify(value)).length;
	} catch {
		return INPUT_LIMITS.bodyBytes + 1;
	}
}
//#endregion
export { handler as default, maxDuration };
