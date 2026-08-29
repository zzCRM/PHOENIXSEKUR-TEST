/** Heuristique chute : impact fort puis immobilité (téléphone à plat). */
export function isFallPattern(magnitudes) {
  if (!Array.isArray(magnitudes) || magnitudes.length < 8) return false;
  const recent = magnitudes.slice(-12);
  const peak = Math.max(...recent);
  const tail = recent.slice(-4);
  const still = tail.every((m) => m < 4.5);
  return peak >= 22 && still;
}

export function magnitude(x, y, z) {
  return Math.sqrt((Number(x) || 0) ** 2 + (Number(y) || 0) ** 2 + (Number(z) || 0) ** 2);
}
