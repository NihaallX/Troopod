export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY not set in environment variables." });
  }

  try {
    const inbound = req.body || {};
    const contentBlocks = (inbound.messages || [])[0]?.content || "";

    const toGroqContent = (content) => {
      if (typeof content === "string") return content;
      if (!Array.isArray(content)) return "";

      return content.map((block) => {
        if (block.type === "text") {
          return { type: "text", text: block.text || "" };
        }

        if (block.type === "image" && block.source?.type === "base64") {
          const mediaType = block.source.media_type || "image/jpeg";
          const data = block.source.data || "";
          return {
            type: "image_url",
            image_url: {
              url: `data:${mediaType};base64,${data}`,
            },
          };
        }

        if (block.type === "image_url" && block.image_url?.url) {
          return {
            type: "image_url",
            image_url: {
              url: block.image_url.url,
            },
          };
        }

        return null;
      }).filter(Boolean);
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: inbound.model || "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: inbound.max_tokens || 1000,
        temperature: inbound.temperature ?? 0.2,
        messages: [
          ...(inbound.system ? [{ role: "system", content: inbound.system }] : []),
          {
            role: "user",
            content: toGroqContent(contentBlocks),
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";

    res.status(response.status).json({
      ...data,
      content: [{ type: "text", text }],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
