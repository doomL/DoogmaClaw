/**
 * Image generation via OpenRouter chat/completions (modalities image+text).
 * @see https://openrouter.ai/docs/guides/overview/multimodal/image-generation
 */

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!m) return null;
  try {
    return new Uint8Array(Buffer.from(m[1], "base64"));
  } catch {
    return null;
  }
}

export async function generateImageOpenRouter(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const key = apiKey.trim();
  const m = model.trim();
  if (!key || !m || !prompt.trim()) return null;

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: m,
      messages: [{ role: "user", content: prompt.trim() }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[openrouterImage] ${res.status}: ${errText.slice(0, 500)}`);
    return null;
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        images?: Array<{ image_url?: { url?: string }; type?: string }>;
      };
    }>;
  };

  const images = json?.choices?.[0]?.message?.images;
  if (!Array.isArray(images) || images.length === 0) return null;

  const url = images[0]?.image_url?.url;
  if (!url || typeof url !== "string") return null;

  if (url.startsWith("data:")) {
    const mimeMatch = url.match(/^data:(image\/[^;]+);base64,/);
    const mime = mimeMatch?.[1] ?? "image/png";
    const bytes = dataUrlToBytes(url);
    if (!bytes) return null;
    return { bytes, mime };
  }

  try {
    const imgRes = await fetch(url);
    if (!imgRes.ok) return null;
    const mime = imgRes.headers.get("content-type") ?? "image/png";
    return { bytes: new Uint8Array(await imgRes.arrayBuffer()), mime };
  } catch (e) {
    console.error("[openrouterImage] fetch image url:", e);
    return null;
  }
}
