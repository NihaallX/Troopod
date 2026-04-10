export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TroopodBot/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    });
    const rawHtml = await response.text();

    let extractedText = "";
    try {
      const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = (titleMatch?.[1] || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      const headingMatches = Array.from(rawHtml.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi));
      const headings = headingMatches
        .slice(0, 6)
        .map(m => (m[1] || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" | ");

      const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyText = (bodyMatch?.[1] || rawHtml)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2800);

      extractedText = `Title: ${title}\nHeadings: ${headings}\nContent:\n${bodyText}`;
    } catch {
      extractedText = "";
    }

    res.status(200).json({ html: rawHtml, text: extractedText });
  } catch (err) {
    res.status(200).json({ html: "", text: "", error: err.message });
  }
}
