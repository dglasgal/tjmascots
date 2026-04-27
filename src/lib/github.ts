/**
 * Tiny GitHub Contents-API wrapper used by the admin auto-publish flow.
 *
 * The admin pastes a GitHub Personal Access Token (PAT) into the dashboard
 * once. The token lives only in the admin's localStorage — never in the
 * deployed JS bundle. With it, this module can:
 *
 *   • read a file at a known path (returning bytes + the SHA we need to
 *     pass back when updating it)
 *   • create or update a file (committing in one step on the default
 *     branch)
 *
 * That's all the admin auto-publisher needs to push approved mascot
 * submissions straight into the repo, with no manual git.
 */
const STORAGE_KEY = 'tjmascots:github-pat';
const REPO_OWNER = 'dglasgal';
const REPO_NAME = 'tjmascots';
const REPO_BRANCH = 'main';
const API_BASE = 'https://api.github.com';

/* --------------------------- PAT helpers --------------------------- */

export function getGithubPat(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setGithubPat(pat: string): void {
  window.localStorage.setItem(STORAGE_KEY, pat);
}

export function clearGithubPat(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Quick check that the token works AND can write to our repo. We do this
 *  by hitting `/repos/{owner}/{repo}` and looking at `permissions.push`. */
export async function verifyGithubPat(
  pat: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}`,
      {
        headers: ghHeaders(pat),
      },
    );
    if (res.status === 401) {
      return { ok: false, error: 'Token invalid or expired.' };
    }
    if (res.status === 404) {
      return {
        ok: false,
        error: 'Token can\'t see the repo. Did you grant it access to dglasgal/tjmascots?',
      };
    }
    if (!res.ok) {
      return { ok: false, error: `GitHub returned ${res.status}.` };
    }
    const data = (await res.json()) as { permissions?: { push?: boolean } };
    if (!data.permissions?.push) {
      return {
        ok: false,
        error:
          'Token has read access but not write. Re-create the token with Contents: Read and write.',
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ------------------------- Core API helpers ------------------------ */

function ghHeaders(pat: string): HeadersInit {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Read a file from the repo. Returns its current SHA (needed to update
 *  it without conflict) and decoded text content. Throws if missing. */
export async function getRepoFile(
  pat: string,
  path: string,
): Promise<{ sha: string; content: string }> {
  const res = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(
      path,
    )}?ref=${REPO_BRANCH}`,
    { headers: ghHeaders(pat) },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub GET ${path} failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { sha: string; content: string; encoding: string };
  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected encoding ${data.encoding} for ${path}`);
  }
  // GitHub returns base64 with line breaks; strip them before decoding.
  const decoded =
    typeof window !== 'undefined'
      ? window.atob(data.content.replace(/\n/g, ''))
      : Buffer.from(data.content, 'base64').toString('binary');
  // The decoded value is a binary string. Convert through TextDecoder
  // so multi-byte UTF-8 characters round-trip cleanly.
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return { sha: data.sha, content: new TextDecoder().decode(bytes) };
}

/** Create or update a text file in the repo. Pass `sha` to update (omit
 *  to create new). Returns the new commit SHA. */
export async function putRepoTextFile(
  pat: string,
  path: string,
  textContent: string,
  message: string,
  sha?: string,
): Promise<string> {
  const base64 = encodeBase64(new TextEncoder().encode(textContent));
  return putRepoBase64File(pat, path, base64, message, sha);
}

/** Create or update a binary file in the repo, given its raw bytes.
 *  Pass `sha` to update (omit to create new). Returns the new commit SHA. */
export async function putRepoBinaryFile(
  pat: string,
  path: string,
  bytes: Uint8Array,
  message: string,
  sha?: string,
): Promise<string> {
  return putRepoBase64File(pat, path, encodeBase64(bytes), message, sha);
}

async function putRepoBase64File(
  pat: string,
  path: string,
  base64: string,
  message: string,
  sha?: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    message,
    content: base64,
    branch: REPO_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: { ...ghHeaders(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { commit: { sha: string } };
  return data.commit.sha;
}

/** Base64-encode raw bytes. Browser-safe (uses btoa via binary string). */
function encodeBase64(bytes: Uint8Array): string {
  if (typeof window === 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  // Chunk to avoid blowing the call stack on large photos
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return window.btoa(binary);
}

/* ------------------------- Convenience -------------------------- */

export const REPO_PATHS = {
  mascotsJson: 'site/src/data/mascots.json',
  photosDir: 'site/public/photos',
} as const;
