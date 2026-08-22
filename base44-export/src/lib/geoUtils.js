/** Distance en mètres entre deux points GPS (formule haversine). */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isOutsideGeofence(agentLat, agentLng, siteLat, siteLng, radiusMeters) {
  const dist = distanceMeters(agentLat, agentLng, siteLat, siteLng);
  if (dist == null) return false;
  return dist > (radiusMeters || 200);
}
