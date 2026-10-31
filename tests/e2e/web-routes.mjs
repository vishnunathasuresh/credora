import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
async function scanClient(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scanClient(path);
    else if (/\.(js|mjs|html|json|map)$/.test(entry.name)) {
      const source = await readFile(path, 'utf8');
      for (const secret of [
        'IPFS_GATEWAY_AUTH_TOKEN',
        'IPFS_UPLOAD_AUTH_TOKEN',
        'ANVIL_ISSUER_PRIVATE_KEY',
        'SIGNING_PRIVATE_KEY',
      ]) {
        assert.ok(!source.includes(secret), `Server-only identifier ${secret} in ${entry.name}`);
      }
    }
  }
}
await scanClient(join(root, 'apps/web/dist/client'));

const probe = createServer().listen(0, '127.0.0.1');
await once(probe, 'listening');
const { port } = probe.address();
probe.close();
await once(probe, 'close');
const profileApi = createHttpServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.url !== '/profiles/test_profile') {
    response.writeHead(404);
    response.end('{}');
    return;
  }
  response.end(
    JSON.stringify({
      profile: {
        id: 'fixture-profile',
        name: 'Avery & Chen',
        handle: 'test_profile',
        headline: 'Designing useful products',
        bio: 'A public fixture.',
        links: [],
        avatarUrl: '',
        projects: [],
        experience: [],
        education: [],
        credentialHashes: [],
        credentialSummaries: [],
      },
    }),
  );
});
profileApi.listen(0, '127.0.0.1');
await once(profileApi, 'listening');
const profileApiUrl = `http://127.0.0.1:${profileApi.address().port}`;
const server = spawn('pnpm', ['--filter', '@credora/web', 'start', '--port', String(port)], {
  cwd: root,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(port), NODE_ENV: 'production', VITE_API_URL: profileApiUrl },
});
let logs = '';
server.stdout.on('data', (chunk) => {
  logs += chunk;
});
server.stderr.on('data', (chunk) => {
  logs += chunk;
});
const base = `http://127.0.0.1:${port}`;
async function page(path) {
  const response = await fetch(base + path);
  return { response, html: await response.text() };
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Web server exited: ${logs}`);
    try {
      ready = (await fetch(base + '/api/health')).ok;
    } catch {
      /* startup */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Web server did not start: ${logs}`);
  const health = await fetch(base + '/api/health');
  assert.deepEqual(await health.json(), { ok: true, service: 'credora-web' });
  const manifest = await fetch(base + '/manifest.webmanifest');
  assert.match(manifest.headers.get('content-type') ?? '', /application\/manifest\+json/);
  assert.equal((await manifest.json()).display, 'standalone');

  const routes = [
    ['/', /home-hero/],
    ['/verify', /verify-form/],
    ['/wallet', /My credentials/],
    ['/credentials', /My credentials/],
    ['/profile', /Edit your profile/],
    ['/dashboard', /Your space/],
    ['/issuer', /Issue a credential/],
    ['/org', /Organization workspace/],
    ['/admin', /Protocol administration/],
    ['/superadmin', /Protocol administration/],
    ['/u/test_profile', /public-profile-page/],
  ];
  for (const [path, content] of routes) {
    const { response, html } = await page(path);
    assert.equal(response.status, 200, path);
    const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0];
    assert.ok(main, `Missing main content on ${path}`);
    assert.match(main, content, `Wrong route content on ${path}`);
  }
  const publicPage = await page('/u/test_profile');
  assert.match(publicPage.html, /Avery &amp; Chen/);
  assert.match(publicPage.html, /property="og:title"/);
  assert.match(publicPage.html, /Designing useful products/);
  assert.match(publicPage.response.headers.get('cache-control') ?? '', /no-store/);
  const image = await fetch(base + '/u/test_profile/image');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  const png = Buffer.from(await image.arrayBuffer());
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  if (process.env.CREDORA_SOCIAL_IMAGE_OUTPUT)
    await writeFile(process.env.CREDORA_SOCIAL_IMAGE_OUTPUT, png);
  const privatePage = await page('/u/private-person');
  assert.doesNotMatch(privatePage.html, /Avery|Designing useful products|og:image/);
  assert.match(privatePage.html, /Profile not found/);
  assert.equal((await fetch(base + '/u/private-person/image')).status, 404);
  // Regression: a nested /verify layout once hid its child result behind the form.
  const detail = await page('/verify/not-a-hash');
  assert.equal(detail.response.status, 200);
  assert.match(detail.html, /Reference not understood/);
  assert.match(detail.html, /not-a-hash/);
  assert.doesNotMatch(detail.html, /class="verify-form"/);
  assert.doesNotMatch(detail.html, /Proof checked directly against the configured registry/);

  const syntheticShareToken = 'T'.repeat(43);
  const legacyShare = await fetch(base + '/share/' + syntheticShareToken, { redirect: 'manual' });
  assert.equal(legacyShare.status, 303);
  assert.equal(legacyShare.headers.get('location'), '/share#' + syntheticShareToken);
  assert.equal(
    logs.includes(syntheticShareToken),
    false,
    'legacy share path must not appear in web logs',
  );
  const sharePage = await page('/share#' + syntheticShareToken);
  assert.equal(sharePage.response.status, 200);
  assert.match(sharePage.response.headers.get('cache-control') ?? '', /no-store/);
  assert.equal(sharePage.response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(sharePage.response.headers.get('x-robots-tag') ?? '', /noindex/);
  assert.match(sharePage.html, /Opening shared credentials/);
  assert.doesNotMatch(sharePage.html, new RegExp(syntheticShareToken));
  assert.equal(
    logs.includes(syntheticShareToken),
    false,
    'share fragment must not appear in web logs',
  );
  assert.equal((await fetch(base + '/unknown-route-for-e2e')).status, 404);
  console.log('Built web routes, detail rendering, share privacy and client boundaries passed.');
} finally {
  profileApi.closeAllConnections();
  await new Promise((resolve) => profileApi.close(resolve));
  if (server.pid && server.exitCode === null) {
    const exited = once(server, 'exit');
    process.kill(-server.pid, 'SIGTERM');
    const deadline = setTimeout(() => {
      if (server.exitCode === null) {
        try {
          process.kill(-server.pid, 'SIGKILL');
        } catch {
          /* exited */
        }
      }
    }, 3000);
    await exited;
    clearTimeout(deadline);
  }
}
