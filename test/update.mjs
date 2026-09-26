/** Self-check of the in-app updater's release picking (`npm run check:update`). */
import assert from 'node:assert/strict';

import { compareVersions, pickUpdate } from '../src/features/update/releases.ts';

const ordered = ['1.0.0-alpha', '1.0.0-beta.1', '1.0.0-beta.2', '1.0.0-beta.10', '1.0.0-rc.1', '1.0.0', 'v1.0.1', '1.1.0', '2.0.0'];
for (let i = 0; i < ordered.length - 1; i++) {
  assert.equal(compareVersions(ordered[i], ordered[i + 1]), -1, `${ordered[i]} < ${ordered[i + 1]}`);
  assert.equal(compareVersions(ordered[i + 1], ordered[i]), 1, `${ordered[i + 1]} > ${ordered[i]}`);
}
assert.equal(compareVersions('v1.0.0-beta.2', '1.0.0-beta.2'), 0);

const rel = (tag, apk = true, draft = false) => ({
  tag_name: tag, name: tag, draft, html_url: '', body: `### Fixed\n\n- **Boards** saved\n\n## Install\n\nignored`,
  assets: apk ? [{ name: `shareboard-${tag}.apk`, browser_download_url: `https://x/${tag}.apk` }] : [],
});
// Newest with an APK wins; drafts, APK-less and older releases never do.
const u = pickUpdate([rel('v1.0.0-beta.4', false), rel('v1.0.0-beta.5', true, true), rel('v1.0.0-beta.3'), rel('v1.0.0-beta.1')], '1.0.0-beta.2');
assert.deepEqual(u, { version: '1.0.0-beta.3', notes: 'Fixed\n\n- Boards saved', apkUrl: 'https://x/v1.0.0-beta.3.apk' });
// The running release's own APK still uploading must not offer a downgrade.
assert.equal(pickUpdate([rel('v1.0.0-beta.3', false), rel('v1.0.0-beta.2')], '1.0.0-beta.3'), null);

console.log('update: ok');
