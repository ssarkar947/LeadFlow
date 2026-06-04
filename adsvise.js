document.addEventListener('DOMContentLoaded', () => {

  /* ═══════════════════════════════════════════
     HERO WAVES ANIMATION TRIGGER
     ═══════════════════════════════════════════ */
  (function initHeroWaves() {
    setTimeout(() => {
      const heroWaves = document.getElementById('hero-waves');
      if (heroWaves) heroWaves.classList.add('is-flowing');
    }, 1000);
  })();


  /* ═══════════════════════════════════════════
     MOBILE MENU
     ═══════════════════════════════════════════ */
  const toggle = document.getElementById('adv-menu-toggle');
  const overlay = document.getElementById('mobile-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');

  if (toggle && overlay) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('is-active');
      overlay.classList.toggle('is-active');
      document.body.style.overflow = overlay.classList.contains('is-active') ? 'hidden' : '';
    });
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('is-active');
        overlay.classList.remove('is-active');
        document.body.style.overflow = '';
      });
    });
  }


  /* ═══════════════════════════════════════════
     HEADER SCROLL EFFECT
     ═══════════════════════════════════════════ */
  const header = document.getElementById('adv-header');
  function checkHeaderScroll() {
    if (window.scrollY > 80) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  window.addEventListener('scroll', checkHeaderScroll, { passive: true });
  checkHeaderScroll();


  /* ═══════════════════════════════════════════
     SCROLL REVEAL (IntersectionObserver)
     ═══════════════════════════════════════════ */
  const revealEls = document.querySelectorAll('.reveal-fade');
  if (revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => observer.observe(el));
  }


  /* ═══════════════════════════════════════════
     SERVICES ACCORDION
     ═══════════════════════════════════════════ */
  document.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const wasOpen = item.classList.contains('is-open');
      document.querySelectorAll('.accordion-item.is-open').forEach(i => i.classList.remove('is-open'));
      if (!wasOpen) item.classList.add('is-open');
    });
  });


  /* ═══════════════════════════════════════════
     PARALLAX "HOW WE ROLL" TEXT
     ═══════════════════════════════════════════ */
  const rollLines = document.querySelectorAll('.roll-line');
  if (rollLines.length) {
    let ticking = false;
    function updateParallax() {
      const scrollY = window.scrollY;
      const section = document.querySelector('.adv-how-we-roll');
      if (!section) return;
      const sTop = section.offsetTop;
      const sH = section.offsetHeight;
      const vBottom = scrollY + window.innerHeight;
      if (vBottom > sTop && scrollY < sTop + sH) {
        const progress = (vBottom - sTop) / (window.innerHeight + sH);
        rollLines.forEach((line, i) => {
          const speed = (i % 2 === 0) ? 1 : -1;
          const offset = (progress - 0.5) * speed * 400;
          line.style.transform = `translateX(${offset}px)`;
        });
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(updateParallax); ticking = true; }
    }, { passive: true });
    updateParallax();
  }

});
