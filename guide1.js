/* guide1.js — the iOS 6 setup wizard.
 *
 * One linear sequence of 7 steps for the Legacy Swift Development Kit:
 * choose macOS (0), downloads (1), open the kit (2), install the environment
 * (3), open a project (4), build the IPA (5) and the finale (6). The macOS
 * choice picks Native or Modern mode; .os-opt paragraphs follow it.
 *
 * With JS on the wizard runs as a full-screen app (body.wiz-app): the page
 * itself never scrolls — only the step stage scrolls when a step outgrows
 * the viewport. Every actionable step carries its confirmation inside the
 * Next button: one click ticks it (the button lights up green), a second
 * click advances. No-JS visitors see the whole guide stacked with the
 * standalone checkboxes instead.
 */
(function () {
  const shell = document.querySelector('.wiz-viewport');
  if (!shell) return;

  /* JS mode: the wizard takes over the whole viewport (see body.wiz-app CSS). */
  document.body.classList.add('wiz-app');
  /* The reader scrolls the in-flow page to reach the OS picker (before the
     wizard opens the document is ~217px taller than the viewport — that
     overflow is the site footer). That offset must not survive into app mode:
     it would slide the footer up behind the fixed shell, whose brand and
     "Previous: …" link then drew across the Back/Next controls. */
  try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }
  catch (e) { window.scrollTo(0, 0); }

  const steps = Array.from(shell.querySelectorAll('.wizard-step'));

  const TOTAL = steps.length;
  const LAST = TOTAL - 1;

  /* start: first logical step of the phase, for the "n of span" label */
  const PHASES = [
    { name: 'Setup',   tick: 'a', title: 'Preparing Your Mac',         start: 0, span: 3 },
    { name: 'Install', tick: 'b', title: 'Installing the Environment', start: 3, span: 1 },
    { name: 'Build',   tick: 'c', title: 'Building Your App',          start: 4, span: 2 },
    { name: 'Done',    tick: 'd', title: "You're All Set",             start: 6, span: 1 }
  ];
  function phaseFor(pos) {
    return pos < 3 ? 0 : pos === 3 ? 1 : pos < LAST ? 2 : 3;
  }

  const kickerTick = document.querySelector('#wizard .section-head .tick');
  const kicker     = document.getElementById('wiz-kicker');
  const title      = document.getElementById('wiz-title');
  const back       = document.getElementById('wiz-back');
  const next       = document.getElementById('wiz-next');
  const nextLabel  = document.getElementById('wiz-next-label');
  const restart    = document.getElementById('wiz-restart');
  const progressLabel = document.getElementById('wiz-progress-label');
  const ticks      = document.getElementById('wiz-ticks');
  const announcer  = document.getElementById('wiz-announcer');

  /* The phase's step ticks: a run of marks showing how far through the phase
     the reader is. Same information as the label, read at a glance. */
  function renderTicks(index, total, complete) {
    if (!ticks || !total) return;
    if (ticks.childElementCount !== total) {
      ticks.textContent = '';
      for (let i = 0; i < total; i++) ticks.appendChild(document.createElement('span'));
    }
    Array.prototype.forEach.call(ticks.children, function (t, i) {
      t.classList.toggle('is-done', complete || i < index - 1);
      t.classList.toggle('is-current', !complete && i === index - 1);
    });
  }

  const state = { pos: 0, os: null };

  /* Logical positions whose confirmation has been ticked. Survives Back, so
   * a revisited step shows the button already green — the work is the work. */
  const confirmed = new Set();

  /* ── visibility ─────────────────────────────────────────────── */

  /* These keep the *selection cards* and the per-OS variant paragraphs in
   * sync. The step blocks themselves are clamped in show() — the two must
   * not fight over the same is-hidden class. */
  function applyOS() {
    shell.querySelectorAll('.os-opt').forEach((el) => {
      el.classList.toggle('is-hidden', el.dataset.os !== state.os);
    });
    shell.querySelectorAll('.os-card, .path-card').forEach((card) => {
      card.classList.toggle('is-selected', card.querySelector('input').checked);
    });
  }

  /* ── gating ─────────────────────────────────────────────────── */

  /* The current step's confirmation, if it has one. Returns the hidden box
   * (kept in the DOM as the source of truth and the no-JS fallback) plus the
   * label text that lives inside the Next button until it's ticked. */
  function armAt(pos) {
    const el = steps[pos];
    const box = el && el.querySelector('.confirm-box');
    if (!box) return null;
    const text = (el.querySelector('.wiz-confirm span') || {}).textContent || 'Done';
    return { box, text };
  }

  function advance(from) { return from + 1; }
  function retreat(from) { return from - 1; }

  function refreshControls() {
    const pos = state.pos;
    back.disabled = pos === 0;
    next.hidden = pos === LAST;
    restart.hidden = pos !== LAST;

    if (pos === LAST) {
      next.disabled = false;
      next.classList.remove('is-armed');
      if (nextLabel) nextLabel.textContent = 'Next step';
    } else {
      const arm = armAt(pos);
      if (arm) {
        /* confirmation lives in the button itself: first click ticks it,
         * second advances — so it's enabled from the start */
        const done = confirmed.has(pos);
        next.disabled = false;
        next.classList.toggle('is-armed', !!done);
        if (nextLabel) nextLabel.textContent = done ? 'Next step' : arm.text;
      } else {
        /* the macOS choice: plain Next, disabled until chosen */
        next.disabled = !state.os;
        next.classList.remove('is-armed');
        if (nextLabel) nextLabel.textContent = 'Next step';
      }
    }

    const stage = pos < 3 ? 0 : pos === 3 ? 1 : 2;
    document.querySelectorAll('.installer-phases li').forEach((item, index) => {
      item.classList.toggle('is-done', index < stage);
      if (index === stage) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    const context = document.getElementById('installer-context');
    if (context) {
      const osNames = { native: 'macOS Monterey · Native mode', modern: 'macOS 13 or later · Modern mode' };
      context.textContent = state.os ? osNames[state.os] : 'Choose a macOS version to get started.';
    }
    const p = phaseFor(pos);
    if (kickerTick) kickerTick.textContent = PHASES[p].tick;
    kicker.textContent = PHASES[p].name;
    title.textContent = PHASES[p].title;

    if (pos === LAST) {
      progressLabel.textContent = 'Setup complete';
      renderTicks(PHASES[p].span, PHASES[p].span, true);
    } else {
      const index = pos - PHASES[p].start + 1;
      const badge = steps[pos].querySelector('.step-badge');
      if (badge) badge.textContent = String(index);
      progressLabel.textContent = PHASES[p].name + ' · ' + index + ' of ' + PHASES[p].span;
      renderTicks(index, PHASES[p].span, false);
    }
  }

  /* ── navigation ─────────────────────────────────────────────── */

  /* Respects the site-wide reduced-motion preference (site.js exposes
     window.motionOK; the fallback keeps the gate even if site.js is gone). */
  function canMotion() {
    if (typeof window.motionOK === 'function') return window.motionOK();
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* Step swaps are choreographed, not cut: the outgoing step fades up and
   * out (short, soft), then the incoming one rises into place. A generation
   * counter cancels stale swaps when the user clicks faster than the exit,
   * so the newest navigation always wins. */
  let gen = 0;
  let swapTimer = 0;
  let visibleEl = null;

  function show(pos, announce) {
    const g = ++gen;
    if (swapTimer) { clearTimeout(swapTimer); swapTimer = 0; }
    state.pos = Math.max(0, Math.min(pos, LAST));
    const i = state.pos;
    const target = steps[i];
    const prev = visibleEl && visibleEl !== target ? visibleEl : null;
    const motion = canMotion();

    if (motion && prev) prev.classList.add('wiz-exit');

    const apply = () => {
      if (g !== gen) return;   /* superseded by a newer navigation */
      if (swapTimer) { clearTimeout(swapTimer); swapTimer = 0; }
      if (prev) prev.classList.remove('wiz-exit');
      applyOS();
      steps.forEach((el, k) => el.classList.toggle('is-hidden', k !== i));
      if (motion && !target.classList.contains('wiz-arrive')) {
        /* reflow *after* the start state is committed — a frame callback
         * here would be coalesced into the same style pass and the
         * transition would never fire, so the step would pop in flat */
        target.classList.remove('wiz-exit', 'wiz-enter', 'wiz-shown');
        target.classList.add('wiz-enter');
        void target.offsetWidth;
        target.classList.add('wiz-shown');
      }
      visibleEl = target;
      shell.scrollTop = 0;
      refreshControls();
      if (announce) {
        const h3 = target.querySelector('h3');
        announcer.textContent = 'Step ' + (state.pos + 1) + ' of ' + TOTAL + ': ' +
          (h3 ? h3.textContent : '');
      }
      syncHints();
    };

    if (motion && prev) swapTimer = setTimeout(apply, 180);
    else apply();
  }

  /* ── wiring ─────────────────────────────────────────────────── */

  next.addEventListener('click', () => {
    if (state.pos === LAST) return;
    const arm = armAt(state.pos);
    if (arm && !confirmed.has(state.pos)) {
      /* first click: tick the confirmation — the button lights up green */
      confirmed.add(state.pos);
      arm.box.checked = true;     /* keep the DOM box in sync (restart, no-JS) */
      next.classList.add('is-armed');
      if (nextLabel) nextLabel.textContent = 'Next step';
      announcer.textContent = 'Marked as done.';
      return;
    }
    show(advance(state.pos), true);
  });

  back.addEventListener('click', () => show(retreat(state.pos), true));

  restart.addEventListener('click', () => {
    confirmed.clear();
    shell.querySelectorAll('.confirm-box').forEach((box) => (box.checked = false));
    show(0, true);
  });

  shell.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'wizard-os') {
      state.os = t.value;
    } else if (t.classList.contains('confirm-box')) {
      /* the box is hidden in JS mode, but keep the set and the button in
       * sync with it either way */
      if (t.checked) confirmed.add(state.pos);
      else confirmed.delete(state.pos);
    } else {
      return;
    }
    applyOS();
    refreshControls();
  });

  /* ── screenshot preview ─────────────────────────────────────── */

  /* A shot is a figure below its text; clicking it opens a full-screen
   * preview, and clicking anywhere on the overlay (or Esc) closes it. */
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.hidden = true;
  lb.tabIndex = -1;
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Screenshot preview — click anywhere to close');
  const lbImg = document.createElement('img');
  lbImg.alt = '';
  lb.appendChild(lbImg);
  const lbClose = document.createElement('button');
  lbClose.className = 'btn btn-ghost lightbox-close';
  lbClose.type = 'button';
  lbClose.textContent = 'Close preview ×';
  lb.appendChild(lbClose);
  document.body.appendChild(lb);

  let lbFocus = null;
  function closeLb() {
    lb.classList.remove('is-open');
    setTimeout(() => { lb.hidden = true; }, canMotion() ? 200 : 0);
    if (lbFocus) lbFocus.focus();
  }
  lb.addEventListener('click', closeLb);
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'Tab') { e.preventDefault(); lbClose.focus(); }
  });
  shell.addEventListener('click', (e) => {
    const shot = e.target.closest('.shot');
    if (!shot) return;
    const img = shot.querySelector('img');
    if (!img) return;
    lbFocus = document.activeElement;
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lb.hidden = false;
    void lb.offsetWidth;   /* commit the hidden state before the fade-in */
    lb.classList.add('is-open');
    lbClose.focus();
  });

  /* ── scroll affordance ──────────────────────────────────────── */

  /* When a step outgrows the stage, its edges dissolve into the background
   * (the fades in styles.css) — the cut reads as "there is more below",
   * never as content colliding with the controls. */
  function syncHints() {
    shell.style.setProperty('--wiz-space', shell.clientHeight + 'px');
    const ov = shell.scrollHeight > shell.clientHeight + 8;
    shell.classList.toggle('is-overflow', ov);
    shell.classList.toggle(
      'is-atend',
      !ov || shell.scrollTop + shell.clientHeight >= shell.scrollHeight - 8);
    shell.classList.toggle('is-scrolled', shell.scrollTop > 8);
  }
  shell.addEventListener('scroll', syncHints, { passive: true });
  window.addEventListener('resize', syncHints);
  window.addEventListener('load', syncHints);
  if ('ResizeObserver' in window) new ResizeObserver(syncHints).observe(shell);

  /* ── first paint ────────────────────────────────────────────── */

  const arrival = steps[0];
  const finishArrival = () => arrival.classList.remove('wiz-arrive');
  arrival.addEventListener('animationend', finishArrival, { once: true });
  /* The first-paint animation may have finished before this script arrives. */
  setTimeout(finishArrival, 500);
  show(0, false);
  syncHints();
  /* the board is ours now — release the pre-paint claim the inline head
   * script took (see html.wiz-app in styles.css) */
  document.documentElement.classList.remove('wiz-app');
})();
