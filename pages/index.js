import { useState, useRef } from "react";
import Head from "next/head";

const STEPS = [
  { id: "ad",  label: "Ad Creative Analyzer",  desc: "Extracts headline, CTA, tone, audience & visual style" },
  { id: "page", label: "Landing Page Parser",  desc: "Fetching real page and extracting current elements" },
  { id: "gen", label: "Personalization Engine", desc: "Modifying page elements for message-match" },
];

const s = {
  wrap: { maxWidth: 760, margin: "0 auto", padding: "2.5rem 1.25rem" },
  header: { marginBottom: "2.25rem" },
  h1: { fontSize: 24, fontWeight: 600, marginBottom: 6, color: "#f0f0f2" },
  sub: { fontSize: 14, color: "#8a8a96" },
  card: { background: "#141417", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: 12 },
  label: { fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", color: "#50505a", marginBottom: 10 },
  tabs: { display: "flex", gap: 8, marginBottom: 12 },
  input: { width: "100%", fontSize: 13, padding: "8px 11px", borderRadius: 6, border: "0.5px solid rgba(255,255,255,0.14)", background: "#1c1c20", color: "#f0f0f2", outline: "none" },
  dropzone: { border: "0.5px dashed rgba(255,255,255,0.18)", borderRadius: 6, padding: "18px 16px", textAlign: "center", cursor: "pointer", fontSize: 13, color: "#8a8a96", transition: "border-color 0.15s" },
  genBtn: { width: "100%", padding: "11px", borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.14)", background: "#1c1c20", color: "#f0f0f2", fontSize: 14, fontWeight: 500, cursor: "pointer", marginBottom: "1.5rem", transition: "opacity 0.15s" },
  stepsBox: { border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: ".75rem 1.25rem", marginBottom: "1.5rem" },
  stepRow: { display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0" },
  stepIcon: { fontSize: 12, minWidth: 18, marginTop: 2, fontFamily: "monospace" },
  stepName: { fontSize: 13, fontWeight: 500 },
  stepDetail: { fontSize: 12, color: "#8a8a96", marginTop: 2 },
  outHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  outTitle: { fontSize: 13, fontWeight: 500 },
  outBtns: { display: "flex", gap: 8 },
  smallBtn: { fontSize: 12, padding: "5px 11px", cursor: "pointer", borderRadius: 6, border: "0.5px solid rgba(255,255,255,0.14)", background: "transparent", color: "#f0f0f2" },
  iframeWrap: { border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" },
  badge: { marginTop: 10, background: "#1c1c20", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#8a8a96" },
};

const STATUS_ICON  = { pending: "○", running: "◎", done: "●", error: "✕" };
const STATUS_COLOR = { pending: "#50505a", running: "#60a5fa", done: "#22c55e", error: "#f87171" };

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeForPreview(html, sourceUrl = "") {
  let out = String(html || "");
  // Prevent embedded app runtime scripts from executing in preview iframes.
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Remove CSP/meta policies from the source page that are noisy in srcdoc context.
  out = out.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "");
  // Drop preload/manifest links that commonly emit unused-resource and 404 errors in previews.
  out = out.replace(/<link[^>]+rel=["'](?:preload|modulepreload|manifest)["'][^>]*>/gi, "");

  // Ensure relative URLs inside srcdoc resolve to the real source site, not localhost.
  if (sourceUrl) {
    try {
      const baseHref = new URL(sourceUrl).href;
      const baseTag = `<base href="${baseHref}">`;

      out = out.replace(/<base[^>]*>/gi, "");
      if (/<head[^>]*>/i.test(out)) {
        out = out.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
      } else if (/<html[^>]*>/i.test(out)) {
        out = out.replace(/<html[^>]*>/i, (m) => `${m}<head>${baseTag}</head>`);
      } else {
        out = `<head>${baseTag}</head>${out}`;
      }
    } catch {
      // Ignore invalid URLs and keep best-effort sanitized preview.
    }
  }

  return out;
}

export default function Home() {
  const [adMode, setAdMode]       = useState("upload");
  const [adFile, setAdFile]       = useState(null);
  const [adUrl, setAdUrl]         = useState("");
  const [pageUrl, setPageUrl]     = useState("");
  const [running, setRunning]     = useState(false);
  const [stepSt, setStepSt]       = useState({});
  const [stepDt, setStepDt]       = useState({});
  const [pageHtml, setPageHtml]   = useState("");
  const [outputHtml, setOutputHtml] = useState("");
  const [analysis, setAnalysis]   = useState(null);
  const [pageChanges, setPageChanges] = useState(null);
  const [pageDesignSystem, setPageDesignSystem] = useState(null);
  const [isSPAMode, setIsSPAMode] = useState(false);
  const fileRef = useRef();

  const setStep = (id, status, detail) => {
    setStepSt(p => ({ ...p, [id]: status }));
    if (detail !== undefined) setStepDt(p => ({ ...p, [id]: detail }));
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAdFile({ data: ev.target.result, name: file.name, type: file.type || "image/jpeg" });
    reader.readAsDataURL(file);
  };

  const callModel = async (system, userContent, options = {}) => {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model || "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: options.maxTokens || 1000,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  };

  const canRun = !running && pageUrl.trim() && (adMode === "url" ? adUrl.trim() : adFile);

  const run = async () => {
    setRunning(true);
    setPageHtml("");
    setOutputHtml("");
    setAnalysis(null);
    setPageChanges(null);
    setPageDesignSystem(null);
    setIsSPAMode(false);
    setStepSt({}); setStepDt({});

    try {
      // Step 1 — Analyze ad
      setStep("ad", "running", "Analyzing ad creative...");
      let adContent;
      if (adMode === "upload" && adFile) {
        adContent = [
          { type: "image", source: { type: "base64", media_type: adFile.type, data: adFile.data.split(",")[1] } },
          {
            type: "text",
            text: `Analyze this ad.
Return ONLY a JSON object with exactly these keys:
headline (string),
subheadline (string),
cta (string),
value_proposition (string),
target_audience (string),
tone (string),
language_mix (string — e.g. "English", "Hinglish", "Hindi"),
dominant_colors (array of exactly 2 hex color strings),
key_benefits (array of exactly 3 strings),
has_app_badges (boolean — true if ad contains App Store or Google Play badges),
has_disclaimer (boolean — true if ad contains a legal or risk disclaimer),
urgency (string — any urgency or scarcity element, empty string if none)

For dominant_colors: do not guess. Extract the most visually dominant 
hex color from the ad. For Groww-style fintech ads, look for the 
teal/mint green — it will be around #00d09c, not #008000.

For has_app_badges: set to true if the ad image contains any of these: 
"App Store", "Google Play", "GET IT ON", "Download on" — even partially visible.

No markdown, no explanation, only the JSON object.`,
          },
        ];
      } else {
        adContent = `Analyze the ad at URL: ${adUrl}.
Return ONLY a JSON object with exactly these keys:
headline (string),
subheadline (string),
cta (string),
value_proposition (string),
target_audience (string),
tone (string),
language_mix (string — e.g. "English", "Hinglish", "Hindi"),
dominant_colors (array of exactly 2 hex color strings),
key_benefits (array of exactly 3 strings),
has_app_badges (boolean — true if ad contains App Store or Google Play badges),
has_disclaimer (boolean — true if ad contains a legal or risk disclaimer),
urgency (string — any urgency or scarcity element, empty string if none)

For dominant_colors: do not guess. Extract the most visually dominant 
hex color from the ad. For Groww-style fintech ads, look for the 
teal/mint green — it will be around #00d09c, not #008000.

For has_app_badges: set to true if the ad image contains any of these: 
"App Store", "Google Play", "GET IT ON", "Download on" — even partially visible.

No markdown, no explanation, only the JSON object.`;
      }

      const adRaw = await callModel(
        "Expert ad creative analyst. Return only valid JSON without markdown fences.",
        adContent
      );
      let parsed;
      try { parsed = JSON.parse(adRaw.replace(/```[a-z]*/g,"").replace(/```/g,"").trim()); }
      catch { parsed = { headline: "Your Brand", cta: "Get Started", value_proposition: adRaw.slice(0, 120), target_audience: "General", tone: "professional", key_benefits: ["Benefit 1","Benefit 2","Benefit 3"], dominant_colors: "#6366f1, #fff", urgency: "" }; }
      const safeAnalysis = {
        headline:          parsed.headline        || "Get Started Today",
        subheadline:       parsed.subheadline     || "",
        cta:               parsed.cta             || "Sign Up Free",
        value_proposition: parsed.value_proposition || "",
        target_audience:   parsed.target_audience || "general users",
        tone:              parsed.tone            || "professional",
        language_mix:      parsed.language_mix    || "English",
        dominant_colors:   parsed.dominant_colors || "#6366f1, #ffffff",
        key_benefits:      parsed.key_benefits?.length ? parsed.key_benefits : ["Fast", "Easy to use", "Trusted by millions"],
        has_app_badges:    parsed.has_app_badges  ?? false,
        has_disclaimer:    parsed.has_disclaimer  ?? false,
        urgency:           parsed.urgency         || "",
      };

      setAnalysis(safeAnalysis);
      setStep("ad", "done", `"${(safeAnalysis.headline||"").slice(0,45)}" · CTA: "${safeAnalysis.cta||""}"`);

      // Step 2 — Fetch landing page
      setStep("page", "running", "Fetching landing page...");
      let pageContent = "";
      let currentHeadline = "";
      let currentSubheadline = "";
      let currentCTA = "";
      let currentValueProp = "";
      let rawPageHtml = "";
      let pageTitle = "";
      let pageStepDetail = "";
      let isSPA = false;
      try {
        const r = await fetch("/api/fetch-page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: pageUrl }),
        });
        const d = await r.json();
        if (d.html) {
          rawPageHtml = d.html;
          setPageHtml(rawPageHtml);

          const parser = new DOMParser();
          const doc = parser.parseFromString(d.html, "text/html");
          const title = doc.title || "";
          pageTitle = title;
          const h1El = doc.querySelector("h1");
          const h2El = doc.querySelector("h2");
          const ctaEl = Array.from(doc.querySelectorAll("button, a[href]"))
            .find(el => /sign|start|get|try|download|open/i.test((el.textContent || "").trim()));

          currentHeadline = (h1El?.textContent || "").trim();
          currentSubheadline = (h2El?.textContent || "").trim();
          currentCTA = (ctaEl?.textContent || "").trim();

          let valuePropEl = null;
          if (h1El) {
            let next = h1El.nextElementSibling;
            while (next) {
              if ((next.tagName || "").toLowerCase() === "p") {
                valuePropEl = next;
                break;
              }
              next = next.nextElementSibling;
            }
          }
          currentValueProp = ((valuePropEl || doc.querySelector("p"))?.textContent || "").trim();

          const heads = Array.from(doc.querySelectorAll("h1,h2,h3")).map(h => h.textContent.trim()).slice(0,6).join(" | ");
          const body  = (doc.body?.innerText || "").slice(0, 2800);
          pageContent = d.text || `Title: ${title}\nHeadings: ${heads}\nContent:\n${body}`;
          pageStepDetail = `"${(currentHeadline || title).slice(0,50)}" — current elements extracted`;
        } else {
          throw new Error("empty");
        }
      } catch {
        pageContent = `Landing page URL: ${pageUrl}. Infer from URL context.`;
        pageStepDetail = "Analyzed from URL context";
      }

      const dominantColors = Array.isArray(safeAnalysis.dominant_colors)
        ? safeAnalysis.dominant_colors
        : String(safeAnalysis.dominant_colors || "").split(",").map(c => c.trim()).filter(Boolean);

      const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(pageUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
      let pageDesignSystemData = {
        brand_primary: dominantColors[0] || "#111111",
        brand_secondary: dominantColors[1] || dominantColors[0] || "#333333",
        background_color: "#ffffff",
        text_color: "#111111",
        font_style: "modern sans",
        hero_layout: "split hero with visual on right",
        cta_style: "rounded solid button",
        has_dark_navbar: false,
        overall_tone: safeAnalysis.tone || "professional",
        section_order: ["navbar", "hero", "trust strip", "benefits", "testimonials", "final cta", "footer"],
      };

      try {
        const designSystemRaw = await callModel(
          "You are a brand design system extractor. Analyze this website screenshot and return ONLY JSON.",
          [
            { type: "image_url", image_url: { url: screenshotUrl } },
            {
              type: "text",
              text: "Extract the design system. Return ONLY JSON with keys: brand_primary (hex), brand_secondary (hex), background_color (hex), text_color (hex), font_style (string), hero_layout (string), cta_style (string), has_dark_navbar (boolean), overall_tone (string), section_order (array of strings)",
            },
          ],
          { model: "meta-llama/llama-4-scout-17b-16e-instruct", maxTokens: 800 }
        );

        const cleanDesignSystemRaw = String(designSystemRaw || "")
          .replace(/```[a-z]*/gi, "")
          .replace(/```/g, "")
          .trim();
        const parsedDesign = JSON.parse(cleanDesignSystemRaw);
        pageDesignSystemData = {
          ...pageDesignSystemData,
          ...parsedDesign,
          has_dark_navbar: parsedDesign?.has_dark_navbar ?? pageDesignSystemData.has_dark_navbar,
          section_order: Array.isArray(parsedDesign?.section_order) ? parsedDesign.section_order : pageDesignSystemData.section_order,
        };
      } catch {
        // Keep default design-system fallbacks if screenshot extraction fails.
      }

      setPageDesignSystem(pageDesignSystemData);

      isSPA = !currentHeadline && !currentSubheadline;
      if (isSPA) {
        setIsSPAMode(true);
        setStep("page", "done", "JavaScript app detected — extracted brand design system from screenshot");
      } else {
        setIsSPAMode(false);
        setStep("page", "done", pageStepDetail || `"${(pageTitle || "").slice(0,50)}" — current elements extracted`);
      }

      if (!rawPageHtml && !isSPA) {
        throw new Error("Could not fetch landing page HTML for modification.");
      }

      if (rawPageHtml) {
        setPageHtml(sanitizeForPreview(rawPageHtml, pageUrl));
      }

      // Step 3 — Personalize page elements
      setStep("gen", "running", "Modifying page elements for message-match...");

      if (isSPA) {
        const generatePrompt = `You are an expert conversion-focused landing page developer.
You will recreate a high-fidelity landing page that matches both
the ad creative and the brand's visual identity.

SETUP
- Use Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
- Import Google Font matching the brand's font_style via @import
- Configure Tailwind with EXACT brand colors from the design system:
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          brand: "${pageDesignSystemData.brand_primary}",
          secondary: "${pageDesignSystemData.brand_secondary}",
        },
        fontFamily: { sans: ["<chosen font>", "sans-serif"] }
      }
    }
  }

DESIGN RULES
- Use ONLY colors from the extracted design system. No invented colors.
- Hero layout must match: ${pageDesignSystemData.hero_layout}
- CTA style must match: ${pageDesignSystemData.cta_style}
- Overall tone must match: ${pageDesignSystemData.overall_tone}
- Navbar background: dark if ${pageDesignSystemData.has_dark_navbar} else brand color

SECTIONS (required, in this order)
1. Navbar — brand name as text logo, 2-3 nav links, CTA button
2. Hero — full viewport height, match hero_layout from design system
   - Headline: EXACTLY "${safeAnalysis.headline}"
   - Subheadline continues the ad message in ${safeAnalysis.language_mix}
   - CTA button: EXACTLY "${safeAnalysis.cta}"
   - Right side: abstract CSS/SVG visual (chart, phone frame, or geometric shape) using brand colors
3. Trust strip — 3 stat badges in a horizontal bar using brand_secondary color
4. Benefits — 3 cards, icons as colored SVG shapes, from: ${JSON.stringify(safeAnalysis.key_benefits)}
5. Testimonials — 3 cards with avatar initials circles, realistic Indian names
6. Final CTA — full width section with brand gradient, bold headline, CTA button
7. Footer — app badges if ${safeAnalysis.has_app_badges}, disclaimer if ${safeAnalysis.has_disclaimer}

TECHNICAL
- Single HTML file, all in one
- CSS animations: fade-in on hero text, subtle hover lift on cards
- Mobile responsive with Tailwind sm/md/lg prefixes
- Return ONLY complete HTML, no markdown fences`;

        const generatedHtml = await callModel(
          generatePrompt,
          `AD ANALYSIS:
${JSON.stringify(safeAnalysis, null, 2)}

PAGE DESIGN SYSTEM:
${JSON.stringify(pageDesignSystemData, null, 2)}

The landing page is a JavaScript SPA — use the design system above
to generate a brand-faithful personalized page. Make it look
indistinguishable from the real brand's design language.`
        );

        const cleanGeneratedHtml = String(generatedHtml || "")
          .replace(/^```(?:html)?\s*/i, "")
          .replace(/\s*```\s*$/i, "")
          .trim();

        setPageChanges(null);
        setOutputHtml(sanitizeForPreview(cleanGeneratedHtml || generatedHtml, pageUrl));
        setStep("gen", "done", "SPA fallback generated brand-matched page");
        setRunning(false);
        return;
      }

      const systemPrompt = `You are a landing page personalization engine.
Your job is to create message-match between an ad and its landing page
by modifying specific elements — NOT redesigning the page.

You will receive:
- The current landing page elements
- The ad analysis

Return ONLY a JSON object with this exact structure:
{
  "headline": "new headline text that matches the ad",
  "subheadline": "new subheadline that continues the ad message",
  "cta": "exact CTA text from the ad",
  "value_prop": "new value prop aligned with ad's value proposition",
  "hero_bg_color": "brand primary hex color from the ad",
  "cta_bg_color": "CTA button hex color from the ad",
  "changes_made": [
    "Changed headline from: X → to: Y",
    "Changed CTA from: X → to: Y"
  ]
}

Rules:
- Match the language style exactly: if the ad is Hinglish, the output is Hinglish
- Keep the tone of the original page but align the message to the ad
- changes_made must list every element you changed as human readable strings
- Return ONLY the JSON. No markdown, no explanation.`;

      const diffText = await callModel(
        systemPrompt,
        `CURRENT PAGE ELEMENTS:
headline: ${currentHeadline}
subheadline: ${currentSubheadline}
cta: ${currentCTA}
value_prop: ${currentValueProp}

AD ANALYSIS:
${JSON.stringify(safeAnalysis, null, 2)}

Return the personalization diff JSON now.`
      );

      const cleanDiffText = String(diffText || "").replace(/```[a-z]*/g, "").replace(/```/g, "").trim();
      let diff;
      try {
        diff = JSON.parse(cleanDiffText);
      } catch {
        diff = {
          headline: safeAnalysis.headline,
          subheadline: safeAnalysis.subheadline,
          cta: safeAnalysis.cta,
          value_prop: safeAnalysis.value_proposition,
          hero_bg_color: dominantColors[0] || "#111111",
          cta_bg_color: dominantColors[1] || dominantColors[0] || "#111111",
          changes_made: [
            `Changed headline from: ${currentHeadline || ""} → to: ${safeAnalysis.headline || ""}`,
            `Changed CTA from: ${currentCTA || ""} → to: ${safeAnalysis.cta || ""}`,
          ],
        };
      }

      const safeDiff = {
        headline: String(diff?.headline || safeAnalysis.headline || currentHeadline || "").trim(),
        subheadline: String(diff?.subheadline || safeAnalysis.subheadline || currentSubheadline || "").trim(),
        cta: String(diff?.cta || safeAnalysis.cta || currentCTA || "Get Started").trim(),
        value_prop: String(diff?.value_prop || safeAnalysis.value_proposition || currentValueProp || "").trim(),
        hero_bg_color: String(diff?.hero_bg_color || dominantColors[0] || "#111111").trim(),
        cta_bg_color: String(diff?.cta_bg_color || dominantColors[1] || dominantColors[0] || "#111111").trim(),
        changes_made: Array.isArray(diff?.changes_made) && diff.changes_made.length
          ? diff.changes_made
          : [
              `Changed headline from: ${currentHeadline || ""} → to: ${safeAnalysis.headline || ""}`,
              `Changed CTA from: ${currentCTA || ""} → to: ${safeAnalysis.cta || ""}`,
            ],
      };

      setPageChanges(safeDiff);

      const finalDoc = new DOMParser().parseFromString(rawPageHtml, "text/html");

      const h1Node = finalDoc.querySelector("h1");
      if (h1Node && safeDiff.headline) h1Node.textContent = safeDiff.headline;

      const h2Node = finalDoc.querySelector("h2");
      if (h2Node && safeDiff.subheadline) h2Node.textContent = safeDiff.subheadline;

      const ctaNode = Array.from(finalDoc.querySelectorAll("button, a[href]"))
        .find(el => /sign|start|get|try|download|open/i.test((el.textContent || "").trim()))
        || finalDoc.querySelector("button, a[href]");
      if (ctaNode && safeDiff.cta) ctaNode.textContent = safeDiff.cta;

      let valuePropNode = null;
      if (h1Node) {
        let next = h1Node.nextElementSibling;
        while (next) {
          if ((next.tagName || "").toLowerCase() === "p") {
            valuePropNode = next;
            break;
          }
          next = next.nextElementSibling;
        }
      }
      if (!valuePropNode) valuePropNode = finalDoc.querySelector("p");
      if (valuePropNode && safeDiff.value_prop) valuePropNode.textContent = safeDiff.value_prop;

      const styleNode = finalDoc.createElement("style");
      styleNode.textContent = `:root { --brand: ${safeDiff.hero_bg_color}; --cta: ${safeDiff.cta_bg_color}; }`;
      if (finalDoc.body) {
        finalDoc.body.appendChild(styleNode);
      } else if (finalDoc.documentElement) {
        finalDoc.documentElement.appendChild(styleNode);
      }

      let finalHtml = rawPageHtml;
      if (finalDoc.documentElement) {
        finalHtml = `<!DOCTYPE html>\n${finalDoc.documentElement.outerHTML}`;
      }

      setOutputHtml(sanitizeForPreview(finalHtml, pageUrl));
      setStep("gen", "done", "Page elements personalized");

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
    setRunning(false);
  };

  const download = () => {
    if (!outputHtml) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([outputHtml], { type: "text/html" }));
    a.download = "personalized-landing-page.html";
    a.click();
  };

  const openFull = () => {
    if (!outputHtml) return;
    const w = window.open("", "_blank");
    w.document.write(outputHtml);
  };

  const showSteps = Object.keys(stepSt).length > 0;

  return (
    <>
      <Head>
        <title>Ad → Landing Page Personalizer · Troopod</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={s.wrap}>
        <div style={s.header}>
          <h1 style={s.h1}>Ad → Landing Page Personalizer</h1>
          <p style={s.sub}>Input your ad creative + landing page URL to generate a message-matched personalized page</p>
        </div>

        {/* Ad Creative */}
        <div style={s.card}>
          <div style={s.label}>AD CREATIVE</div>
          <div style={s.tabs}>
            {["upload","url"].map(m => (
              <button key={m} onClick={() => { setAdMode(m); setAdFile(null); setAdUrl(""); }}
                style={{ ...s.smallBtn, border: adMode === m ? "1.5px solid rgba(255,255,255,0.3)" : "0.5px solid rgba(255,255,255,0.14)", background: adMode === m ? "#1c1c20" : "transparent", fontSize: 13, padding: "5px 14px" }}>
                {m === "upload" ? "Upload image" : "Image URL"}
              </button>
            ))}
          </div>
          {adMode === "upload" ? (
            <div style={{ ...s.dropzone, ...(adFile ? { borderColor: "#22c55e", color: "#22c55e" } : {}) }}
              onClick={() => fileRef.current.click()}>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
              {adFile ? `✓ ${adFile.name}` : "Click to upload ad image (PNG, JPG, WebP, GIF)"}
            </div>
          ) : (
            <input value={adUrl} onChange={e => setAdUrl(e.target.value)}
              placeholder="https://example.com/ad-creative.png" style={s.input} />
          )}
        </div>

        {/* Landing Page URL */}
        <div style={s.card}>
          <div style={s.label}>LANDING PAGE URL</div>
          <input value={pageUrl} onChange={e => setPageUrl(e.target.value)}
            placeholder="https://yoursite.com/landing-page" style={s.input} />
        </div>

        <button onClick={run} disabled={!canRun}
          style={{ ...s.genBtn, opacity: canRun ? 1 : 0.35, cursor: canRun ? "pointer" : "not-allowed" }}>
          {running ? "Running pipeline..." : "Generate Personalized Page →"}
        </button>

        {/* Steps */}
        {showSteps && (
          <div style={s.stepsBox}>
            {STEPS.map((step, i) => {
              const status = stepSt[step.id] || "pending";
              const detail = stepDt[step.id] || "";
              return (
                <div key={step.id} style={{ ...s.stepRow, ...(i < 2 ? { borderBottom: "0.5px solid rgba(255,255,255,0.07)" } : {}) }}>
                  <span style={{ ...s.stepIcon, color: STATUS_COLOR[status] }}>
                    {STATUS_ICON[status]}
                  </span>
                  <div>
                    <div style={s.stepName}>{step.label}</div>
                    <div style={s.stepDetail}>{detail || (status === "pending" ? "Waiting..." : step.desc)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Output */}
        {pageHtml && outputHtml && (
          <div>
            <div style={s.outHeader}>
              <div style={s.outTitle}>Landing Page Comparison</div>
              <div style={s.outBtns}>
                <button style={s.smallBtn} onClick={download}>Download HTML</button>
                <button style={s.smallBtn} onClick={openFull}>Open full page ↗</button>
              </div>
            </div>

            <div className="splitView">
              <div className="splitPanel personalizedFirst" style={s.iframeWrap}>
                <div style={{ ...s.label, marginBottom: 8, padding: "0 10px", paddingTop: 8 }}>Personalized</div>
                <iframe srcDoc={outputHtml}
                  style={{ width: "100%", height: 540, border: "none", display: "block" }}
                  title="Personalized landing page" sandbox="allow-same-origin" />
              </div>

              <div className="splitPanel originalSecond" style={s.iframeWrap}>
                <div style={{ ...s.label, marginBottom: 8, padding: "0 10px", paddingTop: 8 }}>Original</div>
                <iframe srcDoc={pageHtml}
                  style={{ width: "100%", height: 540, border: "none", display: "block" }}
                  title="Original landing page" sandbox="allow-same-origin" />
              </div>
            </div>

            {pageChanges?.changes_made?.length > 0 && (
              <div style={s.badge}>
                <div style={{ ...s.outTitle, marginBottom: 8 }}>Changes made</div>
                {pageChanges.changes_made.map((item, idx) => {
                  const m = String(item || "").match(/from:\s*(.*?)\s*→\s*to:\s*(.*)$/i);
                  return (
                    <div key={`${idx}-${item}`} style={{ marginBottom: 6 }}>
                      {m ? (
                        <>
                          <span style={{ color: "#8a8a96", textDecoration: "line-through" }}>{`"${m[1]}"`}</span>
                          <span style={{ color: "#8a8a96", margin: "0 8px" }}>→</span>
                          <span style={{ color: "#22c55e" }}>{`"${m[2]}"`}</span>
                        </>
                      ) : (
                        <span>{String(item)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isSPAMode && pageDesignSystem && (
              <div style={s.badge}>
                <div style={{ ...s.outTitle, marginBottom: 8 }}>Changes made</div>
                <div style={{ marginBottom: 8 }}>
                  Page is a JavaScript app — generated brand-matched recreation using
                  visual design system extracted from live screenshot
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong style={{ color: "#f0f0f2" }}>Brand colors used: </strong>
                  {pageDesignSystem.brand_primary} / {pageDesignSystem.brand_secondary}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong style={{ color: "#f0f0f2" }}>Font chosen: </strong>
                  {pageDesignSystem.font_style}
                </div>
                <div>
                  <strong style={{ color: "#f0f0f2" }}>Layout style applied: </strong>
                  {pageDesignSystem.hero_layout}
                </div>
              </div>
            )}

            {analysis && (
              <div style={s.badge}>
                <strong style={{ color: "#f0f0f2" }}>Ad signals applied: </strong>
                "{analysis.headline}" · CTA: "{analysis.cta}" · Audience: {analysis.target_audience} · Tone: {analysis.tone}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .splitView {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .splitPanel {
          width: 100%;
        }

        .personalizedFirst {
          order: 1;
        }

        .originalSecond {
          order: 2;
        }

        @media (min-width: 768px) {
          .splitPanel {
            width: calc(50% - 6px);
          }

          .originalSecond {
            order: 1;
          }

          .personalizedFirst {
            order: 2;
          }
        }
      `}</style>
    </>
  );
}
