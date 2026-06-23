document.addEventListener('DOMContentLoaded', () => {

  /* ═══════════════════════════════════════════
     #1 — CUSTOM ANIMATED CURSOR
     ═══════════════════════════════════════════ */
  const cursorDot  = document.getElementById('cursor-dot');
  const cursorRing = document.getElementById('cursor-ring');

  if (cursorDot && cursorRing && window.matchMedia('(hover: hover)').matches) {
    let ringX = 0, ringY = 0;
    let dotX  = 0, dotY  = 0;

    document.addEventListener('mousemove', (e) => {
      dotX = e.clientX;
      dotY = e.clientY;
      cursorDot.style.left  = dotX + 'px';
      cursorDot.style.top   = dotY + 'px';
    });

    // Ring lags behind with lerp
    (function animateRing() {
      ringX += (dotX - ringX) * 0.12;
      ringY += (dotY - ringY) * 0.12;
      cursorRing.style.left = ringX + 'px';
      cursorRing.style.top  = ringY + 'px';
      requestAnimationFrame(animateRing);
    })();
  }


  /* ═══════════════════════════════════════════
     #2 — CURSOR-TRACKED HERO GLOW
     ═══════════════════════════════════════════ */
  const heroGlow = document.getElementById('hero-cursor-glow');
  const heroSection = document.getElementById('hero');
  if (heroGlow && heroSection) {
    heroSection.addEventListener('mousemove', (e) => {
      const rect = heroSection.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      heroGlow.style.transform = `translate(${x - 350}px, ${y - 350}px)`;
    });
  }


  /* ═══════════════════════════════════════════
     #2.5 — VALUE CARDS HOVER SHINE EFFECT
     ═══════════════════════════════════════════ */
  document.querySelectorAll('.value-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });


  /* ═══════════════════════════════════════════
     #3 — WORD-CYCLE HEADLINE ANIMATION
     ═══════════════════════════════════════════ */
  const cyclingWord = document.getElementById('cycling-word');
  if (cyclingWord) {
    const words = ['Boldly.', 'Creatively.', 'At Scale.', 'Rapidly.', 'Bespoke.'];
    let currentIndex = 0;
    let cycling = false;

    // Phase timings (must total well under 1000ms)
    const EXIT_DURATION  = 120; // ms — slide up + fade out
    const ENTER_DURATION = 220; // ms — slide up + fade in

    function cycleWord() {
      if (cycling) return;
      cycling = true;

      // — Phase 1: EXIT — slide up & fade out
      cyclingWord.style.transition = `opacity ${EXIT_DURATION}ms ease, transform ${EXIT_DURATION}ms ease`;
      cyclingWord.style.opacity    = '0';
      cyclingWord.style.transform  = 'translateY(-14px)';

      setTimeout(() => {
        // — Phase 2: SNAP — change word, reposition below instantly (no transition)
        currentIndex = (currentIndex + 1) % words.length;
        cyclingWord.textContent    = words[currentIndex];
        cyclingWord.style.transition = 'none';
        cyclingWord.style.transform  = 'translateY(14px)';
        cyclingWord.style.opacity    = '0';

        // Force reflow so browser registers the new position before animating
        void cyclingWord.offsetWidth;

        // — Phase 3: ENTER — slide up & fade in
        cyclingWord.style.transition = `opacity ${ENTER_DURATION}ms ease, transform ${ENTER_DURATION}ms cubic-bezier(0.16,1,0.3,1)`;
        cyclingWord.style.opacity    = '1';
        cyclingWord.style.transform  = 'translateY(0)';

        setTimeout(() => { cycling = false; }, ENTER_DURATION);
      }, EXIT_DURATION + 10); // tiny buffer after exit completes
    }

    // Initial style
    cyclingWord.style.display    = 'inline-block';
    cyclingWord.style.color      = 'var(--brand-blue)';
    cyclingWord.style.opacity    = '1';
    cyclingWord.style.transform  = 'translateY(0)';

    setInterval(cycleWord, 1000);
  }


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
     #4 — BENTO STATS COUNT-UP ANIMATION
     ═══════════════════════════════════════════ */
  const bentoNumbers = document.querySelectorAll('.bento-number[data-count-to]');
  if (bentoNumbers.length) {
    const bentoObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el       = entry.target;
        const target   = parseInt(el.dataset.countTo, 10);
        const prefix   = el.dataset.prefix  || '';
        const suffix   = el.dataset.suffix  || '';
        const duration = 1800;
        const start    = performance.now();

        function update(now) {
          const elapsed  = now - start;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased    = 1 - Math.pow(1 - progress, 3);
          const current  = Math.floor(eased * target);
          el.textContent = prefix + current + suffix;
          if (progress < 1) requestAnimationFrame(update);
          else el.textContent = prefix + target + suffix;
        }

        requestAnimationFrame(update);
        obs.unobserve(el);
      });
    }, { threshold: 0.5 });

    bentoNumbers.forEach(el => bentoObserver.observe(el));
  }


  /* ═══════════════════════════════════════════
     LAZY-LOAD YOUTUBE IFRAMES
     ═══════════════════════════════════════════ */
  const lazyIframes = document.querySelectorAll('iframe[data-src]');
  if (lazyIframes.length) {
    const iframeObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const iframe = entry.target;
          iframe.src = iframe.dataset.src;
          iframe.removeAttribute('data-src');
          obs.unobserve(iframe);
        }
      });
    }, { rootMargin: '200px 0px' });
    lazyIframes.forEach(iframe => iframeObserver.observe(iframe));
  }


  /* ═══════════════════════════════════════════
     VIDZY SERVICES ACCORDION
     ═══════════════════════════════════════════ */
  const vidzyAccordHeads = document.querySelectorAll('.vidzy-accod-head');

  vidzyAccordHeads.forEach(head => {
    head.addEventListener('click', () => {
      const parentPanel = head.parentElement;
      const accordBlock = parentPanel.parentElement;
      const wasActive = parentPanel.classList.contains('active');

      // Close all panels in this specific accordion block
      const allPanels = accordBlock.querySelectorAll('.vidzy-accod-panel');
      allPanels.forEach(panel => {
        panel.classList.remove('active');
        const content = panel.querySelector('.vidzy-accod-content');
        if (content) content.style.maxHeight = null;
        const icon = panel.querySelector('.vidzy-icon');
        if (icon) icon.innerHTML = '+';
      });

      // If it wasn't active before, open it now
      if (!wasActive) {
        parentPanel.classList.add('active');
        const content = parentPanel.querySelector('.vidzy-accod-content');
        if (content) {
          content.style.maxHeight = content.scrollHeight + "px";
        }
        const icon = parentPanel.querySelector('.vidzy-icon');
        if (icon) icon.innerHTML = '&minus;';
      }
    });
  });

  // Initialize open panels
  document.querySelectorAll('.vidzy-accod-panel.active').forEach(panel => {
    const content = panel.querySelector('.vidzy-accod-content');
    if (content) content.style.maxHeight = content.scrollHeight + "px";
  });



  /* ═══════════════════════════════════════════
     MODAL LOGIC
     ═══════════════════════════════════════════ */
  const modalOverlay = document.getElementById('lead-modal-overlay');
  if (modalOverlay) {
    const openBtns = document.querySelectorAll('.open-lead-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const successCloseBtn = document.getElementById('modal-close-success');
    const leadForm = document.getElementById('lead-capture-form');
    const successMsg = document.getElementById('lead-success-msg');
    const submitBtn = document.getElementById('lead-submit-btn');

    function openModal(e) {
      if (e) e.preventDefault();
      modalOverlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    
    function closeModal() {
      modalOverlay.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => {
        leadForm.style.display = 'block';
        successMsg.style.display = 'none';
        leadForm.reset();
      }, 300);
    }

    openBtns.forEach(btn => btn.addEventListener('click', openModal));
    closeBtn.addEventListener('click', closeModal);
    successCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;

      const payload = {
        name: document.getElementById('lead-name').value,
        company: document.getElementById('lead-company').value,
        phone: document.getElementById('lead-phone').value,
        email: document.getElementById('lead-email').value,
        companySize: document.getElementById('lead-size').value,
        source: 'Get in touch'
      };

      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          leadForm.style.display = 'none';
          successMsg.style.display = 'block';
        } else {
          alert('Something went wrong. Please try again or email us directly.');
        }
      } catch (err) {
        alert('Network error. Please try again.');
      } finally {
        submitBtn.textContent = 'Submit Details';
        submitBtn.disabled = false;
      }
    });
  }


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
