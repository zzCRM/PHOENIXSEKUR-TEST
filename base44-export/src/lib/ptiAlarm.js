let audioCtx = null;
let alarmTimer = null;

export async function unlockPtiAudio() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch { /* ignore */ }
  }
  return audioCtx;
}

function beep(freq, duration) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

export function announcePtiPreAlarm() {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(
      'Perte de verticalité. Confirmez si tout va bien, ou appelez les secours.',
    );
    u.lang = 'fr-FR';
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export function startPtiAlarm() {
  stopPtiAlarm();
  unlockPtiAudio();
  const pulse = () => {
    beep(880, 0.2);
    setTimeout(() => beep(1240, 0.22), 220);
    try { navigator.vibrate?.([200, 80, 200, 80, 200]); } catch { /* ignore */ }
  };
  pulse();
  alarmTimer = setInterval(pulse, 850);
}

export function stopPtiAlarm() {
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}
