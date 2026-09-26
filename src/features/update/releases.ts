/**
 * The in-app updater reads the GitHub releases of this repo: a release whose
 * tag is newer than the running build and that carries an `.apk` is offered
 * for download. Pure logic, no React Native imports (see test/update.mjs).
 */
export const RELEASES_URL = 'https://api.github.com/repos/Juan17la/shareboard_mobile/releases?per_page=20';

/** The version this binary was built as; release.sh bakes it into the EAS beta profile. */
export const CURRENT_VERSION = process.env.EXPO_PUBLIC_RELEASE ?? '';

export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  html_url: string;
  assets: { name: string; browser_download_url: string }[];
}

export interface Update {
  version: string;
  notes: string;
  apkUrl: string;
}

/** Semver order, prerelease included: 1.0.0-beta.2 < 1.0.0-beta.10 < 1.0.0. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core = '', pre] = v.replace(/^v/, '').split(/-(.*)/s);
    return { core: core.split('.').map(Number), pre: pre ? pre.split('.') : [] };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.core[i] ?? 0) - (y.core[i] ?? 0);
    if (d) return Math.sign(d);
  }
  // A release outranks any of its prereleases.
  if (!x.pre.length || !y.pre.length) return Math.sign(y.pre.length - x.pre.length);
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1;
    if (p === q) continue;
    const bothNumeric = /^\d+$/.test(p) && /^\d+$/.test(q);
    return bothNumeric ? Math.sign(Number(p) - Number(q)) : p < q ? -1 : 1;
  }
  return 0;
}

/** The newest downloadable release above `current`, or null. */
export function pickUpdate(releases: GitHubRelease[], current: string): Update | null {
  let best: Update | null = null;
  for (const r of releases) {
    const apk = r.assets.find((a) => a.name.endsWith('.apk'));
    if (r.draft || !apk || compareVersions(r.tag_name, current) <= 0) continue;
    if (best && compareVersions(r.tag_name, best.version) <= 0) continue;
    best = { version: r.tag_name.replace(/^v/, ''), notes: firstLines(r.body ?? ''), apkUrl: apk.browser_download_url };
  }
  return best;
}

/** The start of the release notes (the CHANGELOG section), as plain text. */
function firstLines(markdown: string): string {
  const text = markdown
    .split('\n## Install')[0]!
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*|`/g, '')
    .trim();
  return text.length > 280 ? `${text.slice(0, 277).trimEnd()}…` : text;
}

/** Null when this build is not a release, offline, or already up to date. */
export async function checkForUpdate(current = CURRENT_VERSION): Promise<Update | null> {
  if (!current) return null;
  try {
    const res = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    return pickUpdate((await res.json()) as GitHubRelease[], current);
  } catch {
    return null;
  }
}
