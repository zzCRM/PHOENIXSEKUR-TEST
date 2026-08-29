export function magnitude(x, y, z) {
  return Math.sqrt((Number(x) || 0) ** 2 + (Number(y) || 0) ** 2 + (Number(z) || 0) ** 2);
}

/** Angle (degrés) entre l’axe long du téléphone (Y) et la verticale. 0 = debout, 90 = à plat. */
export function tiltFromVertical(x, y, z) {
  const mag = magnitude(x, y, z);
  if (mag < 4) return 0;
  const cos = Math.min(1, Math.abs(Number(y) || 0) / mag);
  return (Math.acos(cos) * 180) / Math.PI;
}

const IMPACT_G = 22;
const LINEAR_IMPACT = 15;
const TILT_SNAP_DEG = 45;
const TILT_SNAP_MS = 320;
const UPRIGHT_MAX = 38;
const FLAT_MIN = 58;

/**
 * Chute brutale : choc (pic d’accélération) ou bascule soudaine depuis la verticale.
 * Poser le téléphone doucement sur une table ne déclenche pas.
 */
export function detectBrutalFall(samples) {
  if (!Array.isArray(samples) || samples.length < 5) return false;
  const last = samples[samples.length - 1];
  if (last.tilt < FLAT_MIN) return false;

  const recent = samples.filter((s) => last.t - s.t <= 900);
  const hadImpact = recent.some((s) => (
    Number(s.mag) >= IMPACT_G || (s.linear != null && Number(s.linear) >= LINEAR_IMPACT)
  ));

  let snap = false;
  for (const a of samples) {
    if (a.tilt > UPRIGHT_MAX) continue;
    if (samples.some((s) => s.t > a.t && s.t - a.t <= TILT_SNAP_MS && s.tilt >= a.tilt + TILT_SNAP_DEG)) {
      snap = true;
      break;
    }
  }
  return hadImpact || snap;
}

export function isUprightTilt(tiltDeg) {
  return Number(tiltDeg) < 50;
}
