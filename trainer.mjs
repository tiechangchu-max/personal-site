const viewer = document.querySelector('#case-viewer');
const image = document.querySelector('#viewer-image');
const status = document.querySelector('#viewer-status');
const previous = document.querySelector('#viewer-previous');
const next = document.querySelector('#viewer-next');
const buttons = [...document.querySelectorAll('[data-case-image]')];
let active = 0, returnFocus;

function showImage(index) {
  active = index;
  const button = buttons[index];
  status.hidden = false;
  status.textContent = '正在加载图片…';
  image.alt = button.dataset.title;
  image.src = button.dataset.full;
  document.querySelector('#viewer-title').textContent = button.dataset.title;
  document.querySelector('#viewer-count').textContent = `${String(index + 1).padStart(2, '0')} / ${buttons.length}`;
  document.querySelector('#viewer-original').href = button.dataset.original;
  previous.disabled = index === 0;
  next.disabled = index === buttons.length - 1;
  viewer.scrollTop = 0;
}
buttons.forEach((button, index) => button.addEventListener('click', () => {
  returnFocus = button;
  showImage(index);
  viewer.showModal();
  document.body.classList.add('tc-viewer-open');
}));
image.addEventListener('load', () => { status.hidden = true; });
image.addEventListener('error', () => { status.hidden = false; status.textContent = '图片暂未加载，可以点击“查看原图”。'; });
document.querySelector('#viewer-close').addEventListener('click', () => viewer.close());
previous.addEventListener('click', () => { if (active > 0) showImage(active - 1); });
next.addEventListener('click', () => { if (active < buttons.length - 1) showImage(active + 1); });
viewer.addEventListener('close', () => {
  document.body.classList.remove('tc-viewer-open');
  image.removeAttribute('src');
  returnFocus?.focus();
});
viewer.addEventListener('click', event => {
  if (event.target !== viewer) return;
  const rect = viewer.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) viewer.close();
});
document.addEventListener('keydown', event => {
  if (!viewer.open) return;
  if (event.key === 'ArrowLeft' && active > 0) { event.preventDefault(); showImage(active - 1); }
  if (event.key === 'ArrowRight' && active < buttons.length - 1) { event.preventDefault(); showImage(active + 1); }
});
