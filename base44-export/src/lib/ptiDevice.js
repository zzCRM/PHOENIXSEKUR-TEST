import { classifyCapabilities, detectPlatform } from '@/lib/ptiRules';

export async function readDeviceSnapshot(extra = {}) {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  const snapshot = {
    userAgent: nav?.userAgent || '',
    platform: detectPlatform(nav?.userAgent || ''),
    hasGeolocation: Boolean(nav?.geolocation),
    geoState: extra.geoState || 'unknown',
    geoFix: Boolean(extra.geoFix),
    hasMotionApi: typeof DeviceMotionEvent !== 'undefined',
    motionPermission: extra.motionPermission || 'unknown',
    motionSamples: extra.motionSamples || 0,
    hasBatteryApi: typeof nav?.getBattery === 'function',
    batteryLevel: null,
    hasNotification: typeof Notification !== 'undefined',
    notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    hasVibrate: typeof nav?.vibrate === 'function',
    onLine: nav ? nav.onLine !== false : false,
  };
  if (nav?.permissions?.query && snapshot.geoState === 'unknown') {
    try {
      const geo = await nav.permissions.query({ name: 'geolocation' });
      if (geo?.state === 'denied') snapshot.geoState = 'denied';
      else if (geo?.state) snapshot.geoState = geo.state;
    } catch {
      /* nom de permission non géré */
    }
  }
  if (snapshot.hasBatteryApi) {
    try {
      const battery = await nav.getBattery();
      if (battery && Number.isFinite(Number(battery.level))) {
        snapshot.batteryLevel = Math.round(Number(battery.level) * 100);
      }
    } catch {
      snapshot.batteryLevel = null;
    }
  }
  return snapshot;
}

export function describeFeatures(snapshot) {
  if (!snapshot) return null;
  return classifyCapabilities(snapshot);
}

export const FEATURE_LABELS = {
  geolocation_foreground: 'GPS au premier plan',
  geolocation_background: 'GPS en arrière-plan',
  motion: 'Détection de mouvement',
  verticality: 'Perte de verticalité',
  immobility: 'Détection d’immobilité',
  battery: 'Niveau de batterie',
  visible_notification: 'Notification écran allumé',
  push_background: 'Notification arrière-plan',
  vibration: 'Vibreur',
  sos: 'Bouton SOS dans la page',
};

export const STATE_LABELS = {
  available: 'Disponible sur cet appareil',
  unavailable: 'Indisponible',
  unverified: 'API présente, pas encore de mesure',
  denied: 'Autorisation refusée',
  page: 'Dans la page ouverte',
};
