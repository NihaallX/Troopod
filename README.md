# Ad → Landing Page Personalizer
### Troopod AI PM Assignment

---

## Deploy to Vercel (5 minutes)

### 1. Get a Groq API key
Go to https://console.groq.com/keys → Create API Key

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_USERNAME/troopod-assignment.git
git push -u origin main
```

### 3. Deploy on Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. In **Environment Variables**, add:
   - Key: `GROQ_API_KEY`
   - Value: `gsk_...` (your key from step 1)
4. Click **Deploy**

Done — your live link is ready to submit.

---

## Run locally

```bash
npm install
cp .env.example .env.local
# add your API key to .env.local
npm run dev
```

Open http://localhost:3000

---

## How it works

**3-agent pipeline:**

1. **Ad Creative Analyzer** — Accepts image upload (base64 vision) or image URL. Sends to Groq and extracts structured JSON: headline, CTA, value prop, tone, audience, color scheme.

2. **Landing Page Analyzer** — Fetches the target URL server-side (no CORS issues), parses DOM to extract title, headings, and body text. Falls back to URL-context inference if the page blocks fetching.

3. **Personalization Engine** — Takes ad analysis + page content, generates a complete HTML landing page with perfect message-match. Mirrors the ad's exact headline, CTA, tone and color scheme.

**Key design decisions:**
- API key is server-side only (Next.js API route) — never exposed to the browser
- Landing page fetch is server-side too — no CORS problems
- Fallback handling at every step so the pipeline never hard-fails
- Output is self-contained HTML — no external dependencies, fully portable
