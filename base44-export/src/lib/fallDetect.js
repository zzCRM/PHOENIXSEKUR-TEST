/** Angle (degrés) entre l’axe long du téléphone (Y) et la verticale. 0 = debout, 90 = à plat. */
export function tiltFromVertical(x, y, z) {
  const mag = magnitude(x, y, z);
  if (mag < 4) return 0;
  const cos = Math.min(1, Math.abs(Number(y) || 0) / mag);
  return (Math.acos(cos) * 180) / Math.PI;
}

export function isLossOfVerticality(tiltDeg, thresholdDeg = 50) {
  return Number(tiltDeg) >= thresholdDeg;
}

export function magnitude(x, y, z) {
  return Math.sqrt((Number(x) || 0) ** 2 + (Number(y) || 0) ** 2 + (Number(z) || 0) ** 2);
}
