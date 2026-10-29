# Zokher DR Excel→PDF platform

Next.js app for Fragrance World / Zokher operators: convert DR packing Excel files into Russian Mark→Shop pivot PDFs, keep editable history, and verify results with a LangGraph + Anthropic agent.

## Quick start

```bash
cp .env.example .env
# set ANTHROPIC_API_KEY (optional for deterministic verify fallback)
npm install --legacy-peer-deps
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sample inputs live in `data/`.

## Scripts

- `npm run dev` — local app
- `npm test` — Excel pivot + PDF verification fixtures
- `npm run build` / `npm start` — production
- `docker compose up --build` — Coolify-ready `frontend` service (`expose: 3000`, healthcheck on `/api/health`, persistent `storage` volume)

## Verification gate

The agent compares Excel and generated PDF. Confidence is **100** only when deterministic checks pass. Below that, the UI shows mismatches and fix steps; full request/response history is stored per agent run.
