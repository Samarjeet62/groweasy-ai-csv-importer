# GrowEasy AI CSV Importer

AI-powered CSV importer that accepts arbitrary valid CSV lead exports, previews them in the browser, and converts rows into GrowEasy CRM records after user confirmation.

## Features

- Next.js responsive frontend with drag-and-drop CSV upload, file picker, dark mode, loading states, and sticky responsive tables.
- CSV preview happens entirely before AI processing.
- Express backend accepts CSV uploads, parses records, processes rows in configurable batches, retries failed AI batches, and returns structured JSON.
- Supports OpenAI, Gemini, Claude, or local `mock` extraction for development and tests.
- Enforces GrowEasy CRM fields, allowed CRM statuses, allowed data sources, valid JavaScript dates, escaped line breaks, and skipped records without email or mobile.
- Unit tests for CSV parsing and extraction behavior.
- Docker setup included.

## CRM Fields

`created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`

## Local Setup

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run dev
```

Frontend: http://localhost:3000  
Backend health: http://localhost:4000/health

You can test the flow with `samples/messy-leads.csv`.

## AI Configuration

Development works with:

```env
AI_PROVIDER=mock
```

For production, configure one real provider in `backend/.env` or in your hosting dashboard:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini
```

or:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-1.5-flash
```

or:

```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your_key
CLAUDE_MODEL=claude-3-5-haiku-latest
```

## Scripts

```bash
npm run dev       # frontend and backend
npm run test      # backend unit tests
npm run build     # Next.js production build
npm run start     # backend production server
npm run check     # syntax checks
```

## API

`POST /api/import`

Multipart form field:

- `file`: CSV file

Response:

```json
{
  "headers": ["Name", "Email"],
  "totalRows": 10,
  "parsed": [],
  "skipped": [],
  "totalImported": 8,
  "totalSkipped": 2
}
```

## Deployment Notes

Recommended free hosting:

- Frontend: Vercel
- Backend: Render or Railway

Set `NEXT_PUBLIC_API_BASE_URL` in the frontend deployment to the backend URL, and set backend environment variables for `CORS_ORIGIN`, `AI_PROVIDER`, and the selected AI API key.

### Render Backend

Use the repository root as the deploy root. Render can read `render.yaml`; otherwise configure:

```bash
Build Command: npm install
Start Command: npm --workspace backend start
Health Check Path: /health
```

Environment variables:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

### Vercel Frontend

Use `frontend` as the Vercel root directory.

Environment variable:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-render-api.onrender.com
```

## Submission

Include:

- Hosted application URL
- Public GitHub repository URL
- Position applied for: Software Developer Intern or Software Developer (Full-Time)
