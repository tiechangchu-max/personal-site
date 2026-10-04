export const OWNER = 'tiechangchu-max';
export const REPOSITORY = 'personal-site';
export const BRANCH = 'main';
export const INDEX_PATH = 'data/works.json';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_BYTES = 100 * 1024 * 1024;
const API = `https://api.github.com/repos/${OWNER}/${REPOSITORY}`;
const formats = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm' };

export function fileInfo(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const mime = formats[extension];
  if (!mime || (file.type && file.type !== mime && file.type !== 'application/octet-stream')) throw new Error(`${file.name}：请选择 JPG、PNG、WebP、GIF、AVIF、MP4 或 WebM。`);
  if (!file.size) throw new Error(`${file.name}：文件为空。`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}：超过单文件 50 MB 限制，请先压缩。`);
  return { extension, mime, type: mime.startsWith('video/') ? 'video' : 'image' };
}

export function isSafeMediaPath(path) {
  return typeof path === 'string' && /^assets\/(images|videos|uploads)\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|gif|webp|avif|mp4|webm)$/.test(path) && !path.includes('..') && !path.includes('//');
}

export function validateIndex(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.works)) throw new Error('作品目录格式不正确，请先修复目录后再上传。');
  const ids = new Set();
  for (const work of data.works) {
    if (!work || typeof work.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(work.id) || ids.has(work.id) || !['image', 'video'].includes(work.type) || !isSafeMediaPath(work.src) || (work.poster && !isSafeMediaPath(work.poster))) throw new Error('作品目录中存在无效或重复的记录。');
    for (const [key, max] of Object.entries({ title: 120, description: 2000, category: 40, prompt: 20000, createdAt: 40 })) {
      if (typeof work[key] !== 'string' || work[key].length > max) throw new Error(`作品的 ${key} 字段格式不正确。`);
    }
    if (!work.title.trim() || !work.category.trim()) throw new Error('作品标题和分类不能为空。');
    ids.add(work.id);
  }
  return data;
}

export function validateBatch(items) {
  if (!items.length || items.length > 10) throw new Error('每次请选择 1–10 个文件。');
  if (items.reduce((sum, item) => sum + item.file.size, 0) > MAX_BATCH_BYTES) throw new Error('本批文件合计超过 100 MB，请分批上传。');
  for (const item of items) fileInfo(item.file);
  validateIndex({ version: 1, works: items.map(item => item.work) });
}

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export class GitHubMediaStore {
  #token = '';
  #fetch;
  constructor(fetcher = globalThis.fetch.bind(globalThis)) { this.#fetch = fetcher; }
  disconnect() { this.#token = ''; }
  async request(path, method = 'GET', body, raw = false) {
    if (!this.#token) throw new Error('请先连接 GitHub。');
    const response = await this.#fetch(`${API}${path}`, {
      method, cache: 'no-store', credentials: 'omit', redirect: 'error',
      headers: { Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', Authorization: `Bearer ${this.#token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const messages = { 401: '访问密钥无效或已过期，请重新连接。', 403: 'GitHub 拒绝了请求。请确认此密钥仅授权 personal-site 仓库，并启用 Contents 的读写权限；若已授权，请稍后再试。', 404: '无法访问网站仓库或作品目录，请检查密钥的仓库授权。', 409: '网站正在被更新。文件和填写内容已保留，请重新发布。', 422: 'GitHub 未接受此次更新，可能有其他更新或分支保护限制。填写内容已保留，请稍后重试。', 429: '请求过于频繁，请稍后再试。' };
      throw new ApiError(messages[response.status] || `GitHub 暂时无法完成请求（${response.status}），请稍后重试。`, response.status);
    }
    return response.status === 204 ? null : response.json();
  }
  async connect(token) {
    this.#token = token.trim();
    try {
      const repo = await this.request('');
      if (repo.full_name?.toLowerCase() !== `${OWNER}/${REPOSITORY}`.toLowerCase() || !repo.permissions?.push) throw new Error('这个 GitHub 账号没有网站仓库的写入权限。');
      if (repo.archived) throw new Error('网站仓库已归档，暂时无法上传。');
      const snapshot = await this.snapshot();
      return snapshot.data;
    } catch (error) { this.disconnect(); throw error; }
  }
  async snapshot() {
    const head = await this.request(`/git/ref/heads/${BRANCH}`);
    const commit = await this.request(`/git/commits/${head.object.sha}`);
    const data = validateIndex(await this.request(`/contents/${INDEX_PATH}?ref=${head.object.sha}`, 'GET', undefined, true));
    return { sha: head.object.sha, tree: commit.tree.sha, data };
  }
  async publish(items, onProgress = () => {}) {
    validateBatch(items);
    onProgress(0, '正在检查最新作品目录…');
    let snapshot = await this.snapshot();
    const alreadySaved = new Set(snapshot.data.works.map(work => work.id));
    const pending = items.filter(item => !alreadySaved.has(item.work.id));
    if (!pending.length) { onProgress(100, '这批作品已保存。'); return { sha: snapshot.sha, count: items.length }; }
    const files = [];
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      onProgress(Math.round(i / pending.length * 75), `正在上传 ${i + 1}/${pending.length}：${item.work.title}`);
      if (!item.blobSha) {
        const content = await readBase64(item.file);
        item.blobSha = (await this.request('/git/blobs', 'POST', { content, encoding: 'base64' })).sha;
      }
      files.push({ path: item.work.src, mode: '100644', type: 'blob', sha: item.blobSha });
    }
    onProgress(80, '文件上传完成，正在保存作品信息…');
    // Read again after the large uploads so unrelated concurrent edits are retained.
    snapshot = await this.snapshot();
    const latestIds = new Set(snapshot.data.works.map(work => work.id));
    const fresh = pending.filter(item => !latestIds.has(item.work.id));
    if (!fresh.length) return { sha: snapshot.sha, count: items.length };
    const data = validateIndex({ ...snapshot.data, works: [...fresh.map(item => item.work), ...snapshot.data.works] });
    const freshPaths = new Set(fresh.map(item => item.work.src));
    const tree = await this.request('/git/trees', 'POST', { base_tree: snapshot.tree, tree: [...files.filter(file => freshPaths.has(file.path)), { path: INDEX_PATH, mode: '100644', type: 'blob', content: JSON.stringify(data, null, 2) + '\n' }] });
    const commit = await this.request('/git/commits', 'POST', { message: `Add ${fresh.length} portfolio work${fresh.length === 1 ? '' : 's'}`, tree: tree.sha, parents: [snapshot.sha] });
    onProgress(95, '正在提交网站更新…');
    try {
      await this.request(`/git/refs/heads/${BRANCH}`, 'PATCH', { sha: commit.sha, force: false });
    } catch (error) {
      // A dropped response may follow a successful write. Confirm before reporting failure.
      try {
        const current = await this.snapshot();
        if (items.every(item => current.data.works.some(work => work.id === item.work.id))) { onProgress(100, '作品已保存。'); return { sha: current.sha, count: items.length }; }
      } catch { /* Keep the original failure and preserve the upload draft. */ }
      throw error;
    }
    onProgress(100, '作品已保存。');
    return { sha: commit.sha, count: items.length };
  }
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('无法读取文件，请重新选择。'));
    reader.readAsDataURL(file);
  });
}
