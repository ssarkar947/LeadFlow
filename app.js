document.addEventListener('DOMContentLoaded', () => {

  // ─── Supabase Configuration (Optional - User can fill this in) ───
  const supabaseUrl = ''; // Enter your Supabase Project URL here
  const supabaseKey = ''; // Enter your Supabase Anon Key here
  let supabaseClient = null;
  if (supabaseUrl && supabaseKey && window.supabase) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
  }

  // Session state manager helpers for the live demo simulator
  window.unlockDemo = function(name) {
    const lock = document.getElementById('demo-lock-screen');
    const controls = document.getElementById('demo-controls-screen');
    const display = document.getElementById('user-display-name');
    if (lock) lock.style.display = 'none';
    if (controls) controls.style.display = 'block';
    if (display) display.textContent = name;
  };

  window.lockDemo = function() {
    const lock = document.getElementById('demo-lock-screen');
    const controls = document.getElementById('demo-controls-screen');
    if (lock) lock.style.display = 'block';
    if (controls) controls.style.display = 'none';
    localStorage.removeItem('demo_user');
  };

  // ─── Header scroll effect ───
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  });

  // ─── Mobile drawer ───
  const drawer = document.getElementById('drawer');
  document.getElementById('open-drawer').addEventListener('click', () => drawer.classList.add('open'));
  document.getElementById('close-drawer').addEventListener('click', () => drawer.classList.remove('open'));
  document.querySelectorAll('.close-drawer-link').forEach(l => l.addEventListener('click', () => drawer.classList.remove('open')));

  // ─── Scroll reveal (Intersection Observer) ───
  const revealEls = document.querySelectorAll('.reveal');
  const revealObs = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => revealObs.observe(el));

  // ─── FAQ accordion ───
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(other => {
        other.classList.remove('open');
        other.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  // ─── Modal ───
  const modal = document.getElementById('modal');
  const modalForm = document.getElementById('modal-form');
  const modalSuccess = document.getElementById('modal-success');
  const form = document.getElementById('capture-form');

  const openModal = () => {
    modal.classList.add('open');
    modalForm.style.display = 'block';
    modalSuccess.style.display = 'none';
  };
  const closeModal = () => modal.classList.remove('open');

  document.querySelectorAll('.open-modal').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); openModal(); }));
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('success-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cap-name').value.trim();
    const email = document.getElementById('cap-email').value.trim();
    const business = document.getElementById('cap-business').value.trim();
    const phone = document.getElementById('cap-phone').value.trim();
    const source = document.getElementById('cap-source').value;

    const btn = document.getElementById('cap-submit');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    const payload = { name, email, business, phone, source };

    // 1. Submit to Local Server for email delivery
    try {
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Local register API offline, running mock registration', err);
    }

    // 2. Submit to Supabase (if configured)
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('leads')
          .insert([payload]);
        if (error) throw error;
        console.log('Saved to Supabase leads table.');
      } catch (err) {
        console.error('Supabase error:', err.message);
      }
    }

    // Auto-unlock the Live Demo call since they created an account
    localStorage.setItem('demo_user', JSON.stringify({ name, email, business, phone }));
    if (typeof unlockDemo === 'function') {
      unlockDemo(name);
    }

    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Create Free Account 🚀';
      document.getElementById('success-email').textContent = email;
      modalForm.style.display = 'none';
      modalSuccess.style.display = 'block';
      form.reset();
    }, 1000);
  });

  // ─── Animated stat counters ───
  const animateCounters = () => {
    document.querySelectorAll('.stat-val').forEach(el => {
      const text = el.textContent.trim();
      if (!/\d/.test(text)) return;
      const match = text.match(/([\d.]+)/);
      if (!match) return;
      const target = parseFloat(match[1]);
      const prefix = text.substring(0, text.indexOf(match[1]));
      const suffix = text.substring(text.indexOf(match[1]) + match[1].length);
      const isFloat = match[1].includes('.');
      let current = 0;
      const duration = 1800;
      const start = performance.now();
      const tick = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        current = target * ease;
        el.textContent = prefix + (isFloat ? current.toFixed(1) : Math.floor(current)) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };
  const statsSection = document.querySelector('.stats-bar');
  if (statsSection) {
    const statsObs = new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) { animateCounters(); obs.unobserve(entries[0].target); }
    }, { threshold: 0.3 });
    statsObs.observe(statsSection);
  }

  // ─── Update phone time ───
  const updatePhoneTime = () => {
    const el = document.getElementById('ph-time');
    if (el) {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      el.textContent = h + ':' + m + ' ' + ampm;
    }
  };
  updatePhoneTime();
  setInterval(updatePhoneTime, 30000);

  // ═══════════════════════════════════════════
  //  INTERACTIVE VOICE DEMO SIMULATOR
  // ═══════════════════════════════════════════

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // DOM refs
  const demoForm = document.getElementById('demo-form');
  const industryInput = document.getElementById('demo-industry');
  const voiceSelect = document.getElementById('demo-voice');
  const startBtn = document.getElementById('demo-start-btn');
  const ttsToggle = document.getElementById('tts-toggle');

  // Registration Form DOM refs
  const demoRegForm = document.getElementById('demo-register-form');
  const regNameInput = document.getElementById('reg-name');
  const regEmailInput = document.getElementById('reg-email');
  const regBusinessInput = document.getElementById('reg-business');
  const regPhoneInput = document.getElementById('reg-phone');
  const demoLogoutBtn = document.getElementById('demo-logout-btn');

  // Check for active demo session on page load
  const activeSession = localStorage.getItem('demo_user');
  if (activeSession) {
    try {
      const userObj = JSON.parse(activeSession);
      unlockDemo(userObj.name);
    } catch (e) {
      localStorage.removeItem('demo_user');
    }
  }

  // Handle demo registration submit
  demoRegForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = regNameInput.value.trim();
    const email = regEmailInput.value.trim();
    const business = regBusinessInput.value.trim();
    const phone = regPhoneInput.value.trim();

    const btn = document.getElementById('demo-unlock-btn');
    btn.disabled = true;
    btn.textContent = 'Unlocking Simulator...';

    const payload = { name, email, business, phone };

    // 1. Submit to Local Server for email notification
    try {
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Local register API offline, running mock registration', err);
    }

    // 2. Submit to Supabase (if configured)
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('leads')
          .insert([payload]);
        if (error) throw error;
        console.log('Saved user lead details to Supabase leads table.');
      } catch (err) {
        console.error('Supabase error:', err.message);
      }
    }

    // Save session locally and unlock
    localStorage.setItem('demo_user', JSON.stringify(payload));
    unlockDemo(name);

    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Create Account & Unlock Demo 🔓';
    }, 500);
  });

  // Handle simulator logout/change account
  demoLogoutBtn.addEventListener('click', () => {
    lockDemo();
  });

  const states = {
    idle: document.getElementById('ph-idle'),
    ringing: document.getElementById('ph-ringing'),
    active: document.getElementById('ph-active'),
    outcome: document.getElementById('ph-outcome'),
  };

  const chatEl = document.getElementById('ph-chat');
  const optionsEl = document.getElementById('ph-options');
  const timerEl = document.getElementById('ph-timer');

  // State
  let ttsEnabled = true;
  let timerInterval = null;
  let timerSeconds = 0;
  let demoRunning = false;
  let speechSynth = window.speechSynthesis || null;
  let voicesList = [];

  // Populate browser voices
  function populateVoiceList() {
    if (!speechSynth) return;
    voicesList = speechSynth.getVoices();
    
    // Maintain selected value if any
    const lastSelected = voiceSelect.value;
    voiceSelect.innerHTML = '<option value="default">Default Human-Like Voice (English)</option>';
    
    // Sort voices by language first, then name
    const sortedVoices = [...voicesList].sort((a, b) => {
      if (a.lang < b.lang) return -1;
      if (a.lang > b.lang) return 1;
      return a.name.localeCompare(b.name);
    });

    sortedVoices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voicesList.indexOf(voice);
      
      let gender = '';
      if (/female|zira|samantha|karen|fiona|jenny|aria|hazel|heera|haruka/i.test(voice.name)) {
        gender = ' (Female)';
      } else if (/male|david|guy|ravi|george/i.test(voice.name)) {
        gender = ' (Male)';
      }
      
      let voiceLabel = `${voice.name} [${voice.lang}]${gender}`;
      if (/natural|neural/i.test(voice.name)) {
        voiceLabel = `✨ ${voiceLabel} (High Quality)`;
      }
      
      option.textContent = voiceLabel;
      voiceSelect.appendChild(option);
    });

    if (lastSelected) {
      voiceSelect.value = lastSelected;
    }
  }

  // Warm up and populate voices
  if (speechSynth) {
    populateVoiceList();
    if (speechSynth.onvoiceschanged !== undefined) {
      speechSynth.onvoiceschanged = populateVoiceList;
    }
  }

  // ─── TTS ───
  ttsToggle.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    ttsToggle.textContent = ttsEnabled ? '🔊 Voice Audio: ON' : '🔇 Voice Audio: OFF';
  });

  function speak(text) {
    return new Promise((resolve) => {
      if (!ttsEnabled || !speechSynth) { resolve(); return; }
      speechSynth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      
      // Determine voice to use
      const selectedVal = voiceSelect.value;
      let voiceToUse = null;
      
      if (selectedVal === 'default') {
        const voices = speechSynth.getVoices();
        // Try to pick a natural/human-sounding English voice by default
        voiceToUse = voices.find(v => /natural|neural/i.test(v.name) && v.lang.startsWith('en'))
          || voices.find(v => /samantha|karen|fiona|zira|jenny|aria|google.*female/i.test(v.name))
          || voices.find(v => v.lang.startsWith('en') && /female/i.test(v.name))
          || voices.find(v => v.lang.startsWith('en'));
      } else {
        const idx = parseInt(selectedVal, 10);
        if (!isNaN(idx) && voicesList[idx]) {
          voiceToUse = voicesList[idx];
        }
      }
      
      if (voiceToUse) {
        u.voice = voiceToUse;
        u.lang = voiceToUse.lang;
      }
      
      // Customize speech dynamics to sound as natural/human as possible
      u.rate = 0.95; // Slightly slower makes SpeechSynthesis sound dramatically more natural
      u.pitch = 1.0;
      
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynth.speak(u);
    });
  }

  // ─── State machine helpers ───
  function showState(name) {
    Object.entries(states).forEach(([k, el]) => el.classList.toggle('active', k === name));
  }

  function addBubble(type, text) {
    const div = document.createElement('div');
    div.className = 'bubble ' + (type === 'ai' ? 'b-ai' : type === 'user' ? 'b-user' : 'b-status');
    div.textContent = text;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function clearChat() {
    chatEl.innerHTML = '';
    optionsEl.innerHTML = '';
  }

  function showOptions(opts) {
    optionsEl.innerHTML = '';
    opts.forEach(({ label, handler }) => {
      const btn = document.createElement('button');
      btn.className = 'ph-opt-btn';
      btn.textContent = label;
      btn.addEventListener('click', handler);
      optionsEl.appendChild(btn);
    });
  }

  function clearOptions() { optionsEl.innerHTML = ''; }

  // Timer
  function startTimer() {
    timerSeconds = 0;
    timerEl.textContent = '00:00';
    timerInterval = setInterval(() => {
      timerSeconds++;
      const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
      const s = (timerSeconds % 60).toString().padStart(2, '0');
      timerEl.textContent = m + ':' + s;
    }, 1000);
  }
  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Conversation flow ───
  async function runConversation(name, industry, businessName) {
    // Greeting
    addBubble('status', '📞 Connected');
    await delay(500);
    const greeting = `Hi ${name}, this is a customer support agent from ${businessName}. Thanks for your inquiry about ${industry} services. Is now a good time to chat?`;
    addBubble('ai', greeting);
    await speak(greeting);

    // Wait for user response
    await new Promise((resolve) => {
      showOptions([
        { label: '✅ Yes, now works great!', handler: () => { clearOptions(); addBubble('user', 'Yes, now works great!'); resolve('available'); } },
        { label: '⏰ I\'m busy right now', handler: () => { clearOptions(); addBubble('user', 'I\'m busy right now, can we talk later?'); resolve('busy'); } },
        { label: '❌ Not interested', handler: () => { clearOptions(); addBubble('user', 'Not interested, thanks.'); resolve('decline'); } },
      ]);
    }).then(async (choice) => {
      await delay(400);

      if (choice === 'available') {
        // Qualification Q1
        const q1 = `Wonderful, ${name}! Before I connect you with a specialist, can I ask — what\'s the main challenge you\'re looking to solve with ${industry}?`;
        addBubble('ai', q1);
        await speak(q1);

        await new Promise((resolve) => {
          showOptions([
            { label: '📈 I need more clients', handler: () => { clearOptions(); addBubble('user', 'I need help getting more clients.'); resolve(); } },
            { label: '⚙️ I need to improve efficiency', handler: () => { clearOptions(); addBubble('user', 'I want to improve my efficiency.'); resolve(); } },
          ]);
        });

        await delay(400);

        // Qualification Q2
        const q2 = `Great answer! And roughly what\'s your timeline for getting started — are you looking at this week or next month?`;
        addBubble('ai', q2);
        await speak(q2);

        await new Promise((resolve) => {
          showOptions([
            { label: '🚀 ASAP — this week', handler: () => { clearOptions(); addBubble('user', 'I\'d like to get started ASAP!'); resolve(); } },
            { label: '📅 Within the next 2 weeks', handler: () => { clearOptions(); addBubble('user', 'Within the next couple of weeks.'); resolve(); } },
          ]);
        });

        await delay(400);

        // Transfer
        const transfer = `Perfect! You sound like a great fit. Let me transfer you to a specialist who can help right away. One moment please...`;
        addBubble('ai', transfer);
        await speak(transfer);

        await delay(1500);
        addBubble('status', '⚡ Call transferred successfully');
        await delay(600);
        stopTimer();
        showOutcome('transfer', name);

      } else if (choice === 'busy') {
        // Busy path
        const busy = `No problem at all, ${name}! I totally understand. Let me find a convenient time for a callback. Would you prefer today or tomorrow?`;
        addBubble('ai', busy);
        await speak(busy);

        await new Promise((resolve) => {
          showOptions([
            { label: '📆 Today works', handler: () => { clearOptions(); addBubble('user', 'Today would work for me.'); resolve('today'); } },
            { label: '📆 Tomorrow is better', handler: () => { clearOptions(); addBubble('user', 'Tomorrow is better for me.'); resolve('tomorrow'); } },
          ]);
        }).then(async (when) => {
          await delay(400);
          const slots = when === 'today' ? '2:00 PM or 4:30 PM' : '10:00 AM or 1:00 PM';
          const schedule = `How about ${slots}?`;
          addBubble('ai', schedule);
          await speak(schedule);

          await new Promise((resolve) => {
            showOptions([
              { label: `⏰ ${slots.split(' or ')[0]}`, handler: () => { clearOptions(); addBubble('user', `${slots.split(' or ')[0]} works!`); resolve(); } },
              { label: `⏰ ${slots.split(' or ')[1]}`, handler: () => { clearOptions(); addBubble('user', `${slots.split(' or ')[1]} please.`); resolve(); } },
            ]);
          });

          await delay(400);
          const confirm = `Done! I\'ve booked your callback. You\'ll receive a confirmation and a reminder. Talk soon, ${name}!`;
          addBubble('ai', confirm);
          await speak(confirm);

          await delay(1000);
          addBubble('status', '📅 Callback booked automatically');
          stopTimer();
          showOutcome('scheduled', name);
        });

      } else {
        // Decline path
        const decline = `No worries at all, ${name}. If you ever change your mind, feel free to reach out anytime. Have a great day!`;
        addBubble('ai', decline);
        await speak(decline);
        await delay(800);
        stopTimer();
        showOutcome('declined', name);
      }
    });
  }

  function showOutcome(type, name) {
    const icon = document.getElementById('ph-out-icon');
    const title = document.getElementById('ph-out-title');
    const desc = document.getElementById('ph-out-desc');
    const cal = document.getElementById('ph-calendar');
    cal.style.display = 'none';

    if (type === 'transfer') {
      icon.textContent = '⚡';
      title.textContent = 'Call Transferred!';
      desc.textContent = `${name} was qualified and transferred to your team in real-time. No lead wasted.`;
    } else if (type === 'scheduled') {
      icon.textContent = '📅';
      title.textContent = 'Callback Scheduled!';
      desc.textContent = `${name} was busy but a callback was automatically booked. Zero manual follow-up.`;
      cal.style.display = 'block';
    } else if (type === 'declined') {
      icon.textContent = '👋';
      title.textContent = 'Lead Handled';
      desc.textContent = `${name} declined politely. The outcome and data are logged for future reference.`;
    } else {
      icon.textContent = '📵';
      title.textContent = 'Call Ended';
      desc.textContent = 'The call was ended. All data has been logged.';
    }

    showState('outcome');
    demoRunning = false;
    startBtn.textContent = '📞 Start Live Call';
    startBtn.disabled = false;
  }

  // Calendar slot clicks
  document.querySelectorAll('.ph-cal-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      document.querySelectorAll('.ph-cal-slot').forEach(s => { s.style.background = ''; s.style.color = ''; s.style.borderColor = ''; });
      slot.style.background = '#a3e635';
      slot.style.color = '#000';
      slot.style.borderColor = '#a3e635';
    });
  });

  // ─── Start demo ───
  demoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (demoRunning) return;
    
    // Retrieve registered user details from LocalStorage
    const saved = localStorage.getItem('demo_user');
    let name = 'Sarah';
    if (saved) {
      try {
        name = JSON.parse(saved).name;
      } catch (err) {}
    }
    const industry = industryInput.value;

    demoRunning = true;
    startBtn.textContent = '⏳ Calling...';
    startBtn.disabled = true;

    // Show ringing
    document.getElementById('ph-ring-name').textContent = name;
    clearChat();
    clearOptions();
    showState('ringing');

    // Play ringing sound attempt
    if (ttsEnabled && speechSynth) {
      const ring = new SpeechSynthesisUtterance('...');
      ring.volume = 0;
      speechSynth.speak(ring);
    }
  });

  // Accept call
  document.getElementById('ph-accept').addEventListener('click', () => {
    showState('active');
    startTimer();
    
    const saved = localStorage.getItem('demo_user');
    let name = 'Sarah';
    let businessName = 'Cyberdyne Systems';
    if (saved) {
      try {
        const user = JSON.parse(saved);
        name = user.name;
        businessName = user.business;
      } catch (err) {}
    }
    const industry = industryInput.value;
    runConversation(name, industry, businessName);
  });

  // Decline call
  document.getElementById('ph-decline').addEventListener('click', () => {
    stopTimer();
    const saved = localStorage.getItem('demo_user');
    let name = 'Lead';
    if (saved) {
      try { name = JSON.parse(saved).name; } catch (err) {}
    }
    showOutcome('hangup', name);
  });

  // Hangup during call
  document.getElementById('ph-hangup').addEventListener('click', () => {
    if (speechSynth) speechSynth.cancel();
    stopTimer();
    const saved = localStorage.getItem('demo_user');
    let name = 'Lead';
    if (saved) {
      try { name = JSON.parse(saved).name; } catch (err) {}
    }
    showOutcome('hangup', name);
  });

  // Reset demo
  document.getElementById('ph-reset').addEventListener('click', () => {
    if (speechSynth) speechSynth.cancel();
    stopTimer();
    clearChat();
    clearOptions();
    demoRunning = false;
    startBtn.textContent = '📞 Start Live Call';
    startBtn.disabled = false;
    showState('idle');
  });

});
