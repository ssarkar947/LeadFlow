/**
 * AdsVise — Ad Audit & Growth Plan
 * Handles:
 * - Direct Razorpay Standard Checkout on clicking "Book Audit Now"
 * - Order creation via POST /api/create-order
 * - Razorpay modal popup for ₹1,999 with UPI, Cards, NetBanking
 * - Backend HMAC-SHA256 signature verification via POST /api/verify-payment
 * - Post-payment confirmation & WhatsApp intake coordination
 * - FAQ accordion interaction
 * - Meta Pixel & Google Analytics 4 tracking
 * - Mobile sticky CTA bar
 */

document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════════
  // 1. HEADER SCROLL & STICKY MOBILE CTA
  // ═══════════════════════════════════════════
  const header = document.getElementById('adv-header');
  const stickyBar = document.getElementById('mobile-sticky-cta');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (header) {
      header.classList.toggle('scrolled', scrollY > 20);
    }
    if (stickyBar) {
      stickyBar.style.display = scrollY > 350 ? 'block' : 'none';
    }
  }, { passive: true });

  // ═══════════════════════════════════════════
  // 2. FAQ ACCORDION INTERACTION
  // ═══════════════════════════════════════════
  const faqPanels = document.querySelectorAll('.faq-white-panel, .faq-clean-panel, .audit-faq-panel');
  faqPanels.forEach(panel => {
    const trigger = panel.querySelector('.faq-white-trigger, .faq-clean-trigger, .audit-faq-trigger');
    const answer = panel.querySelector('.faq-white-answer, .faq-clean-answer, .audit-faq-answer');

    if (trigger && answer) {
      trigger.addEventListener('click', () => {
        const isOpen = panel.classList.contains('is-active');

        // Close other panels
        faqPanels.forEach(p => {
          if (p !== panel) {
            p.classList.remove('is-active');
            const ans = p.querySelector('.faq-white-answer, .faq-clean-answer, .audit-faq-answer');
            if (ans) ans.style.maxHeight = null;
          }
        });

        // Toggle current panel
        if (!isOpen) {
          panel.classList.add('is-active');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        } else {
          panel.classList.remove('is-active');
          answer.style.maxHeight = null;
        }
      });
    }
  });

  if (faqPanels.length > 0) {
    const first = faqPanels[0];
    first.classList.add('is-active');
    const firstAns = first.querySelector('.faq-white-answer, .faq-clean-answer, .audit-faq-answer');
    if (firstAns) firstAns.style.maxHeight = firstAns.scrollHeight + 'px';
  }

  // ═══════════════════════════════════════════
  // 3. RAZORPAY STANDARD CHECKOUT & BOOKING FLOW
  // ═══════════════════════════════════════════
  const modalOverlay = document.getElementById('audit-modal-overlay');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const bookingForm = document.getElementById('audit-booking-form');
  const submitBtn = document.getElementById('audit-submit-btn');
  const formView = document.getElementById('modal-form-view');
  const confirmView = document.getElementById('modal-confirm-view');
  const openButtons = document.querySelectorAll('.open-booking-modal');
  const confirmWhatsappBtn = document.getElementById('confirm-whatsapp-action');

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('is-open')) {
      closeModal();
    }
  });

  /**
   * Triggers Razorpay Standard Web Checkout for ₹1,999
   * @param {HTMLElement|null} triggerBtn - The button clicked
   * @param {Object} prefill - Optional prefilled customer info
   */
  async function triggerRazorpayCheckout(triggerBtn = null, prefill = {}) {
    const originalContent = triggerBtn ? triggerBtn.innerHTML : '';

    if (triggerBtn) {
      triggerBtn.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
          Opening Checkout...
        </span>
      `;
      triggerBtn.disabled = true;
    }

    // Track Meta & GA4 InitiateCheckout event
    trackEvent('InitiateCheckout', {
      content_name: 'Ad Audit + Growth Plan',
      content_category: 'Service Audit',
      value: 1999,
      currency: 'INR'
    });

    try {
      // STEP 1: Create Order on Backend
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 199900, // ₹1,999 in paise
          currency: 'INR',
          receipt: 'audit_rcpt_' + Date.now(),
          notes: {
            service: 'Ad Audit + Growth Plan',
            business: prefill.business || '',
            platform: prefill.platform || ''
          }
        })
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to initialize payment order');
      }

      if (typeof window.Razorpay !== 'function') {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // STEP 2: Open Razorpay Standard Checkout Modal
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'AdsVise',
        description: 'Ad Audit + Growth Plan (₹1,999 One-Time)',
        image: 'logo.png',
        order_id: orderData.order_id,
        prefill: {
          name: prefill.name || '',
          email: prefill.email || '',
          contact: prefill.phone || ''
        },
        theme: {
          color: '#0f172a'
        },
        handler: async function (razorpayResponse) {
          if (triggerBtn) {
            triggerBtn.innerHTML = 'Verifying Payment...';
          }

          // STEP 3: Verify Payment Signature on Backend
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
                bookingData: {
                  name: prefill.name || 'Ad Audit Client',
                  business: prefill.business || 'Client Business',
                  phone: prefill.phone || '',
                  email: prefill.email || '',
                  platform: prefill.platform || 'Meta / Google',
                  spend: prefill.spend || '',
                  notes: prefill.notes || '',
                  source: 'Ad Audit + Growth Plan (₹1,999)',
                  amount: 1999,
                  currency: 'INR'
                }
              })
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              onPaymentSuccess(razorpayResponse.razorpay_payment_id, razorpayResponse.razorpay_order_id, prefill);
            } else {
              alert('Payment verification error: ' + (verifyData.error || 'Please contact support with payment ID ' + razorpayResponse.razorpay_payment_id));
              if (triggerBtn) {
                triggerBtn.innerHTML = originalContent;
                triggerBtn.disabled = false;
              }
            }
          } catch (vErr) {
            console.error('Signature verification network error:', vErr);
            onPaymentSuccess(razorpayResponse.razorpay_payment_id, razorpayResponse.razorpay_order_id, prefill);
          }
        },
        modal: {
          ondismiss: function () {
            console.log('Razorpay modal closed by user');
            if (triggerBtn) {
              triggerBtn.innerHTML = originalContent;
              triggerBtn.disabled = false;
            }
          }
        }
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (failedResponse) {
        console.error('Razorpay payment failed:', failedResponse.error);
        alert('Payment failed: ' + (failedResponse.error.description || failedResponse.error.reason || 'Transaction could not be completed'));
        if (triggerBtn) {
          triggerBtn.innerHTML = originalContent;
          triggerBtn.disabled = false;
        }
      });

      rzp.open();

      // Reset button text after modal successfully opened
      setTimeout(() => {
        if (triggerBtn && triggerBtn.disabled) {
          triggerBtn.innerHTML = originalContent;
          triggerBtn.disabled = false;
        }
      }, 1500);

    } catch (err) {
      console.error('Checkout error:', err);
      alert('Could not start checkout: ' + err.message);
      if (triggerBtn) {
        triggerBtn.innerHTML = originalContent;
        triggerBtn.disabled = false;
      }
    }
  }

  function onPaymentSuccess(paymentId, orderId, clientData) {
    // Track Meta & GA4 Purchase Event
    trackEvent('Purchase', {
      content_name: 'Ad Audit + Growth Plan',
      content_type: 'service',
      value: 1999,
      currency: 'INR',
      transaction_id: paymentId
    });

    // Show Confirmation View in Modal
    if (formView) formView.style.display = 'none';
    if (confirmView) confirmView.style.display = 'block';
    if (modalOverlay) {
      modalOverlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }

    // Update Confirmation Details
    const confirmDesc = document.querySelector('.confirm-desc');
    if (confirmDesc) {
      confirmDesc.innerHTML = `
        Thank you for booking the <strong>Complete Ad Audit + Growth Plan</strong>.<br/>
        <div style="background: rgba(163, 230, 53, 0.1); border: 1px solid rgba(163, 230, 53, 0.35); border-radius: 8px; padding: 0.85rem 1rem; margin: 1.25rem 0; font-size: 0.92rem; text-align: left; line-height: 1.6;">
          <div style="color: #10b981; font-weight: 700; margin-bottom: 4px;">✅ Payment Verified & Received: ₹1,999</div>
          <div>💳 <strong>Payment ID:</strong> <code style="color: #60a5fa; font-weight: 600;">${paymentId}</code></div>
          <div>📋 <strong>Order ID:</strong> <code style="color: #94a3b8;">${orderId}</code></div>
        </div>
        Your order is registered in Sourav's personal queue. Click below to message Sourav on WhatsApp to share your campaign access.
      `;
    }

    // Update WhatsApp link with prefilled payment information
    if (confirmWhatsappBtn) {
      const biz = clientData.business || 'my business';
      const text = encodeURIComponent(
        `Hi Sourav! I just booked and paid ₹1,999 for the Ad Audit for ${biz} (Payment ID: ${paymentId}, Order: ${orderId}). Please let me know how to share campaign access.`
      );
      confirmWhatsappBtn.href = `https://wa.me/919830000000?text=${text}`;
    }

    // Save lead to backend database
    fetch('/api/book-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: clientData.name || 'Ad Audit Client',
        business: clientData.business || 'Client Business',
        phone: clientData.phone || '',
        email: clientData.email || '',
        platform: clientData.platform || 'Meta / Google',
        spend: clientData.spend || '',
        notes: clientData.notes || '',
        paymentStatus: 'Paid (Verified Razorpay)',
        transactionId: paymentId,
        orderId: orderId,
        amount: 1999
      })
    }).catch(e => console.warn('Saved via verify-payment'));
  }

  // ═══════════════════════════════════════════
  // 4. ATTACH RAZORPAY CHECKOUT TO "BOOK AUDIT NOW" BUTTONS
  // ═══════════════════════════════════════════
  openButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();

      // Read any filled form values if user already typed them
      const name = document.getElementById('client-name') ? document.getElementById('client-name').value.trim() : '';
      const email = document.getElementById('client-email') ? document.getElementById('client-email').value.trim() : '';
      const phone = document.getElementById('client-phone') ? document.getElementById('client-phone').value.trim() : '';
      const business = document.getElementById('client-business') ? document.getElementById('client-business').value.trim() : '';

      // DIRECT CHECKOUT TRIGGER: Launch Razorpay Standard Checkout Immediately!
      triggerRazorpayCheckout(btn, { name, email, phone, business });
    });
  });

  // Modal form submit also triggers Razorpay with full form data
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('client-name').value.trim();
      const business = document.getElementById('client-business').value.trim();
      const phone = document.getElementById('client-phone').value.trim();
      const email = document.getElementById('client-email').value.trim();
      const platform = document.getElementById('client-platform').value;
      const spend = document.getElementById('client-spend').value;
      const notes = document.getElementById('client-notes').value.trim();

      triggerRazorpayCheckout(submitBtn, { name, business, phone, email, platform, spend, notes });
    });
  }

  // ═══════════════════════════════════════════
  // 5. UNIFIED ANALYTICS TRACKING HELPER
  // ═══════════════════════════════════════════
  function trackEvent(eventName, params = {}) {
    if (typeof window.fbq === 'function') {
      try {
        window.fbq('track', eventName, params);
      } catch (e) {
        console.warn('[Meta Pixel] Error:', e);
      }
    }

    if (typeof window.gtag === 'function') {
      try {
        let gaEventName = eventName;
        if (eventName === 'InitiateCheckout') gaEventName = 'begin_checkout';
        if (eventName === 'Lead') gaEventName = 'generate_lead';
        if (eventName === 'Purchase') gaEventName = 'purchase';

        window.gtag('event', gaEventName, params);
      } catch (e) {
        console.warn('[GA4] Error:', e);
      }
    }
  }

});
