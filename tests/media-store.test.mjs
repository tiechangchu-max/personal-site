import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubMediaStore, validateIndex, fileInfo, isSafeMediaPath, validateBatch } from '../media-store.mjs';

const makeWork = (id = 'sample') => ({ id, title: '中文作品', type: 'image', src: `assets/uploads/${id}.png`, poster: '', category: '产品视觉', description: '创作说明', prompt: 'Original prompt', createdAt: '2026-10-04T00:00:00Z' });
const makeItem = (id = 'new-work') => ({ file: { name: 'photo.png', type: 'image/png', size: 10 }, blobSha: 'media-blob', work: makeWork(id) });
function mockGit({ race = false, lostResponse = false, corrupt = false, deny = false } = {}) {
  const calls = []; let current = { version: 1, works: [makeWork('existing')] }, staged, saved = false, snapshots = 0;
  const fetcher = async (url, options) => {
    const path = url.split('/personal-site')[1], body = options.body && JSON.parse(options.body);
    calls.push({ path, method: options.method, body });
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-only-token');
    const ok = data => new Response(JSON.stringify(data), { status: 200 });
    if (path === '') return ok({ full_name: 'tiechangchu-max/personal-site', permissions: { push: !deny } });
    if (path === '/git/ref/heads/main') { snapshots++; return ok({ object: { sha: saved ? 'new-commit' : `head-${snapshots}` } }); }
    if (path.startsWith('/git/commits/') && options.method === 'GET') return ok({ tree: { sha: `base-tree-${snapshots}` } });
    if (path.startsWith('/contents/')) return ok(corrupt ? { version: 1, works: null } : current);
    if (path === '/git/trees') { staged = JSON.parse(body.tree.find(entry => entry.path === 'data/works.json').content); return ok({ sha: 'new-tree' }); }
    if (path === '/git/commits') return ok({ sha: 'new-commit' });
    if (path === '/git/refs/heads/main') {
      if (race) return new Response('{}', { status: 422 });
      current = staged; saved = true;
      if (lostResponse) throw new TypeError('Network request failed');
      return ok({ object: { sha: 'new-commit' } });
    }
    throw new Error(`Unexpected route ${path}`);
  };
  return { calls, fetcher, get current() { return current; } };
}

test('rejects unsupported, empty and oversized files', () => {
  assert.equal(fileInfo({ name: 'clip.MP4', type: 'video/mp4', size: 20 }).type, 'video');
  for (const file of [{ name: 'x.svg', size: 10 }, { name: 'x.png', size: 0 }, { name: 'x.mp4', size: 51 * 1024 * 1024 }, { name: 'x.jpg', type: 'text/html', size: 10 }]) assert.throws(() => fileInfo(file));
  assert.throws(() => validateBatch([]));
  assert.throws(() => validateBatch(Array.from({length:11}, (_, i) => makeItem(`id-${i}`))));
});
test('rejects external media, traversal, duplicate IDs and invalid index', () => {
  for (const path of ['https://example.org/pic.jpg', 'assets/uploads/../private.jpg', 'assets/uploads/x.svg', 'javascript:alert(1)', 'assets//uploads/a.png']) assert.equal(isSafeMediaPath(path), false);
  assert.throws(() => validateIndex({ version: 1, works: [makeWork(), makeWork()] }));
  assert.throws(() => validateIndex({ version: 1, works: [{ ...makeWork(), title: '' }] }));
});
test('publishes media and UTF-8 metadata atomically and keeps old records', async () => {
  const api = mockGit(); const store = new GitHubMediaStore(api.fetcher);
  await store.connect('test-only-token');
  const result = await store.publish([makeItem()]);
  assert.equal(result.sha, 'new-commit'); assert.equal(api.current.works.length, 2); assert.equal(api.current.works[0].title, '中文作品');
  const tree = api.calls.find(call => call.path === '/git/trees');
  assert.equal(tree.body.base_tree, 'base-tree-3'); assert.equal(tree.body.tree.length, 2); assert.equal(tree.body.tree[0].sha, 'media-blob');
  assert.deepEqual(api.calls.find(call => call.path === '/git/commits').body.parents, ['head-3']);
  assert.equal(api.calls.find(call => call.path === '/git/refs/heads/main').body.force, false);
});
test('a conflicting branch update cannot overwrite another author', async () => {
  const api = mockGit({ race: true }); const store = new GitHubMediaStore(api.fetcher);
  await store.connect('test-only-token'); await assert.rejects(store.publish([makeItem()]), error => error.status === 422);
  assert.equal(api.current.works.length, 1); assert.equal(api.calls.filter(call => call.path === '/git/refs/heads/main').length, 1);
});
test('confirms a successful commit when the write response is lost', async () => {
  const api = mockGit({ lostResponse: true }); const store = new GitHubMediaStore(api.fetcher);
  await store.connect('test-only-token'); assert.equal((await store.publish([makeItem()])).sha, 'new-commit'); assert.equal(api.current.works.length, 2);
});
test('retrying a saved batch never duplicates works', async () => {
  const api = mockGit(); const store = new GitHubMediaStore(api.fetcher);
  await store.connect('test-only-token'); await store.publish([makeItem()]); await store.publish([makeItem()]);
  assert.equal(api.current.works.length, 2); assert.equal(api.calls.filter(call => call.path === '/git/refs/heads/main').length, 1);
});
test('invalid remote data and missing permission stop writes', async () => {
  for (const options of [{ corrupt: true }, { deny: true }]) {
    const api = mockGit(options); const store = new GitHubMediaStore(api.fetcher);
    await assert.rejects(store.connect('test-only-token')); assert.equal(api.calls.some(call => call.method !== 'GET'), false); await assert.rejects(store.snapshot(), /请先连接/);
  }
});
test('disconnect clears authorization', async () => {
  const api = mockGit(); const store = new GitHubMediaStore(api.fetcher);
  await store.connect('test-only-token'); store.disconnect(); await assert.rejects(store.publish([makeItem()]), /请先连接/);
});
