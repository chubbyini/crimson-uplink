const LINKEDIN_VERSION = "202501";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": LINKEDIN_VERSION,
    "Content-Type": "application/json",
  };
}

/** Resolve the member URN via OpenID userinfo (sub → urn:li:person:{sub}). */
export async function getPersonUrn(token: string): Promise<string> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`LinkedIn userinfo failed: ${res.status} (check token + openid scope)`);
  }
  const data = (await res.json()) as { sub?: string };
  if (!data.sub) throw new Error("LinkedIn userinfo failed: no sub");
  return `urn:li:person:${data.sub}`;
}

export interface LinkedinPublishResult {
  postUrn: string;
  url: string;
}

/**
 * Text-only member post via the Posts API with the USER's token (BYOK).
 * 3000-char limit enforced before sending.
 */
export async function publishToLinkedin(
  token: string,
  text: string
): Promise<LinkedinPublishResult> {
  const commentary = text.length > 3000 ? text.slice(0, 2997) + "…" : text;
  const author = await getPersonUrn(token);

  const res = await fetch("https://api.linkedin.com/rest/posts?trk=crimson_uplink", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      author,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LinkedIn publish failed: ${res.status} ${body.slice(0, 300)}`);
  }
  // Success returns the post URN in x-restli-id, e.g. urn:li:share:123…
  const postUrn = res.headers.get("x-restli-id") ?? "";
  const id = postUrn.split(":").pop() ?? "";
  return {
    postUrn,
    url: id ? `https://www.linkedin.com/feed/update/${id}/` : "https://www.linkedin.com/feed/",
  };
}
