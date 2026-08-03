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

/** Encode a repo path for the Contents API. `encodeURIComponent` would
 *  turn `/` into `%2F`, which works most of the time but can confuse
 *  GitHub's edge cache after a recent write (mysterious 404s on GET, 422
 *  on PUT). Encoding each segment separately and rejoining with literal
 *  slashes matches what GitHub's own examples use. */
function encodeRepoPath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

/** Read a file from the repo. Returns its current SHA (needed to update
 *  it without conflict) and decoded text content. Throws if missing. */
export async function getRepoFile(
  pat: string,
  path: string,
): Promise<{ sha: string; content: string }> {
  // Cache-bust query param so GitHub's edge cache can't hand us a stale
  // SHA right after a recent write. Without this we've seen the "is at X
  // but expected Y" 409 (stale) and "sha wasn't supplied" 422 (cache says
  // file is missing when it actually exists) on consecutive Approve clicks.
  // (We intentionally do NOT send a Cache-Control header — that would
  // trigger a CORS preflight to api.github.com that the API rejects,
  // breaking the fetch entirely with "Failed to fetch".)
  const res = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeRepoPath(path)}?ref=${REPO_BRANCH}&_cb=${Date.now()}`,
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
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeRepoPath(path)}`;

  async function tryPut(currentSha?: string): Promise<Response> {
    const body: Record<string, unknown> = {
      message,
      content: base64,
      branch: REPO_BRANCH,
    };
    if (currentSha) body.sha = currentSha;
    return fetch(url, {
      method: 'PUT',
      headers: { ...ghHeaders(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  let res = await tryPut(sha);

  // Retry-on-conflict: GitHub's Contents API has been observed to serve
  // stale data from edge caches immediately after a write. The two
  // failure modes we recover from here:
  //   • 422 "sha wasn't supplied" → file exists; our pre-PUT GET was a
  //     cache-miss that returned 404. Fetch a fresh sha, retry.
  //   • 409 sha mismatch → the file changed between our GET and PUT
  //     (or the GET hit a stale cache). Refetch and retry.
  //
  // The edge cache can stay stale for several seconds after a write, so
  // we poll the GET endpoint up to 5 times with growing backoff (0.5s,
  // 1s, 1.5s, 2s, 2.5s — ~7.5 s total) before giving up.
  if (res.status === 422 || res.status === 409) {
    let fresh: { sha: string; content: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 500 + attempt * 500));
      try {
        fresh = await getRepoFile(pat, path);
        break;
      } catch {
        // 404 / transient — try again
      }
    }
    if (fresh) {
      res = await tryPut(fresh.sha);
    }
  }

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

/* ============================================================
 *  Atomic multi-file commits via Git Data API
 * ============================================================
 *
 *  The Contents API (used above) writes one file per call. After the
 *  BFG history rewrite we observed it returning stale/wrong SHAs from
 *  edge caches for several seconds, which manifested as 409/422 errors
 *  that left publishes in an inconsistent state (photo committed but
 *  mascots.json not yet, etc).
 *
 *  The Git Data API operates one level lower: build blobs, build a
 *  tree, build a commit, fast-forward the branch ref. Three benefits:
 *    1. ALL the file changes for a publish go in ONE commit. No more
 *       partial state.
 *    2. We never look up file SHAs by path. The atomicity guarantee
 *       comes from the ref-update step's optimistic concurrency check
 *       against the parent commit SHA — no cache involved.
 *    3. Re-running a publish that already landed is harmless: the
 *       caller checks first ("is this submission already approved?")
 *       and skips, instead of retrying the same writes and tripping
 *       409s.
 */

interface CommitFile {
  /** Path inside the repo, e.g. "public/photos/472.jpeg" */
  path: string;
  /** File content. Pass raw bytes for binary; a string for text. */
  content: Uint8Array | string;
}

/** Build a single atomic commit that creates/updates the given files
 *  on the default branch. Returns the new HEAD commit SHA.
 *
 *  `rebuild` (STRONGLY recommended for any read-modify-write caller):
 *  called when the ref update loses a race with another commit. It must
 *  RE-READ the repo state and return fresh files + message, which are
 *  used for the retry. Without it, the retry re-pushes content computed
 *  from a now-stale snapshot — which is exactly how the 2026-08-02
 *  double-Approve erased a mascot: two publishes both read mascots.json
 *  before either committed, both picked id 482, and the loser's blind
 *  retry overwrote the winner's commit (Norbert vanished, Ollie kept). */
export async function commitFilesAtomic(
  pat: string,
  files: CommitFile[],
  message: string,
  rebuild?: () => Promise<{ files: CommitFile[]; message: string }>,
): Promise<string> {
  if (files.length === 0) throw new Error('commitFilesAtomic: no files');

  // Up to 2 retries if the ref-update step loses a race with another
  // pusher. When that happens, `rebuild` recomputes the payload against
  // the fresh branch tip so we never clobber the other writer's change.
  let curFiles = files;
  let curMessage = message;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await commitFilesAtomicOnce(pat, curFiles, curMessage);
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && /ref update lost a race/.test(e.message)) {
        // Brief pause, then retry from a fresh parent commit —
        // recomputing the file contents too, if the caller gave us a
        // rebuild callback.
        await new Promise((r) => setTimeout(r, 400 + attempt * 600));
        if (rebuild) {
          const fresh = await rebuild();
          curFiles = fresh.files;
          curMessage = fresh.message;
        }
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error('commitFilesAtomic: exhausted retries');
}

async function commitFilesAtomicOnce(
  pat: string,
  files: CommitFile[],
  message: string,
): Promise<string> {
  // 1. Read the current branch tip + its tree SHA. We need the tree
  //    SHA as our `base_tree` so unchanged files persist.
  const refRes = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${REPO_BRANCH}?_cb=${Date.now()}`,
    { headers: ghHeaders(pat) },
  );
  if (!refRes.ok) {
    throw new Error(`git/ref failed: ${refRes.status} ${await refRes.text().catch(() => '')}`);
  }
  const refData = (await refRes.json()) as { object: { sha: string } };
  const parentCommitSha = refData.object.sha;

  const commitRes = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${parentCommitSha}`,
    { headers: ghHeaders(pat) },
  );
  if (!commitRes.ok) {
    throw new Error(`git/commits GET failed: ${commitRes.status}`);
  }
  const parentCommit = (await commitRes.json()) as { tree: { sha: string } };
  const baseTreeSha = parentCommit.tree.sha;

  // 2. Create a blob for each file.
  const blobs = await Promise.all(
    files.map(async (f) => {
      const bytes =
        typeof f.content === 'string'
          ? new TextEncoder().encode(f.content)
          : f.content;
      const base64 = encodeBase64(bytes);
      const r = await fetch(
        `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
        {
          method: 'POST',
          headers: { ...ghHeaders(pat), 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: base64, encoding: 'base64' }),
        },
      );
      if (!r.ok) {
        throw new Error(
          `git/blobs POST for ${f.path} failed: ${r.status} ${await r.text().catch(() => '')}`,
        );
      }
      const data = (await r.json()) as { sha: string };
      return { path: f.path, sha: data.sha };
    }),
  );

  // 3. Build a new tree that overlays our blobs on the base tree.
  const treeRes = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`,
    {
      method: 'POST',
      headers: { ...ghHeaders(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: blobs.map((b) => ({
          path: b.path,
          mode: '100644',
          type: 'blob',
          sha: b.sha,
        })),
      }),
    },
  );
  if (!treeRes.ok) {
    throw new Error(`git/trees POST failed: ${treeRes.status} ${await treeRes.text().catch(() => '')}`);
  }
  const newTree = (await treeRes.json()) as { sha: string };

  // 4. Create the commit object.
  const newCommitRes = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`,
    {
      method: 'POST',
      headers: { ...ghHeaders(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [parentCommitSha],
      }),
    },
  );
  if (!newCommitRes.ok) {
    throw new Error(`git/commits POST failed: ${newCommitRes.status} ${await newCommitRes.text().catch(() => '')}`);
  }
  const newCommit = (await newCommitRes.json()) as { sha: string };

  // 5. Fast-forward the branch ref to our new commit. If someone else
  //    pushed between step 1 and now, this returns 422 ("update is not
  //    a fast forward") and we throw a recognizable error so the outer
  //    retry can rebuild from a fresh parent.
  const updateRes = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${REPO_BRANCH}`,
    {
      method: 'PATCH',
      headers: { ...ghHeaders(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    },
  );
  if (updateRes.status === 422) {
    throw new Error('ref update lost a race — will rebuild from fresh parent');
  }
  if (!updateRes.ok) {
    throw new Error(`git/refs PATCH failed: ${updateRes.status} ${await updateRes.text().catch(() => '')}`);
  }
  return newCommit.sha;
}

/** Read a file's text content from the latest commit on main using the
 *  Git Data API (which we've found more reliable than Contents API for
 *  reads taken immediately after a write). Throws if the file doesn't
 *  exist. */
export async function readFileFromMain(
  pat: string,
  path: string,
): Promise<string> {
  const refRes = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${REPO_BRANCH}?_cb=${Date.now()}`,
    { headers: ghHeaders(pat) },
  );
  if (!refRes.ok) throw new Error(`git/ref failed: ${refRes.status}`);
  const refData = (await refRes.json()) as { object: { sha: string } };

  const treeRes = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${refData.object.sha}?recursive=1&_cb=${Date.now()}`,
    { headers: ghHeaders(pat) },
  );
  if (!treeRes.ok) throw new Error(`git/trees recursive failed: ${treeRes.status}`);
  const tree = (await treeRes.json()) as {
    tree: Array<{ path: string; sha: string; type: string }>;
    truncated?: boolean;
  };
  const entry = tree.tree.find((e) => e.path === path && e.type === 'blob');
  if (!entry) throw new Error(`${path} not in tree`);

  const blobRes = await fetch(
    `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs/${entry.sha}`,
    { headers: ghHeaders(pat) },
  );
  if (!blobRes.ok) throw new Error(`git/blobs GET failed: ${blobRes.status}`);
  const blob = (await blobRes.json()) as { content: string; encoding: string };
  if (blob.encoding !== 'base64') throw new Error(`unexpected blob encoding ${blob.encoding}`);
  const decoded =
    typeof window !== 'undefined'
      ? window.atob(blob.content.replace(/\n/g, ''))
      : Buffer.from(blob.content, 'base64').toString('binary');
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Check whether a path exists in the latest tree on main. Used by
 *  publishApproval as a sanity check during idempotent recovery. */
export async function existsOnMain(pat: string, path: string): Promise<boolean> {
  try {
    await readFileFromMain(pat, path);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------- Convenience -------------------------- */

// The `tjmascots` GitHub repo's working tree IS the site/ folder of our
// local checkout — the Next.js app sits at the repo root, not under a
// site/ subdirectory. So these paths are relative to repo root, no
// site/ prefix. The earlier `site/...` paths produced 404s when the
// admin tried to auto-publish.
export const REPO_PATHS = {
  mascotsJson: 'src/data/mascots.json',
  eventsJson:  'src/data/events.json',
  photosDir:   'public/photos',
} as const;
