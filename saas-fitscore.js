/**
 * SaaS FitScore — Client-Side Application Logic
 * AdsVise Growth Intelligence
 */

document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════════
  // 1. QUESTIONNAIRE STEP MANAGEMENT & VALIDATION
  // ═══════════════════════════════════════════
  const step1Pane = document.getElementById('step-1-pane');
  const step2Pane = document.getElementById('step-2-pane');
  const step1Indicator = document.getElementById('step-1-indicator');
  const step2Indicator = document.getElementById('step-2-indicator');
  const toStep2Btn = document.getElementById('to-step-2-btn');
  const backToStep1Btn = document.getElementById('back-to-step-1-btn');
  const questionnaireForm = document.getElementById('saas-fitscore-form');
  const processingScreen = document.getElementById('processing-screen');
  const reportContainer = document.getElementById('report-container');
  const questionnaireWrapper = document.getElementById('questionnaire-wrapper');

  // Interactive Chip Selection Helper
  document.querySelectorAll('.chip-label').forEach(label => {
    label.addEventListener('click', (e) => {
      const input = label.querySelector('input');
      if (!input) return;

      if (input.type === 'checkbox') {
        // Checkbox toggle
        label.classList.toggle('is-selected', input.checked);
      } else if (input.type === 'radio') {
        // Radio toggle: clear siblings with same name
        const name = input.name;
        document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
          const parent = radio.closest('.chip-label, .radio-tile');
          if (parent) parent.classList.remove('is-selected');
        });
        if (input.checked) {
          label.classList.add('is-selected');
        }
      }
    });
  });

  // Radio Tile Selection Helper
  document.querySelectorAll('.radio-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const input = tile.querySelector('input[type="radio"]');
      if (!input) return;
      input.checked = true;
      const name = input.name;
      document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
        const parent = radio.closest('.radio-tile, .chip-label');
        if (parent) parent.classList.remove('is-selected');
      });
      tile.classList.add('is-selected');
    });
  });

  // URL normalizer helper
  function cleanUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  // Step 1 Validation
  function validateStep1() {
    let isValid = true;
    const name = document.getElementById('founder-name');
    const email = document.getElementById('work-email');
    const company = document.getElementById('company-name');
    const website = document.getElementById('saas-website');
    const productDo = document.getElementById('product-description');
    const idealCustomer = document.getElementById('ideal-customer');
    const businessModel = document.querySelector('input[name="businessModel"]:checked');
    const pricingModel = document.querySelector('input[name="pricingModel"]:checked');

    // Simple email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    [name, email, company, website, productDo, idealCustomer].forEach(input => {
      if (!input.value.trim()) {
        input.style.borderColor = '#ef4444';
        isValid = false;
      } else {
        input.style.borderColor = '';
      }
    });

    if (email.value.trim() && !emailRegex.test(email.value.trim())) {
      email.style.borderColor = '#ef4444';
      isValid = false;
    }

    if (!businessModel) {
      document.getElementById('business-model-error').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('business-model-error').style.display = 'none';
    }

    if (!pricingModel) {
      document.getElementById('pricing-model-error').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('pricing-model-error').style.display = 'none';
    }

    return isValid;
  }

  if (toStep2Btn) {
    toStep2Btn.addEventListener('click', () => {
      if (validateStep1()) {
        step1Pane.style.display = 'none';
        step2Pane.style.display = 'block';
        step1Indicator.classList.remove('is-active');
        step1Indicator.classList.add('is-completed');
        step2Indicator.classList.add('is-active');

        // Smooth scroll to top of questionnaire
        const formElem = document.getElementById('assessment-section');
        if (formElem) {
          formElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  if (backToStep1Btn) {
    backToStep1Btn.addEventListener('click', () => {
      step2Pane.style.display = 'none';
      step1Pane.style.display = 'block';
      step2Indicator.classList.remove('is-active');
      step1Indicator.classList.remove('is-completed');
      step1Indicator.classList.add('is-active');

      const formElem = document.getElementById('assessment-section');
      if (formElem) {
        formElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // ═══════════════════════════════════════════
  // 2. FORM SUBMISSION & ASYNC PIPELINE WIRING
  // ═══════════════════════════════════════════
  if (questionnaireForm) {
    questionnaireForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validate Step 2
      const challenges = Array.from(document.querySelectorAll('input[name="growthChallenge"]:checked')).map(el => el.value);
      const dropOff = document.querySelector('input[name="dropOff"]:checked');
      const signups = document.querySelector('input[name="monthlySignups"]:checked');
      const conversion = document.querySelector('input[name="freeToPaidConversion"]:checked');
      const mrr = document.querySelector('input[name="approxMrr"]:checked');
      const consent = document.getElementById('consent-checkbox');

      let isValid = true;

      if (challenges.length === 0) {
        document.getElementById('growth-challenge-error').style.display = 'block';
        isValid = false;
      } else {
        document.getElementById('growth-challenge-error').style.display = 'none';
      }

      if (!dropOff || !signups || !conversion || !mrr) {
        alert('Please complete all multiple choice questions in Step 2.');
        isValid = false;
      }

      if (!consent || !consent.checked) {
        alert('Please accept the consent terms to proceed with website analysis.');
        isValid = false;
      }

      if (!isValid) return;

      // Collect payload
      const payload = {
        name: document.getElementById('founder-name').value.trim(),
        email: document.getElementById('work-email').value.trim(),
        company: document.getElementById('company-name').value.trim(),
        websiteUrl: cleanUrl(document.getElementById('saas-website').value),
        productDescription: document.getElementById('product-description').value.trim(),
        idealCustomer: document.getElementById('ideal-customer').value.trim(),
        businessModel: document.querySelector('input[name="businessModel"]:checked').value,
        pricingModel: document.querySelector('input[name="pricingModel"]:checked').value,
        competitors: document.getElementById('competitors')?.value.trim() || '',
        category: document.getElementById('category')?.value.trim() || '',
        challenges: challenges,
        dropOff: dropOff.value,
        monthlySignups: signups.value,
        freeToPaidConversion: conversion.value,
        approxMrr: mrr.value,
        next90DaysGoal: document.getElementById('goal-90-days')?.value.trim() || '',
        consentGranted: true,
        submittedAt: new Date().toISOString()
      };

      // Hide form, show processing screen
      questionnaireWrapper.style.display = 'none';
      processingScreen.style.display = 'block';
      processingScreen.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Check if backend API exists, else run smooth client progression
      try {
        const response = await fetch('/api/saas-fitscore/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.diagnosticId) {
            pollDiagnosticStatus(resData.diagnosticId);
            return;
          }
        }
      } catch (err) {
        console.log('[Notice] Backend API connecting or local preview mode. Running visual simulation.');
      }

      // Visual Simulation fallback for Stage 2 preview
      runVisualDiagnosticSimulation(payload);
    });
  }

  // Visual simulation for Stage 2 presentation
  function runVisualDiagnosticSimulation(payload) {
    const stageItems = [
      document.getElementById('stage-1-item'),
      document.getElementById('stage-2-item'),
      document.getElementById('stage-3-item'),
      document.getElementById('stage-4-item')
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage < stageItems.length) {
        if (stageItems[currentStage]) {
          stageItems[currentStage].classList.remove('active');
          stageItems[currentStage].classList.add('done');
          const icon = stageItems[currentStage].querySelector('span');
          if (icon) icon.innerHTML = '✓';
        }
        currentStage++;
        if (currentStage < stageItems.length && stageItems[currentStage]) {
          stageItems[currentStage].classList.add('active');
        }
      } else {
        clearInterval(interval);
        setTimeout(() => {
          processingScreen.style.display = 'none';
          renderScorecard(payload);
        }, 800);
      }
    }, 1200);
  }

  // Status Polling for Stage 3-5 real backend execution
  async function pollDiagnosticStatus(diagnosticId) {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/saas-fitscore/status/${diagnosticId}`);
        if (res.ok) {
          const statusData = await res.json();
          if (statusData.stage) {
            updateProcessingStages(statusData.stage);
          }
          if (statusData.status === 'completed' && statusData.report) {
            clearInterval(pollInterval);
            processingScreen.style.display = 'none';
            renderScorecardWithReport(statusData.report);
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            alert('Analysis error: ' + (statusData.error || 'Please try again.'));
            questionnaireWrapper.style.display = 'block';
            processingScreen.style.display = 'none';
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 2500);
  }

  function updateProcessingStages(stage) {
    const stages = ['registered', 'crawled', 'analyzed', 'scored'];
    const idx = stages.indexOf(stage);
    for (let i = 0; i <= idx; i++) {
      const item = document.getElementById(`stage-${i + 1}-item`);
      if (item) {
        item.classList.add('done');
        const icon = item.querySelector('span');
        if (icon) icon.innerHTML = '✓';
      }
    }
  }

  // ═══════════════════════════════════════════
  // 3. SCORECARD & REPORT RENDERER
  // ═══════════════════════════════════════════
  function renderScorecard(payload) {
    reportContainer.style.display = 'block';
    reportContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Populate client company name
    const compEls = document.querySelectorAll('.report-company-name');
    compEls.forEach(el => el.textContent = payload.company || 'Your SaaS');

    const websiteEls = document.querySelectorAll('.report-website-url');
    websiteEls.forEach(el => el.textContent = payload.websiteUrl || 'yourdomain.com');

    // Animate progress bars
    setTimeout(() => {
      document.querySelectorAll('.dim-bar-progress').forEach(bar => {
        const target = bar.getAttribute('data-target-width') || '75%';
        bar.style.width = target;
      });
    }, 200);
  }

  function renderScorecardWithReport(report) {
    reportContainer.style.display = 'block';
    reportContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Populate overall score
    const overallNum = document.getElementById('report-overall-score');
    if (overallNum && report.overallScore !== undefined) {
      overallNum.textContent = report.overallScore;
    }

    const overallLabel = document.getElementById('report-overall-label');
    if (overallLabel && report.overallRating) {
      overallLabel.textContent = report.overallRating;
    }

    // Populate dimensions
    if (report.dimensions) {
      Object.keys(report.dimensions).forEach(dim => {
        const val = report.dimensions[dim].score;
        const valElem = document.getElementById(`score-${dim}`);
        const barElem = document.getElementById(`bar-${dim}`);
        if (valElem) valElem.textContent = val;
        if (barElem) barElem.style.width = `${val}%`;
      });
    }
  }

  // Check URL token for direct report view
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (token) {
    fetch(`/api/saas-fitscore/report?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.report) {
          if (questionnaireWrapper) questionnaireWrapper.style.display = 'none';
          renderScorecardWithReport(data.report);
        }
      })
      .catch(err => console.log('Token check error:', err));
  }

  // ═══════════════════════════════════════════
  // 4. PRINT / PDF DOWNLOAD TRIGGER
  // ═══════════════════════════════════════════
  const printBtn = document.getElementById('print-report-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // ═══════════════════════════════════════════
  // 5. FAQ ACCORDION INTERACTION
  // ═══════════════════════════════════════════
  const faqPanels = document.querySelectorAll('.fitscore-faq-panel');
  faqPanels.forEach(panel => {
    const trigger = panel.querySelector('.fitscore-faq-trigger');
    const content = panel.querySelector('.fitscore-faq-content');
    if (trigger && content) {
      trigger.addEventListener('click', () => {
        const isActive = panel.classList.contains('is-active');
        // Close others
        faqPanels.forEach(p => {
          if (p !== panel) {
            p.classList.remove('is-active');
            const c = p.querySelector('.fitscore-faq-content');
            if (c) c.style.maxHeight = null;
          }
        });

        if (!isActive) {
          panel.classList.add('is-active');
          content.style.maxHeight = content.scrollHeight + 'px';
        } else {
          panel.classList.remove('is-active');
          content.style.maxHeight = null;
        }
      });
    }
  });

  // Open first FAQ panel by default
  if (faqPanels.length > 0) {
    faqPanels[0].classList.add('is-active');
    const firstContent = faqPanels[0].querySelector('.fitscore-faq-content');
    if (firstContent) firstContent.style.maxHeight = firstContent.scrollHeight + 'px';
  }

});
