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
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  const accordionItems = document.querySelectorAll('.accordion-item');

  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const parentItem = header.parentElement;
      const wasActive = parentItem.classList.contains('active');
      
      // Close all accordions
      accordionItems.forEach(item => {
        item.classList.remove('active');
        item.querySelector('.accordion-body').style.maxHeight = null;
      });
      
      // If wasn't active, open it
      if (!wasActive) {
        parentItem.classList.add('active');
        const body = parentItem.querySelector('.accordion-body');
        body.style.maxHeight = body.scrollHeight + "px";
      }
    });
  });

  // ═══════════════════════════════════════════
  // MODAL LOGIC
  // ═══════════════════════════════════════════
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
      document.body.style.overflow = 'hidden'; // Prevent scrolling
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
