[
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
//#endregion
//#region server/runAnalysis.ts
function modelConfigured(env) {
	return Boolean(readKey(env));
}
function readKey(env) {
	return (env.OPENAI_API_KEY || "").trim();
}
//#endregion
//#region server/entries/status.ts
function handler(req, res) {
	res.setHeader("Content-Type", "application/json");
	if (req.method !== "GET") {
		res.status(405).json({ error: "Use GET for status." });
		return;
	}
	res.status(200).json({ aiConfigured: modelConfigured(process.env) });
}
//#endregion
export { handler as default };
