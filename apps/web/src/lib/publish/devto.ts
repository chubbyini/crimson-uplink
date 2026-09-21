export interface DevtoPublishInput {
  title: string;
  bodyMarkdown: string;
  tags?: string[];
  canonicalUrl?: string;
  published?: boolean;
}

export interface DevtoPublishResult {
  id: number;
  url: string;
}

/**
 * Create an article on Dev.to with the USER's key (BYOK).
 * published=false saves as a Dev.to draft; default true goes live.
 * Strips leading H1 (# Header) from bodyMarkdown to avoid double-header rendering on Dev.to.
 */
export async function publishToDevto(
  apiKey: string,
  input: DevtoPublishInput
): Promise<DevtoPublishResult> {
  let articleTitle = input.title.trim();
  let bodyMarkdown = input.bodyMarkdown.trim();

  // If bodyMarkdown starts with an H1 header (# Title), extract it as the title and remove from body markdown
  const leadingH1Match = bodyMarkdown.match(/^#\s+(.+?)(\r?\n+|$)/);
  if (leadingH1Match) {
    const extractedTitle = leadingH1Match[1].replace(/[*_#]/g, "").trim();
    if (extractedTitle) {
      articleTitle = extractedTitle;
    }
    bodyMarkdown = bodyMarkdown.replace(/^#\s+.+?(\r?\n+|$)/, "").trim();
  }

  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      article: {
        title: articleTitle,
        body_markdown: bodyMarkdown,
        published: input.published ?? true,
        ...(input.tags?.length ? { tags: input.tags.slice(0, 4) } : {}),
        ...(input.canonicalUrl ? { canonical_url: input.canonicalUrl } : {}),
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dev.to publish failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id?: number; url?: string };
  if (!data.id || !data.url) throw new Error("Dev.to publish failed: bad response");
  return { id: data.id, url: data.url };
}
