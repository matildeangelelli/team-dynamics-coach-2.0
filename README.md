# Team Dynamics Coach

A prototype for reading team process from a meeting transcript, a charter, feedback, and optional assessments.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints, usually http://localhost:5173.

## Demo Mode

If `OPENAI_API_KEY` is empty, analysis stays on your computer. The sample report is produced the same way from the included Campus App transcript. No language model is used.

## Optional model

Copy `.env.example` to `.env` and set `OPENAI_API_KEY`. Restart `npm run dev`. The key is read only by the local server. Do not prefix it with `VITE_`, and do not commit the filled-in file.

Optional override: `OPENAI_MODEL=gpt-4o-mini`.

Anonymize names before submitting text when a model key is set. Transcripts are not saved in a database.

# team-dynamics-coach-2.0
