/**
 * SaaS FitScore — Client-Side Application Logic
 * AdsVise Growth Intelligence
 */

document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════════
  // 1. SINGLE-STEP INTAKE & DISPOSABLE EMAIL CHECK
  // ═══════════════════════════════════════════
  const questionnaireForm = document.getElementById('saas-fitscore-form');
  const processingScreen = document.getElementById('processing-screen');
  const reportContainer = document.getElementById('report-container');
  const questionnaireWrapper = document.getElementById('questionnaire-wrapper');
  let activeLeadId = '';
  let activeDiagnosticId = '';

  const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com', 'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'guerrillamail.info',
    'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de',
    'sharklasers.com', 'grr.la', '10minutemail.com', '10minutemail.net', 'yopmail.com',
    'yopmail.fr', 'yopmail.net', 'throwawaymail.com', 'getnada.com', 'nada.email',
    'trashmail.com', 'trashmail.net', 'trash-mail.com', 'fakeinbox.com', 'dispostable.com',
    'maildrop.cc', 'mohmal.com', 'emailondeck.com', 'mintemail.com', 'mytemp.email',
    'burnermail.io', 'mailnesia.com', 'spamgourmet.com', 'tempr.email', 'tempmailo.com',
    '33mail.com', 'inboxbear.com', 'dropmail.me', 'moakt.com', 'tmail.ws', 'pokemail.net',
    'crazymailing.com', 'jetable.org', 'wegwerfmail.de', 'mailcatch.com', 'tempail.com',
    'tempmailaddress.com', 'throwam.com', 'mail-temporaire.fr', 'spam4.me', 'getairmail.com',
    'harakirimail.com', 'incognitomail.org', 'instant-mail.de', 'meltmail.com', 'mt2015.com',
    'objectmail.com', 'proxymail.eu', 'rcpt.at', 'recode.me', 'spambox.us', 'spamfree24.org',
    'tempinbox.com', 'trashymail.com', 'willhackforfood.biz'
  ]);

  function isDisposableEmail(email) {
    const parts = (email || '').trim().toLowerCase().split('@');
    if (parts.length !== 2) return false;
    return DISPOSABLE_DOMAINS.has(parts[1]);
  }

  // URL normalizer helper
  function cleanUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  // Helper to derive company name from website URL
  function deriveCompanyName(url) {
    if (!url) return 'Your SaaS';
    try {
      const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
      const host = parsed.hostname.replace(/^www\./i, '');
      const namePart = host.split('.')[0] || 'Your SaaS';
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    } catch (e) {
      return 'Your SaaS';
    }
  }

  function showFormError(msg) {
    const banner = document.getElementById('form-error-banner');
    if (banner) {
      banner.textContent = msg;
      banner.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  function clearFormError() {
    const banner = document.getElementById('form-error-banner');
    if (banner) banner.style.display = 'none';
  }

  // ═══════════════════════════════════════════
  // 2. FORM SUBMISSION & ASYNC PIPELINE WIRING
  // ═══════════════════════════════════════════
  if (questionnaireForm) {
    questionnaireForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFormError();

      const nameInput = document.getElementById('founder-name');
      const emailInput = document.getElementById('work-email');
      const websiteInput = document.getElementById('saas-website');
      const emailErr = document.getElementById('email-error');
      const consent = document.getElementById('consent-checkbox');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let isValid = true;

      [nameInput, emailInput, websiteInput].forEach(input => {
        if (!input || !input.value.trim()) {
          if (input) input.style.borderColor = '#ef4444';
          isValid = false;
        } else {
          input.style.borderColor = '';
        }
      });

      const emailVal = emailInput ? emailInput.value.trim() : '';
      if (!emailVal || !emailRegex.test(emailVal)) {
        if (emailInput) emailInput.style.borderColor = '#ef4444';
        if (emailErr) {
          emailErr.textContent = 'Please enter a valid email address.';
          emailErr.style.display = 'block';
        }
        isValid = false;
      } else if (isDisposableEmail(emailVal)) {
        if (emailInput) emailInput.style.borderColor = '#ef4444';
        if (emailErr) {
          emailErr.textContent = 'Disposable or temporary email addresses are not allowed. Please use a real email address.';
          emailErr.style.display = 'block';
        }
        isValid = false;
      } else {
        if (emailErr) emailErr.style.display = 'none';
      }

      if (!consent || !consent.checked) {
        showFormError('Please accept the consent terms to proceed with website analysis.');
        isValid = false;
      }

      if (!isValid) return;

      // Collect payload
      const websiteUrl = cleanUrl(websiteInput.value);
      const derivedCompany = deriveCompanyName(websiteUrl);

      const payload = {
        name: nameInput.value.trim(),
        email: emailVal,
        company: derivedCompany,
        websiteUrl: websiteUrl,
        consentGranted: true,
        submittedAt: new Date().toISOString()
      };

      // Hide form, show processing screen
      questionnaireWrapper.style.display = 'none';
      processingScreen.style.display = 'block';
      processingScreen.scrollIntoView({ behavior: 'smooth', block: 'center' });

      try {
        const response = await fetch('/api/saas-fitscore/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const resData = await response.json().catch(() => ({}));

        if (response.ok && resData.diagnosticId) {
          activeLeadId = resData.leadId || '';
          activeDiagnosticId = resData.diagnosticId || '';
          pollDiagnosticStatus(resData.diagnosticId);
          return;
        }

        // Surface validation/rate-limit errors instead of faking a result
        processingScreen.style.display = 'none';
        questionnaireWrapper.style.display = 'block';
        showFormError(resData.error || 'Unable to start analysis. Please check your details and try again.');
      } catch (err) {
        console.log('[Notice] Backend API unreachable. Running local preview simulation.');
        runVisualDiagnosticSimulation(payload);
      }
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

    // Populate company and domain
    const compEls = document.querySelectorAll('.report-company-name');
    compEls.forEach(el => el.textContent = report.company || 'Your SaaS');

    const websiteEls = document.querySelectorAll('.report-website-url');
    websiteEls.forEach(el => el.textContent = report.websiteUrl || 'yourdomain.com');

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
        if (valElem) valElem.textContent = `${val}/100`;
        if (barElem) barElem.style.width = `${val}%`;
      });
    }

    // Populate executive summary
    const execEl = document.getElementById('report-executive-summary');
    if (execEl && report.executiveSummary) {
      execEl.textContent = report.executiveSummary;
    }

    // Dynamic Top Constraints if available from report
    if (report.topConstraints && report.topConstraints.length > 0) {
      const constraintsContainer = document.querySelector('.constraints-block');
      if (constraintsContainer) {
        let html = `
          <h3 style="font-size: 1.5rem; color: #fff; margin-bottom: 0.5rem;">What Exactly Is Going Wrong Right Now</h3>
          <p style="color: var(--text-muted, #a1a1aa); font-size: 0.95rem;">Specific bottlenecks observed on your live SaaS pages across the 5 dimensions:</p>
        `;
        report.topConstraints.forEach((c, idx) => {
          const tags = ['Critical Constraint', 'High Priority', 'Medium Priority'];
          const colors = [
            'rgba(240, 84, 23, 0.2); color: var(--accent, #F05417)',
            'rgba(59, 130, 246, 0.2); color: var(--brand-blue, #3b82f6)',
            'rgba(163, 230, 53, 0.2); color: var(--lime-green, #a3e635)'
          ];
          html += `
            <div class="constraint-card">
              <div class="constraint-head">
                <span class="constraint-tag" style="background:${colors[idx] || colors[0]}">${tags[idx] || 'Growth Priority'}</span>
                <span class="constraint-title">${idx + 1}. ${c.title}</span>
              </div>
              <p>${c.description}</p>
              ${c.commercialImpact ? `<p style="font-size:0.85rem;color:#a1a1aa;margin-top:0.4rem;"><strong>Impact:</strong> ${c.commercialImpact}</p>` : ''}
            </div>
          `;
        });
        constraintsContainer.innerHTML = html;
      }
    }

    // Render Dimension-by-Dimension Findings (What they are doing right now)
    const findingsList = document.getElementById('findings-list');
    if (findingsList && Array.isArray(report.findings) && report.findings.length > 0) {
      findingsList.innerHTML = report.findings.map(f => `
        <div class="constraint-card" style="margin-bottom:0;">
          <div class="constraint-head">
            <span class="constraint-tag" style="background:rgba(59,130,246,0.16); color:#60a5fa; text-transform:uppercase;">${f.dimension || 'Dimension'}</span>
            <span class="constraint-title">${f.title || ''}</span>
          </div>
          <p style="margin-bottom:0.5rem;">${f.description || ''}</p>
          ${f.supportingEvidence ? `<p style="font-size:0.84rem;color:#a1a1aa;margin:0.25rem 0;"><strong>Observed on your site:</strong> ${f.supportingEvidence}</p>` : ''}
          ${f.businessImplication ? `<p style="font-size:0.84rem;color:#fca5a5;margin:0.25rem 0;"><strong>Why it hurts conversion:</strong> ${f.businessImplication}</p>` : ''}
        </div>
      `).join('');
    }

    // Populate Locked 30-60-90 Day Roadmap (unlocked upon $9 call payment)
    if (report.actionPlan) {
      const fillList = (id, items) => {
        const el = document.getElementById(id);
        if (el && Array.isArray(items) && items.length > 0) {
          el.innerHTML = items.map(item => `<li>${item}</li>`).join('');
        }
      };
      fillList('roadmap-30-list', report.actionPlan.thirtyDays);
      fillList('roadmap-60-list', report.actionPlan.sixtyDays);
      fillList('roadmap-90-list', report.actionPlan.ninetyDays);
    }
  }

  // ═══════════════════════════════════════════
  // 3.5. RAZORPAY STANDARD WEB CHECKOUT ($9 WALKTHROUGH CALL)
  // ═══════════════════════════════════════════
  const instantCheckoutBtn = document.getElementById('instant-checkout-btn');
  if (instantCheckoutBtn) {
    instantCheckoutBtn.addEventListener('click', async () => {
      instantCheckoutBtn.disabled = true;
      instantCheckoutBtn.textContent = 'Preparing Booking...';

      try {
        const orderRes = await fetch('/api/saas-fitscore/create-paid-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: 'SaaS FitScore Full Walkthrough Call ($9)',
            leadId: activeLeadId,
            diagnosticId: activeDiagnosticId
          })
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok || !orderData.success) {
          alert('Could not initiate order: ' + (orderData.error || 'Server error'));
          instantCheckoutBtn.disabled = false;
          instantCheckoutBtn.textContent = 'Book Full Walkthrough Call ($9) →';
          return;
        }

        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'AdsVise',
          description: 'SaaS FitScore Full Walkthrough & Breakdown Call ($9)',
          image: '/logo.png',
          order_id: orderData.order_id,
          theme: { color: '#3b82f6' },
          handler: async function (response) {
            instantCheckoutBtn.textContent = 'Verifying Payment...';
            try {
              const verifyRes = await fetch('/api/saas-fitscore/verify-paid-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                instantCheckoutBtn.style.display = 'none';
                const successBanner = document.getElementById('payment-success-banner');
                if (successBanner) successBanner.style.display = 'block';
                // Unlock the blurred 30-60-90 day roadmap
                const blurEl = document.getElementById('roadmap-blur-content');
                if (blurEl) {
                  blurEl.style.filter = 'none';
                  blurEl.style.opacity = '1';
                  blurEl.style.pointerEvents = 'auto';
                  blurEl.style.userSelect = 'auto';
                }
                const lockBadge = document.getElementById('roadmap-lock-badge');
                if (lockBadge) {
                  lockBadge.textContent = 'UNLOCKED';
                  lockBadge.style.background = 'rgba(163,230,53,0.18)';
                  lockBadge.style.color = '#a3e635';
                }
              } else {
                alert('Payment verification failed: ' + (verifyData.error || 'Contact support.'));
              }
            } catch (vErr) {
              alert('Verification network error: ' + vErr.message);
            }
          },
          modal: {
            ondismiss: function () {
              instantCheckoutBtn.disabled = false;
              instantCheckoutBtn.textContent = 'Book Full Walkthrough Call ($9) →';
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (err) {
        alert('Checkout error: ' + err.message);
        instantCheckoutBtn.disabled = false;
        instantCheckoutBtn.textContent = 'Book Full Walkthrough Call ($9) →';
      }
    });
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
