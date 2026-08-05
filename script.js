const root = document.documentElement;
const body = document.body;
const header = document.querySelector('.site-header');
const themeToggle = document.querySelector('.theme-toggle');
const menuToggle = document.querySelector('.menu-toggle');
const mobileLinks = document.querySelectorAll('.mobile-nav a');

const savedTheme = localStorage.getItem('personal-site-theme');
const preferredDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (savedTheme === 'dark' || (!savedTheme && preferredDark)) {
  root.dataset.theme = 'dark';
}

function updateThemeLabel() {
  const dark = root.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-label', dark ? '切换明亮主题' : '切换深色主题');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#161616' : '#f4f0e8');
}

updateThemeLabel();

themeToggle.addEventListener('click', () => {
  const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = nextTheme;
  localStorage.setItem('personal-site-theme', nextTheme);
  updateThemeLabel();
});

function closeMenu() {
  body.classList.remove('menu-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', '打开导航菜单');
}

menuToggle.addEventListener('click', () => {
  const willOpen = !body.classList.contains('menu-open');
  body.classList.toggle('menu-open', willOpen);
  menuToggle.setAttribute('aria-expanded', String(willOpen));
  menuToggle.setAttribute('aria-label', willOpen ? '关闭导航菜单' : '打开导航菜单');
});

mobileLinks.forEach((link) => link.addEventListener('click', closeMenu));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

const lightbox = document.querySelector('.image-lightbox');
const lightboxImage = lightbox.querySelector('img');
const lightboxCaption = lightbox.querySelector('figcaption');
const lightboxClose = lightbox.querySelector('.lightbox-close');
let lastGalleryTrigger = null;

function closeLightbox() {
  if (!lightbox.classList.contains('open')) return;
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  body.classList.remove('lightbox-open');
  lightboxImage.removeAttribute('src');
  if (lastGalleryTrigger) lastGalleryTrigger.focus();
}

document.querySelectorAll('.gallery-trigger').forEach((trigger) => {
  trigger.addEventListener('click', () => {
    lastGalleryTrigger = trigger;
    lightboxImage.src = trigger.dataset.image;
    lightboxImage.alt = trigger.dataset.caption;
    lightboxCaption.textContent = trigger.dataset.caption;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    body.classList.add('lightbox-open');
    lightboxClose.focus();
  });
});

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeLightbox();
});

function updateHeader() {
  header.classList.toggle('scrolled', window.scrollY > 24);
}

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px' },
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    revealObserver.observe(item);
  });
} else {
  revealItems.forEach((item) => item.classList.add('visible'));
}

document.getElementById('current-year').textContent = new Date().getFullYear();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lazyVideos = document.querySelectorAll('video[data-src]');

function loadVideo(video) {
  if (video.src) return;
  video.src = video.dataset.src;
  video.load();
  if (reduceMotion) {
    video.addEventListener('canplay', () => video.pause(), { once: true });
  } else {
    const playPromise = video.play();
    if (playPromise) playPromise.catch(() => {});
  }
}

if ('IntersectionObserver' in window) {
  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadVideo(entry.target);
          videoObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '350px 0px' },
  );
  lazyVideos.forEach((video) => videoObserver.observe(video));
} else {
  lazyVideos.forEach(loadVideo);
}

const animatedImages = document.querySelectorAll('img[data-animated-src]');

function loadAnimatedImage(img) {
  if (img.dataset.animationLoaded) return;
  img.src = img.dataset.animatedSrc;
  img.dataset.animationLoaded = 'true';
}

if ('IntersectionObserver' in window) {
  const animatedImageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadAnimatedImage(entry.target);
          animatedImageObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '400px 0px' },
  );
  animatedImages.forEach((img) => animatedImageObserver.observe(img));
} else {
  animatedImages.forEach(loadAnimatedImage);
}

const visual = document.querySelector('.hero-visual');
const profileCard = document.querySelector('.profile-card');

if (window.matchMedia('(pointer: fine)').matches) {
  visual.addEventListener('pointermove', (event) => {
    const bounds = visual.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    profileCard.style.transform = `translate(-50%, -50%) rotate(${3.5 + x * 3}deg) translate(${x * 8}px, ${y * 8}px)`;
  });

  visual.addEventListener('pointerleave', () => {
    profileCard.style.removeProperty('transform');
  });
}
