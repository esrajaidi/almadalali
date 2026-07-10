const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const loader = $('#loader');
window.addEventListener('load', () => {
  setTimeout(() => loader?.classList.add('hide'), 420);
});

const nav = $('#nav');
const menu = $('#menuToggle');
const langBtn = $('#langBtn');
let lang = 'ar';

function closeMenu() {
  nav?.classList.remove('open');
  menu?.classList.remove('active');
  menu?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

menu?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.classList.toggle('active', open);
  menu.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
});

$$('.nav a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('click', e => {
  if (innerWidth <= 1000 && nav && menu && !nav.contains(e.target) && !menu.contains(e.target)) closeMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('resize', () => { if (innerWidth > 1000) closeMenu(); });

function setLang(next) {
  lang = next;
  document.documentElement.lang = next;
  document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('en', next === 'en');
  $$('[data-ar]').forEach(el => {
    const value = el.dataset[next];
    if (value !== undefined) el.textContent = value;
  });
  if (langBtn) langBtn.textContent = next === 'ar' ? 'English' : 'العربية';
  localStorage.setItem('almad-lang', next);
  closeMenu();
}
langBtn?.addEventListener('click', () => setLang(lang === 'ar' ? 'en' : 'ar'));
const savedLang = localStorage.getItem('almad-lang');
if (savedLang === 'en') setLang('en');

// Scroll reveal with directional animation and staggered cards.
$$('.about-copy,.why-media,.contact-copy').forEach(el => el.classList.add('from-right'));
$$('.about-media,.why-copy,.quote-form').forEach(el => el.classList.add('from-left'));
$$('.products-grid .reveal,.values article,.feature-list article').forEach((el, index) => {
  el.style.transitionDelay = `${Math.min((index % 6) * 70, 350)}ms`;
});

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' })
  : null;

$$('.reveal').forEach(el => {
  if (revealObserver) revealObserver.observe(el);
  else el.classList.add('visible');
});

// Animated counters.
let counted = false;
const statsBar = $('.stats-bar');
if (statsBar && 'IntersectionObserver' in window) {
  const statObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !counted) {
      counted = true;
      $$('.counter').forEach(el => {
        const target = Number(el.dataset.target || 0);
        const start = performance.now();
        const duration = 1600;
        const tick = now => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.floor(target * eased).toLocaleString(lang === 'ar' ? 'ar-LY' : 'en-US');
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      statObserver.disconnect();
    }
  }, { threshold: 0.35 });
  statObserver.observe(statsBar);
}

// Sticky header shadow + hide on scroll down for desktop.
const header = $('.header');
let lastY = window.scrollY;
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    header?.classList.toggle('scrolled', y > 18);
    if (innerWidth > 768 && y > 180 && y > lastY + 7) header?.classList.add('header-hidden');
    else if (y < lastY - 7 || y < 180) header?.classList.remove('header-hidden');
    lastY = y;
    ticking = false;
  });
}, { passive: true });

// Active navigation section.
const sections = $$('main section[id],header[id]');
const links = $$('.nav a');
if ('IntersectionObserver' in window) {
  const spy = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
      }
    });
  }, { threshold: 0.25, rootMargin: '-25% 0px -60%' });
  sections.forEach(section => spy.observe(section));
}

// Subtle hero parallax only on pointer devices.
const heroBg = $('.hero-bg');
if (heroBg && matchMedia('(pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  $('.hero')?.addEventListener('pointermove', e => {
    const x = (e.clientX / innerWidth - 0.5) * 10;
    const y = (e.clientY / innerHeight - 0.5) * 7;
    heroBg.style.translate = `${x}px ${y}px`;
  });
  $('.hero')?.addEventListener('pointerleave', () => { heroBg.style.translate = '0 0'; });
}

const year = $('#year');
if (year) year.textContent = new Date().getFullYear();



// Secure contact form submission through the PHP backend.
const contactForm = $('#contactForm');
const submitBtn = $('#submitBtn');
const formStatus = $('#formStatus');

function showFormStatus(type, arText, enText) {
  if (!formStatus) return;
  formStatus.className = `form-status show ${type}`;
  formStatus.textContent = lang === 'ar' ? arText : enText;
}

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  formStatus?.classList.remove('show', 'success', 'error');

  if (!contactForm.checkValidity()) {
    contactForm.reportValidity();
    return;
  }

  const originalText = submitBtn?.querySelector('span')?.textContent || '';
  if (submitBtn) {
    submitBtn.disabled = true;
    const label = submitBtn.querySelector('span');
    if (label) label.textContent = lang === 'ar' ? 'جاري الإرسال...' : 'Sending...';
  }

  try {
    const response = await fetch(contactForm.action, {
      method: 'POST',
      body: new FormData(contactForm),
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || 'Send failed');

    contactForm.reset();
    showFormStatus('success', 'تم إرسال طلبك بنجاح، وسنتواصل معك قريباً.', 'Your request was sent successfully. We will contact you soon.');
  } catch (error) {
    showFormStatus('error', 'تعذر إرسال الطلب حالياً. يمكنك التواصل معنا عبر واتساب أو الهاتف.', 'The request could not be sent. Please contact us by WhatsApp or phone.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      const label = submitBtn.querySelector('span');
      if (label) label.textContent = originalText;
    }
  }
});
