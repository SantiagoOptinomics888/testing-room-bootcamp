(() => {
  'use strict';

  const CONFIG = Object.freeze({
    timeZone: 'America/Bogota',
    artBars: 56,
    scrolledOffset: 24,
  });

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Deterministic pseudo-random so each card keeps the same artwork on reload.
  const seededRandom = (seed) => {
    let state = seed % 2147483647 || 1;
    return () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  };

  const barHeights = (seed, count) => {
    const random = seededRandom(seed);
    const phase = random() * Math.PI * 2;
    return Array.from({ length: count }, (_, index) => {
      const t = index / (count - 1);
      const envelope = Math.sin(t * Math.PI) ** 0.6;
      const wave = 0.5 + 0.5 * Math.sin(t * Math.PI * (4 + seed % 5) + phase);
      return Math.round(clamp((0.25 + 0.75 * wave * random()) * envelope * 100, 4, 100));
    });
  };

  const initArt = () => {
    $$('[data-art]').forEach((element) => {
      const seed = Number.parseInt(element.dataset.art, 10) || 1;
      const fragment = document.createDocumentFragment();
      barHeights(seed, CONFIG.artBars).forEach((height) => {
        const bar = document.createElement('i');
        bar.style.setProperty('--h', String(height));
        fragment.appendChild(bar);
      });
      element.prepend(fragment);
    });
  };

  const initScrollEffects = () => {
    const header = $('[data-header]');
    const root = document.documentElement;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      if (header) header.classList.toggle('is-scrolled', y > CONFIG.scrolledOffset);
      const progress = prefersReducedMotion ? 0 : clamp(y / (window.innerHeight * 0.6), 0, 1);
      root.style.setProperty('--hero-p', progress.toFixed(3));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  };

  const initReveal = () => {
    const targets = $$('[data-reveal]');
    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      targets.forEach((target) => target.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((target) => observer.observe(target));
  };

  const initMenu = () => {
    const toggle = $('[data-menu-toggle]');
    const menu = $('[data-menu]');
    const label = $('[data-menu-label]');
    if (!toggle || !menu) return;

    const background = $$('main, .footer, [data-dock]');
    const closers = [...$$('a', menu), ...$$('[data-header] a')];

    const setOpen = (open) => {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('is-locked', open);
      background.forEach((element) => { element.inert = open; });
      if (label) label.textContent = open ? 'Cerrar' : 'Menú';
      if (open) $('a', menu)?.focus();
    };

    toggle.addEventListener('click', () => setOpen(menu.hidden));
    closers.forEach((link) => link.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
  };

  const initCarousel = (track) => {
    const controls = $(`[data-carousel-ctrl="${track.dataset.carousel}"]`);
    if (!controls) return;
    const prev = $('[data-prev]', controls);
    const next = $('[data-next]', controls);
    const label = $('[data-progress-label]', controls);
    const bar = $('[data-progress-bar]', controls);

    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const overflowing = max > 4;
      controls.classList.toggle('is-active', overflowing);
      if (!overflowing) return;
      const visible = clamp((track.scrollLeft + track.clientWidth) / track.scrollWidth, 0, 1);
      bar.style.setProperty('--progress', visible.toFixed(3));
      label.textContent = `${Math.round(visible * 100)}%`;
      prev.setAttribute('aria-disabled', String(track.scrollLeft <= 2));
      next.setAttribute('aria-disabled', String(track.scrollLeft >= max - 2));
    };

    const step = (direction, button) => {
      const slide = track.firstElementChild;
      if (!slide || button.getAttribute('aria-disabled') === 'true') return;
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
      track.scrollBy({
        left: direction * (slide.getBoundingClientRect().width + gap),
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    };

    prev.addEventListener('click', () => step(-1, prev));
    next.addEventListener('click', () => step(1, next));
    track.addEventListener('scroll', () => window.requestAnimationFrame(update), { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  };

  const initDock = () => {
    const dock = $('[data-dock]');
    const hideNear = $$('#inversion, .closing, .footer');
    if (!dock || !('IntersectionObserver' in window)) return;
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      dock.classList.toggle('is-hidden', visible.size > 0);
      dock.inert = visible.size > 0;
    }, { threshold: 0.15 });
    hideNear.forEach((element) => observer.observe(element));
  };

  const initClock = () => {
    const clock = $('[data-clock]');
    if (!clock) return;
    try {
      const formatter = new Intl.DateTimeFormat('es-CO', {
        timeZone: CONFIG.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      });
      const tick = () => { clock.textContent = formatter.format(new Date()); };
      tick();
      window.setInterval(tick, 1000);
    } catch (error) {
      console.error('[testing-room] Clock unavailable:', error);
      clock.textContent = '';
    }
  };

  const init = () => {
    initArt();
    initScrollEffects();
    initReveal();
    initMenu();
    $$('[data-carousel]').forEach(initCarousel);
    initDock();
    initClock();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
