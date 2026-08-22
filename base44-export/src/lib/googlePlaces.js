import { base44 } from '@/api/base44Client';

// Module-level caches: load key + Google Maps script ONCE across the app.
let _keyPromise = null;
let _scriptPromise = null;

export function getMapsApiKey() {
  if (!_keyPromise) {
    _keyPromise = base44.functions.invoke('getGoogleMapsApiKey', {})
      .then(res => res.data?.apiKey || '')
      .catch(() => '');
  }
  return _keyPromise;
}

// Single shared loader for the Google Maps JS API.
// Loads BOTH places + geometry libraries in ONE script so we never inject a
// second <script> with different params (which triggers the
// "For development purposes only" watermark / API conflicts).
export function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject('no window');
  if (window.google?.maps?.places && window.google?.maps?.geometry) {
    return Promise.resolve(window.google.maps);
  }
  if (_scriptPromise) return _scriptPromise;

  _scriptPromise = getMapsApiKey().then((key) => {
    if (!key) throw new Error('No Google Maps API key');
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-places]');
      if (existing && window.google?.maps) { resolve(window.google.maps); return; }
      if (existing && !window.google?.maps) {
        existing.addEventListener('load', () => resolve(window.google.maps));
        existing.addEventListener('error', () => reject('load error'));
        return;
      }
      // Use a callback so the promise resolves only AFTER the API is fully
      // bootstrapped (google.maps.Map / places / geometry all usable).
      const cb = '___gmaps_shared_cb';
      window[cb] = () => { resolve(window.google.maps); delete window[cb]; };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry&language=fr&region=FR&v=weekly&callback=${cb}`;
      s.async = true;
      s.setAttribute('data-google-places', 'true');
      s.onerror = () => { _scriptPromise = null; reject('script error'); };
      document.head.appendChild(s);
    });
  });

  return _scriptPromise;
}

// Back-compat alias: just ensure the shared script is loaded.
export function loadPlacesLibrary() {
  return loadGoogleMaps().then(() => {});
}

// Force a clean reload (dev/preview with a stale script loaded without loading=async)
export function resetPlacesLibrary() {
  _scriptPromise = null;
  document.querySelectorAll('script[data-google-places]').forEach(s => s.remove());
  try { delete window.google; } catch (e) { window.google = undefined; }
}

// Parse a Google Place result (supports both legacy Autocomplete and new
// PlaceAutocompleteElement Place object formats) into a structured address.
export function parsePlace(place) {
  if (!place) return null;

  // New PlaceAutocompleteElement format: addressComponents (array of {longText, shortText, types})
  const components = place.addressComponents || place.address_components;
  if (!components && !place.formattedAddress && !place.formatted_address) return null;

  const get = (type) => {
    const c = components?.find(c => c.types.includes(type));
    return c ? (c.longText ?? c.long_name ?? '') : '';
  };
  const getShort = (type) => {
    const c = components?.find(c => c.types.includes(type));
    return c ? (c.shortText ?? c.short_name ?? '') : '';
  };

  const streetNumber = get('street_number');
  const route = get('route');
  const address = [streetNumber, route].filter(Boolean).join(' ');
  const postal_code = get('postal_code');
  const city = get('locality') || get('postal_town') || get('administrative_area_level_2') || get('sublocality') || '';
  const country = get('country') || getShort('country') || '';

  // Location: new format place.location is a LatLng; legacy place.geometry.location
  let lat, lng;
  if (place.location) {
    lat = typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat;
    lng = typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng;
  } else if (place.geometry?.location) {
    lat = typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat;
    lng = typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng;
  }

  return {
    address,
    postal_code,
    city,
    country,
    latitude: typeof lat === 'number' ? parseFloat(lat.toFixed(6)) : null,
    longitude: typeof lng === 'number' ? parseFloat(lng.toFixed(6)) : null,
    formatted: place.formattedAddress || place.formatted_address || '',
  };
}