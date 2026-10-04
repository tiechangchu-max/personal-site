import { GitHubMediaStore, fileInfo, validateBatch, MAX_BATCH_BYTES } from './media-store.mjs';
import { LocalMediaStore } from './local-store.mjs';

const localMode = document.documentElement.dataset.uploader === 'local';
const store = localMode ? new LocalMediaStore() : new GitHubMediaStore();
const publicSite = 'https://tiechangchu-max.github.io/personal-site/';
const form = document.querySelector('#connect-form');
const tokenInput = document.querySelector('#github-token');
const connectionMessage = document.querySelector('#connection-message');
const fileMessage = document.querySelector('#file-message');
const fileInput = document.querySelector('#media-files');
const queue = document.querySelector('#upload-queue');
const publish = document.querySelector('#publish-button');
const result = document.querySelector('#publish-result');
let items = [], connected = false, busy = false;
const formatSize = size => `${(size / 1024 / 1024).toFixed(1)} MB`;
function message(node, text, error = false) { node.textContent = text; node.classList.toggle('error', error); }
function sync() {
  publish.disabled = !connected || !items.length || busy;
  document.querySelector('#queue-summary').textContent = items.length ? `${items.length} 个文件 · ${formatSize(items.reduce((sum, item) => sum + item.file.size, 0))}` : '还没有选择文件';
}
function disconnect() {
  if (localMode) { connected = false; sync(); return; }
  store.disconnect(); connected = false; tokenInput.value = '';
  form.hidden = false; document.querySelector('#connected-state').hidden = true;
  document.querySelector('#connection-label').textContent = '尚未连接'; sync();
}
form?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#connect-button'); button.disabled = true; tokenInput.disabled = true;
  message(connectionMessage, '正在连接网站…');
  const token = tokenInput.value; tokenInput.value = '';
  try {
    const data = await store.connect(token); connected = true;
    form.hidden = true; document.querySelector('#connected-state').hidden = false;
    document.querySelector('#connection-label').textContent = '已连接';
    document.querySelector('#token-help').open = false;
    message(connectionMessage, `网站已有 ${data.works.length} 件作品。`);
    const options = document.querySelector('#category-options');
    const categories = new Set([...options.querySelectorAll('option')].map(option => option.value));
    data.works.forEach(work => categories.add(work.category));
    options.replaceChildren(...[...categories].map(category => new Option(category, category)));
  } catch (error) { disconnect(); message(connectionMessage, error.message || '连接失败，请重试。', true); }
  finally { button.disabled = false; tokenInput.disabled = false; sync(); }
});
async function connectLocal() {
  const button = document.querySelector('#disconnect-button'); button.disabled = true;
  document.querySelector('#connection-label').textContent = '正在连接';
  message(connectionMessage, '正在连接你的网站…');
  try {
    const data = await store.connect(); connected = true;
    document.querySelector('#connection-label').textContent = '已就绪 · 免密上传';
    message(connectionMessage, `已连接，你的网站有 ${data.works.length} 件作品。直接选择文件即可上传。`);
    const options = document.querySelector('#category-options');
    const categories = new Set([...options.querySelectorAll('option')].map(option => option.value));
    data.works.forEach(work => categories.add(work.category));
    options.replaceChildren(...[...categories].map(category => new Option(category, category)));
  } catch (error) {
    connected = false; document.querySelector('#connection-label').textContent = '暂未连接';
    message(connectionMessage, error.message || '连接失败，请重试。', true);
  } finally { button.disabled = false; sync(); }
}
document.querySelector('#disconnect-button').addEventListener('click', () => {
  if (localMode) connectLocal();
  else { disconnect(); message(connectionMessage, '已断开连接，访问密钥已清除。'); }
});

function node(tag, className, text) { const result = document.createElement(tag); if (className) result.className = className; if (text) result.textContent = text; return result; }
function field(item, key, label, max, multiline = false) {
  const wrapper = node('label', `queue-field ${multiline ? 'wide' : ''} ${key === 'prompt' ? 'prompt' : ''}`);
  wrapper.append(node('span', '', label));
  const input = node(multiline ? 'textarea' : 'input');
  input.value = item.work[key]; input.maxLength = max; input.name = `${item.work.id}-${key}`;
  if (key === 'category') input.setAttribute('list', 'category-options');
  if (key === 'title' || key === 'category') input.required = true;
  if (key === 'prompt') input.placeholder = '可选，保留你创作时使用的原始提示词';
  if (key === 'description') input.placeholder = '可选，介绍作品或记录创作思路';
  input.addEventListener('input', () => { item.work[key] = input.value; });
  wrapper.append(input); return wrapper;
}
function renderQueue() {
  queue.replaceChildren();
  for (const item of items) {
    const card = node('article', 'queue-item');
    const left = node('div'); const preview = node('div', 'queue-preview');
    const media = node(item.work.type === 'video' ? 'video' : 'img'); media.src = item.url;
    if (item.work.type === 'video') { media.controls = true; media.playsInline = true; media.preload = 'metadata'; } else media.alt = item.work.title;
    preview.append(media); left.append(preview, node('p', 'queue-file', `${item.file.name} · ${formatSize(item.file.size)}`));
    media.addEventListener('error', () => { message(fileMessage, `${item.file.name} 无法在当前浏览器中预览。请检查文件；视频建议转换为 H.264 MP4。`, true); });
    const remove = node('button', 'queue-remove', '移除此文件'); remove.type = 'button'; remove.setAttribute('aria-label', `移除 ${item.file.name}`);
    remove.addEventListener('click', () => { URL.revokeObjectURL(item.url); items = items.filter(other => other !== item); renderQueue(); }); left.append(remove);
    const inputs = node('div', 'queue-inputs'); inputs.append(field(item, 'title', '作品标题', 120), field(item, 'category', '分类', 40), field(item, 'description', '作品说明', 2000, true), field(item, 'prompt', '创作提示词', 20000, true));
    card.append(left, inputs); queue.append(card);
  }
  sync();
}
function addFiles(files) {
  if (busy) return;
  result.hidden = true;
  document.querySelector('#progress-panel').hidden = true;
  const errors = [];
  for (const file of files) {
    try {
      if (items.length >= 10) throw new Error('每次最多选择 10 个文件，请发布后再添加。');
      const info = fileInfo(file);
      if (items.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) throw new Error(`${file.name} 已在待上传列表中。`);
      if (items.reduce((sum, item) => sum + item.file.size, file.size) > MAX_BATCH_BYTES) throw new Error('本批文件合计超过 100 MB，请分批上传。');
      const id = `work-${crypto.randomUUID()}`;
      items.push({ file, url: URL.createObjectURL(file), work: { id, title: file.name.replace(/\.[^.]+$/, '').slice(0,120) || '未命名作品', type: info.type, src: `assets/uploads/${id}.${info.extension}`, poster: '', category: info.type === 'video' ? '影像实验' : '产品视觉', description: '', prompt: '', createdAt: new Date().toISOString() } });
    } catch (error) { errors.push(error.message); }
  }
  message(fileMessage, errors.join('\n'), errors.length > 0); fileInput.value = ''; renderQueue();
}
fileInput.addEventListener('change', () => addFiles([...fileInput.files]));
const dropzone = document.querySelector('#dropzone');
['dragenter', 'dragover'].forEach(name => dropzone.addEventListener(name, event => { event.preventDefault(); if (!busy) dropzone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(name => dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.remove('dragging'); }));
dropzone.addEventListener('drop', event => addFiles([...event.dataTransfer.files]));
window.addEventListener('dragover', event => { event.preventDefault(); });
window.addEventListener('drop', event => { event.preventDefault(); });

publish.addEventListener('click', async () => {
  if (busy || !connected || !items.length) return;
  for (const item of items) { item.work.title = item.work.title.trim(); item.work.category = item.work.category.trim(); }
  const invalid = [...queue.querySelectorAll('input,textarea')].find(input => !input.checkValidity());
  if (invalid) { invalid.reportValidity(); return; }
  result.hidden = true; result.classList.remove('error');
  try { validateBatch(items); } catch (error) { message(fileMessage, error.message, true); return; }
  busy = true; sync();
  document.querySelector('#upload-fields').disabled = true;
  document.querySelector('#disconnect-button').disabled = true;
  document.querySelector('.upload-panel').setAttribute('aria-busy', 'true');
  document.querySelector('#progress-panel').hidden = false;
  try {
    const saved = await store.publish(items, (value, text) => { document.querySelector('#upload-progress').value = value; document.querySelector('#progress-message').textContent = text; });
    result.replaceChildren(node('p', '', `${saved.count} 件作品已保存到网站仓库。`), node('p', '', '网站正在更新，通常需要几分钟。若暂时没看到新作品，请稍后刷新作品集。'));
    const firstWorkId = items[0].work.id;
    const base = localMode ? publicSite : new URL('.', location.href).href;
    const link = node('a', '', '查看刚上传的作品'); link.href = `${base}?work=${encodeURIComponent(firstWorkId)}&v=${encodeURIComponent(saved.sha)}#work`; link.target = '_blank'; link.rel = 'noopener'; result.append(link);
    const buildLink = node('a', '', '查看网站更新状态'); buildLink.href = 'https://github.com/tiechangchu-max/personal-site/actions'; buildLink.target = '_blank'; buildLink.rel = 'noopener noreferrer'; result.append(node('br'), buildLink);
    items.forEach(item => URL.revokeObjectURL(item.url)); items = []; renderQueue(); message(fileMessage, '');
    message(connectionMessage, '已连接，可以继续添加作品。');
  } catch (error) {
    result.classList.add('error');
    result.textContent = `${error.message || '网络连接中断，请稍后重试。'}\n文件与填写内容仍在本页，可以重试；请勿刷新页面。`;
    if (error.status === 401) { disconnect(); message(connectionMessage, '访问密钥已过期，请重新连接后发布。', true); }
  } finally {
    busy = false; result.hidden = false; document.querySelector('#upload-fields').disabled = false; document.querySelector('#disconnect-button').disabled = false; document.querySelector('.upload-panel').setAttribute('aria-busy', 'false'); sync();
  }
});
window.addEventListener('beforeunload', event => { if (busy || items.length) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => { store.disconnect(); });
window.addEventListener('pageshow', event => { if (event.persisted) { if (localMode) connectLocal(); else { disconnect(); message(connectionMessage, '页面已恢复，请重新连接网站。'); } } });
if (localMode) connectLocal();
