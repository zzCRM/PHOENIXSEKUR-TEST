let audioCtx = null;
let alarmTimer = null;
let vibrateTimer = null;
let oscNode = null;
let gainNode = null;
let htmlAudio = null;

export async function unlockPtiAudio() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch { /* ignore */ }
  }
  return audioCtx;
}

function buildSirenDataUri() {
  const sampleRate = 8000;
  const seconds = 1.2;
  const n = sampleRate * seconds;
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / sampleRate;
    const f = 850 + 450 * Math.sin(2 * Math.PI * 2.4 * t);
    samples[i] = Math.floor(Math.sin(2 * Math.PI * f * t) * 26000);
  }
  const bytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const view = new DataView(buf);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i += 1) view.setInt16(44 + i * 2, samples[i], true);
  const u8 = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < u8.length; i += 1) bin += String.fromCharCode(u8[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export function announcePtiPreAlarm() {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(
      'Alerte. Perte de verticalité. Confirmez si tout va bien, ou appelez les secours.',
    );
    u.lang = 'fr-FR';
    u.rate = 1;
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export async function startPtiAlarm() {
  stopPtiAlarm();
  const ctx = await unlockPtiAudio();
  if (ctx && ctx.state === 'running') {
    oscNode = ctx.createOscillator();
    gainNode = ctx.createGain();
    oscNode.type = 'square';
    gainNode.gain.value = 0.38;
    oscNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscNode.frequency.setValueAtTime(780, ctx.currentTime);
    oscNode.start();
    const sweep = () => {
      if (!oscNode || !audioCtx) return;
      const t = audioCtx.currentTime;
      oscNode.frequency.cancelScheduledValues(t);
      oscNode.frequency.setValueAtTime(780, t);
      oscNode.frequency.linearRampToValueAtTime(1500, t + 0.32);
      oscNode.frequency.linearRampToValueAtTime(780, t + 0.64);
    };
    sweep();
    alarmTimer = setInterval(sweep, 640);
  }

  try {
    htmlAudio = new Audio(buildSirenDataUri());
    htmlAudio.loop = true;
    htmlAudio.volume = 1;
    await htmlAudio.play();
  } catch { /* ignore */ }

  const buzz = () => {
    try { navigator.vibrate?.([400, 120, 400, 120, 400]); } catch { /* ignore */ }
  };
  buzz();
  vibrateTimer = setInterval(buzz, 1100);
  announcePtiPreAlarm();
}

export function stopPtiAlarm() {
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
  if (vibrateTimer) {
    clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  try { oscNode?.stop(); } catch { /* ignore */ }
  oscNode = null;
  try { gainNode?.disconnect(); } catch { /* ignore */ }
  gainNode = null;
  if (htmlAudio) {
    try { htmlAudio.pause(); htmlAudio.src = ''; } catch { /* ignore */ }
    htmlAudio = null;
  }
  try { navigator.vibrate?.(0); } catch { /* ignore */ }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

export function dialNumber(tel) {
  const n = String(tel || '').trim();
  if (!n) return false;
  window.location.href = `tel:${n}`;
  return true;
}
