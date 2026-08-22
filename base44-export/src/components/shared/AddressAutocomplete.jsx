import React, { useEffect, useRef, useState, useId } from 'react';
import { Input } from '@/components/ui/input';
import { loadPlacesLibrary, parsePlace } from '@/lib/googlePlaces';
import { MapPin, Loader2, Search } from 'lucide-react';

/**
 * AddressAutocomplete
 * Uses google.maps.places.AutocompleteService (programmatic) + Place.fetchFields
 * for details, with a custom dropdown. Works with new and legacy API keys.
 *
 * Props:
 *   value — current address string (controlled)
 *   onPlaceSelect(place) — parsed { address, postal_code, city, country, latitude, longitude, formatted }
 *   onChange(text) — free typing
 *   placeholder, className, name, id, required
 */
export default function AddressAutocomplete({
  value,
  onPlaceSelect,
  onChange,
  placeholder = 'Commencez à taper l\'adresse...',
  className = '',
  name,
  id,
  required,
}) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [text, setText] = useState(value || '');
  const [predictions, setPredictions] = useState([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [hi, setHi] = useState(-1);
  const serviceRef = useRef(null);
  const tokenRef = useRef(null);
  const debounceRef = useRef(null);
  const listId = useId();

  useEffect(() => { setText(value || ''); }, [value]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadPlacesLibrary()
      .then(() => {
        if (cancelled || !window.google?.maps?.places) { if (!cancelled) setStatus('error'); return; }
        try {
          serviceRef.current = new window.google.maps.places.AutocompleteService();
          tokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
          setStatus('ready');
        } catch (e) {
          if (!cancelled) setStatus('error');
        }
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runQuery = (q) => {
    if (!serviceRef.current || q.trim().length < 3) { setPredictions([]); setOpen(false); return; }
    setFetching(true);
    serviceRef.current.getPlacePredictions(
      {
        input: q,
        types: ['address'],
        componentRestrictions: { country: ['fr', 'be', 'mc', 'lu', 'ch'] },
        sessionToken: tokenRef.current,
      },
      (results, status) => {
        setFetching(false);
        if (!results || results.length === 0) { setPredictions([]); return; }
        setPredictions(results);
        setOpen(true);
        setHi(-1);
      }
    );
  };

  const handleText = (v) => {
    setText(v);
    onChange?.(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runQuery(v), 280);
  };

  const selectPrediction = async (pred) => {
    setOpen(false);
    setFetching(true);
    try {
      const Place = window.google.maps.places.Place;
      const place = new Place({ id: pred.place_id });
      await place.fetchFields({ fields: ['addressComponents', 'formattedAddress', 'location'] });
      const parsed = parsePlace(place);
      if (parsed) {
        if (parsed.address) setText(parsed.address);
        if (onPlaceSelect) onPlaceSelect(parsed);
      } else {
        setText(pred.description);
        onChange?.(pred.description);
      }
      // new session token for next query
      tokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    } catch (e) {
      setText(pred.description);
      onChange?.(pred.description);
    }
    setFetching(false);
  };

  const onKey = (e) => {
    if (!open || predictions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(p => (p + 1) % predictions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(p => (p <= 0 ? predictions.length - 1 : p - 1)); }
    else if (e.key === 'Enter') { if (hi >= 0) { e.preventDefault(); selectPrediction(predictions[hi]); } }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        name={name}
        id={id}
        required={required}
        value={text}
        onChange={(e) => handleText(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => { if (predictions.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={`${className} ${status === 'ready' ? 'pr-9' : status === 'loading' ? 'pr-9' : ''}`}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
      />
      {status === 'loading' && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin pointer-events-none" />
      )}
      {status === 'ready' && (
        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
      )}
      {fetching && status === 'ready' && (
        <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin pointer-events-none" />
      )}

      {open && predictions.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-[10000] left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {predictions.map((p, i) => (
            <button
              type="button"
              key={p.place_id}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); selectPrediction(p); }}
              onMouseEnter={() => setHi(i)}
              className={`w-full flex items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${i === hi ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
            >
              <Search className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="leading-tight">{p.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}