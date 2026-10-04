import { validateIndex } from './media-store.mjs';

const grid = document.querySelector('#library-grid');
const status = document.querySelector('#library-status');
const category = document.querySelector('#work-category');
const more = document.querySelector('#library-more');
const retry = document.querySelector('#library-retry');
const dialog = document.querySelector('#work-detail');
const media = document.querySelector('#detail-media');
const copyButton = document.querySelector('#copy-prompt');
let works = [], filter = 'all', limit = 12, currentPrompt = '', previousFocus;
const wantedId = new URL(location.href).searchParams.get('work');
let wantedOpened = false, refreshing = false, lastChecked = 0, refreshTimer;
const openedAt = Date.now();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function openDetail(work) {
  previousFocus = document.activeElement;
  media.replaceChildren();
  if (work.type === 'video') {
    const video = element('video'); video.src = work.src; video.controls = true; video.playsInline = true; video.preload = 'metadata'; if (work.poster) video.poster = work.poster; video.setAttribute('aria-label', work.title); media.append(video);
  } else { const img = element('img'); img.src = work.src; img.alt = work.description || work.title; media.append(img); }
  document.querySelector('#detail-title').textContent = work.title;
  document.querySelector('#detail-category').textContent = `${work.category} · ${work.type === 'video' ? '视频' : '图片'}`;
  document.querySelector('#detail-description').textContent = work.description;
  currentPrompt = work.prompt;
  document.querySelector('#detail-prompt').textContent = work.prompt || '这件作品尚未附上提示词。';
  copyButton.hidden = !work.prompt;
  document.querySelector('#copy-status').textContent = '';
  dialog.showModal(); document.body.classList.add('detail-open');
}
function closeDetail() { dialog.close(); }
dialog.querySelector('.detail-close').addEventListener('click', closeDetail);
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDetail(); } });
dialog.addEventListener('close', () => { media.querySelector('video')?.pause(); media.replaceChildren(); document.body.classList.remove('detail-open'); previousFocus?.focus(); });
copyButton.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(currentPrompt); document.querySelector('#copy-status').textContent = '提示词已复制。'; }
  catch { document.querySelector('#copy-status').textContent = '浏览器未允许复制，请长按或选中提示词手动复制。'; }
});

function render() {
  const visible = works.filter(work => (filter === 'all' || (filter === 'prompt' ? Boolean(work.prompt.trim()) : work.type === filter)) && (category.value === 'all' || work.category === category.value));
  grid.replaceChildren();
  for (const [index, work] of visible.slice(0, limit).entries()) {
    const button = element('button', 'library-card'); button.type = 'button'; button.setAttribute('aria-label', `查看作品：${work.title}`);
    const cover = element('div', 'library-cover');
    if (work.poster || work.type === 'image') {
      const loading = element('span', 'media-loading', '正在加载图片…'); cover.append(loading);
      const img = element('img'); img.alt = work.title; img.loading = index < 3 ? 'eager' : 'lazy'; img.decoding = 'async';
      img.addEventListener('load', () => loading.remove());
      img.addEventListener('error', () => { loading.textContent = '图片暂未加载，点击查看详情'; });
      img.src = work.poster || work.src; cover.append(img);
    } else {
      const video = element('video'); video.src = `${work.src}#t=0.1`; video.preload = 'metadata'; video.muted = true; video.playsInline = true; video.setAttribute('aria-hidden', 'true'); cover.append(video);
    }
    cover.append(element('span', 'library-kind', work.type === 'video' ? '▶ 视频' : work.src.endsWith('.gif') ? 'GIF 动图' : '图片'));
    const age = Date.now() - Date.parse(work.createdAt);
    if (age >= 0 && age < 7 * 24 * 60 * 60 * 1000) cover.append(element('span', 'library-new', '新上传'));
    const caption = element('div', 'library-caption'); caption.append(element('small', '', work.category), element('h3', '', work.title));
    if (work.prompt.trim()) caption.append(element('span', 'has-prompt', '含提示词'));
    button.append(cover, caption); button.addEventListener('click', () => openDetail(work)); grid.append(button);
  }
  status.textContent = visible.length ? `${visible.length} 件作品 · 已显示 ${Math.min(limit, visible.length)} 件` : '这个分类下还没有作品。试试其他分类。';
  more.hidden = visible.length <= limit;
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter; limit = 12;
  document.querySelectorAll('[data-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === button))); render();
}));
category.addEventListener('change', () => { limit = 12; render(); });
more.addEventListener('click', () => { limit += 12; render(); });
async function load({ quiet = false } = {}) {
  if (refreshing) return;
  refreshing = true;
  const refresh = document.querySelector('#library-refresh'); refresh.disabled = true;
  if (!quiet) status.textContent = '正在加载作品…'; retry.hidden = true;
  try {
    const response = await fetch(`./data/works.json?updated=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('load');
    const next = validateIndex(await response.json()).works;
    lastChecked = Date.now();
    const changed = JSON.stringify(next) !== JSON.stringify(works);
    works = next;
    const selectedCategory = category.value;
    category.replaceChildren(new Option('全部分类', 'all'));
    [...new Set(works.map(work => work.category))].forEach(name => category.add(new Option(name, name)));
    if ([...category.options].some(option => option.value === selectedCategory)) category.value = selectedCategory;
    if (!quiet || changed) render();
    if (wantedId && !wantedOpened) {
      const wanted = works.find(work => work.id === wantedId);
      if (wanted && !dialog.open) { wantedOpened = true; openDetail(wanted); clearTimeout(refreshTimer); }
      else if (!wanted && Date.now() - openedAt < 10 * 60 * 1000) {
        status.textContent = '刚上传的作品正在发布，页面会自动显示，请稍候…';
        clearTimeout(refreshTimer); refreshTimer = setTimeout(() => load({ quiet: true }), 15000);
      } else if (!wanted) { status.textContent = '暂时还没找到这件新作品，请点击“刷新作品”再检查。'; }
    }
  } catch {
    if (!quiet || !works.length) { status.textContent = '作品库暂时无法加载，请重试。下方仍可查看原有案例。'; retry.hidden = false; }
    if (wantedId && !wantedOpened && Date.now() - openedAt < 10 * 60 * 1000) { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => load({ quiet: true }), 15000); }
  } finally { refreshing = false; refresh.disabled = false; }
}
retry.addEventListener('click', () => load());
document.querySelector('#library-refresh').addEventListener('click', () => {
  filter = 'all'; limit = 12; category.value = 'all';
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === 'all')));
  load();
});
function refreshOnReturn() { if (document.visibilityState === 'visible' && Date.now() - lastChecked > 15000) load({ quiet: true }); }
window.addEventListener('focus', refreshOnReturn);
document.addEventListener('visibilitychange', refreshOnReturn);
load();
