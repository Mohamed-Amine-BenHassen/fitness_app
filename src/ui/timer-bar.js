// Rest timer bar, fixed above the tab bar. Built once and updated in place —
// it never triggers a full render, so ticking can't disturb inputs on the page.
// Countdown maths lives in src/core/timer.js.

import { formatClock, isDone, isStale, remainingMs, remainingRatio } from '../core/timer.js';
import { clear, el } from './dom.js';

const TICK_MS = 250;
const DONE_BANNER_MS = 4000;

// ---------- alert: vibration + beep ----------

let audio = null;

// Browsers only allow sound after a user gesture, so this runs from the Start
// rest tap; the context then stays usable for the beep at the end.
export function unlockAudio() {
  try {
    audio = audio || new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
}

function beep() {
  if (!audio) return;
  const t = audio.currentTime;
  // Three short 880 Hz pips.
  for (const offset of [0, 0.25, 0.5]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.4, t + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.2);
  }
}

function alertDone() {
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  beep();
}

// ---------- screen wake lock ----------

// Keeps the screen on while resting so the alert can fire. The browser drops
// the lock whenever the app is hidden, so it is re-requested on return.
let wakeLock = null;

async function holdScreen() {
  if (wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null; // Unsupported or refused (e.g. battery saver): carry on without it.
  }
}

function releaseScreen() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

// ---------- the bar ----------

export function createTimerBar(root, { onAdjust, onSkip, onDone }) {
  let timer = null;
  let interval = 0;
  let bannerTimeout = 0;

  const label = el('span', { class: 'timer-label' });
  const clock = el('span', { class: 'timer-clock', 'aria-live': 'off' });
  const fill = el('div');
  const controls = el('div', { class: 'timer-controls' }, [
    el('button', { type: 'button', 'aria-label': 'Fifteen seconds less', onclick: () => onAdjust(-15) }, '−15'),
    el('button', { type: 'button', 'aria-label': 'Fifteen seconds more', onclick: () => onAdjust(15) }, '+15'),
    el('button', { type: 'button', class: 'primary', onclick: () => onSkip() }, 'Skip')
  ]);

  clear(root);
  root.append(
    el('div', { class: 'timer-row' }, [el('div', { class: 'timer-text' }, [label, clock]), controls]),
    el('div', { class: 'timer-progress' }, [fill])
  );

  function setVisible(visible) {
    root.hidden = !visible;
    document.body.classList.toggle('has-timer', visible);
  }

  function stopTicking() {
    clearInterval(interval);
    interval = 0;
  }

  function tick() {
    if (!timer) return;
    const now = Date.now();
    clock.textContent = formatClock(remainingMs(timer, now));
    fill.style.width = `${remainingRatio(timer, now) * 100}%`;
    if (!isDone(timer, now)) return;

    stopTicking();
    releaseScreen();
    alertDone();
    timer = null;
    root.classList.add('done');
    label.textContent = 'Rest over';
    clock.textContent = 'Next set';
    controls.hidden = true;
    bannerTimeout = setTimeout(() => setVisible(false), DONE_BANNER_MS);
    onDone();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !timer) return;
    if (isStale(timer, Date.now())) {
      // Back long after the rest ended: an alert now would just be noise.
      timer = null;
      stopTicking();
      setVisible(false);
      onDone();
      return;
    }
    holdScreen();
    tick(); // Fires the alert straight away if the rest ended while the screen was off.
  });

  return {
    show(next) {
      clearTimeout(bannerTimeout);
      timer = next;
      if (!timer) {
        stopTicking();
        releaseScreen();
        setVisible(false);
        return;
      }
      root.classList.remove('done');
      controls.hidden = false;
      label.textContent = timer.label ? `Rest · ${timer.label}` : 'Rest';
      setVisible(true);
      holdScreen();
      if (!interval) interval = setInterval(tick, TICK_MS);
      tick();
    }
  };
}
