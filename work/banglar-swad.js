/* ══════════════════════════════════════════
   GO MATA GHEE — CASE STUDY ANIMATIONS
   ══════════════════════════════════════════ */

(function() {
  'use strict';

  // Custom cursor logic is handled by parent adsvise.js

  // ─── SCROLL PROGRESS BAR ───
  const progressBar = document.getElementById('scrollProgress');
  function updateProgress() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;
    if (progressBar) progressBar.style.width = scrollPercent + '%';
  }

  // Header scroll state is handled by parent adsvise.js

  // ─── HERO ENTRANCE ANIMATION ───
  function animateHero() {
    const heroLabel = document.getElementById('heroLabel');
    const heroTitle = document.getElementById('heroTitle');
    const heroSubtitle = document.getElementById('heroSubtitle');

    // Animate label
    if (heroLabel) {
      setTimeout(() => {
        heroLabel.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        heroLabel.style.opacity = '1';
        heroLabel.style.transform = 'translateY(0)';
      }, 300);
    }

    // Animate title lines
    if (heroTitle) {
      const lines = heroTitle.querySelectorAll('.line span');
      lines.forEach((span, i) => {
        setTimeout(() => {
          span.style.transition = 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)';
          span.style.opacity = '1';
          span.style.transform = 'translateY(0)';
        }, 500 + i * 180);
      });
    }

    // Animate subtitle
    if (heroSubtitle) {
      setTimeout(() => {
        heroSubtitle.style.transition = 'opacity 1s ease, transform 1s ease';
        heroSubtitle.style.opacity = '1';
        heroSubtitle.style.transform = 'translateY(0)';
      }, 1200);
    }
  }

  // ─── INTERSECTION OBSERVER FOR SCROLL REVEALS ───
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        // Don't unobserve — let it stay visible
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  // Observe all reveal elements
  function initScrollReveals() {
    const revealElements = document.querySelectorAll(
      '.reveal-up, .reveal-scale, .reveal-left, .reveal-right, ' +
      '.cs-text-block, .cs-meta__item, .cs-image-grid__item, ' +
      '.cs-split__text, .cs-split__image, .cs-poster__frame, ' +
      '.cs-video__wrapper, .cs-stat, .cs-divider, .cs-hr, ' +
      '.cs-quote__mark, .cs-quote__text, .cs-quote__author, ' +
      '.cs-logo-showcase__inner, .cs-clip-reveal'
    );

    revealElements.forEach(el => {
      revealObserver.observe(el);
    });
  }

  // ─── PARALLAX EFFECT ───
  function updateParallax() {
    const parallaxElements = document.querySelectorAll('.cs-parallax img');
    const scrollTop = window.pageYOffset;
    
    parallaxElements.forEach(img => {
      const parent = img.parentElement;
      const rect = parent.getBoundingClientRect();
      const speed = 0.3;
      
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const offset = (rect.top * speed);
        img.style.transform = `translateY(${offset}px)`;
      }
    });
  }

  // ─── SMOOTH NUMBER COUNTER ANIMATION ───
  function animateCounters() {
    const counters = document.querySelectorAll('.cs-stat__number');
    counters.forEach(counter => {
      if (counter.dataset.animated) return;
      
      const rect = counter.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        counter.dataset.animated = 'true';
        const text = counter.textContent;
        // Only animate if it's a pure number
        const num = parseInt(text);
        if (!isNaN(num) && num > 0) {
          let current = 0;
          const increment = num / 40;
          const timer = setInterval(() => {
            current += increment;
            if (current >= num) {
              counter.textContent = text; // restore original text
              clearInterval(timer);
            } else {
              counter.textContent = Math.floor(current) + (text.includes('%') ? '%' : '');
            }
          }, 30);
        }
      }
    });
  }

  // ─── SMOOTH SCROLL HANDLER ───
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateProgress();
        updateParallax();
        animateCounters();
        ticking = false;
      });
      ticking = true;
    }
  }

  // ─── LENIS-STYLE SMOOTH SCROLL (lightweight) ───
  let scrollAnimationId;
  let currentScroll = 0;
  let targetScroll = 0;

  // ─── INITIALIZE ───
  window.addEventListener('scroll', onScroll, { passive: true });
  
  window.addEventListener('DOMContentLoaded', () => {
    animateHero();
    initScrollReveals();
    updateProgress();

    // Initial parallax
    updateParallax();
  });

  // Fallback for already loaded content
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
      animateHero();
      initScrollReveals();
      updateProgress();
    }, 100);
  }

})();
