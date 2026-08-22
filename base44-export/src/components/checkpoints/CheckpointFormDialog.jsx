import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Paperclip, Wifi, MapPin, X, Loader2, Navigation, ScanLine } from 'lucide-react';
import NfcScanner from '@/components/nfc/NfcScanner';

const SECTIONS = [
  { key: 'site', icon: '📍', label: 'Site' },
  { key: 'nfc', icon: '📡', label: 'NFC' },
  { key: 'description', icon: '📄', label: 'Description' },
  { key: 'attributs', icon: '⚙️', label: 'Attributs' },
  { key: 'photo', icon: '📷', label: 'Prendre une photo' },
];

// Google Maps iframe with click-to-pin via postMessage bridge
function GoogleMapPicker({ lat, lng, onLocationChange }) {
  const iframeRef = useRef(null);
  const [mapLayer, setMapLayer] = useState('roadmap');

  // Center coords for the iframe src
  const center = lat && lng ? `${lat},${lng}` : '48.8566,2.3522';
  const zoom = lat && lng ? 17 : 13;

  // Rebuild iframe URL when layer or center changes
  const mapSrc = `https://maps.google.com/maps?q=${center}&t=${mapLayer === 'satellite' ? 'k' : 'm'}&z=${zoom}&output=embed&hl=fr`;

  // We overlay a transparent div to capture clicks and use reverse geocode
  const overlayRef = useRef(null);

  const handleOverlayClick = useCallback((e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    // Approximate pixel-to-latlng conversion based on current center/zoom
    const TILE_SIZE = 256;
    const scale = Math.pow(2, zoom);
    const worldCoordCenter = project(parseFloat(center.split(',')[0]), parseFloat(center.split(',')[1]));
    const pixelCenter = { x: worldCoordCenter.x * scale, y: worldCoordCenter.y * scale };
    const mapPixelW = rect.width;
    const mapPixelH = rect.height;

    const pixelX = pixelCenter.x + (xRatio - 0.5) * mapPixelW;
    const pixelY = pixelCenter.y + (yRatio - 0.5) * mapPixelH;

    const worldX = pixelX / scale;
    const worldY = pixelY / scale;

    const newLat = unprojectLat(worldY);
    const newLng = unprojectLng(worldX);

    onLocationChange(parseFloat(newLat.toFixed(6)), parseFloat(newLng.toFixed(6)));
  }, [center, zoom, onLocationChange]);

  return (
    <div className="flex-1 flex flex-col relative h-full">
      {/* Toggle Plan / Satellite */}
      <div className="absolute top-3 left-3 z-20 flex rounded-lg overflow-hidden border bg-white shadow-sm">
        <button
          onClick={() => setMapLayer('roadmap')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${mapLayer === 'roadmap' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
        >
          Plan
        </button>
        <button
          onClick={() => setMapLayer('satellite')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${mapLayer === 'satellite' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
        >
          Satellite
        </button>
      </div>

      {/* Google Maps iframe */}
      <iframe
        ref={iframeRef}
        src={mapSrc}
        className="w-full h-full border-0"
        allowFullScreen
        loading="lazy"
        title="Google Maps"
      />

      {/* Transparent overlay to capture clicks */}
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className="absolute inset-0 z-10 cursor-crosshair"
        style={{ background: 'transparent' }}
      />

      {/* Pin indicator */}
      {lat && lng && (
        <div className="absolute bottom-3 left-3 z-20 bg-white border rounded-lg px-3 py-1.5 text-xs shadow flex items-center gap-1.5 text-green-700">
          <MapPin className="w-3 h-3" />
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </div>
      )}
    </div>
  );
}

// Mercator projection helpers
function project(lat, lng) {
  const TILE_SIZE = 256;
  const siny = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: TILE_SIZE * (0.5 + lng / 360),
    y: TILE_SIZE * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)),
  };
}
function unprojectLat(worldY) {
  const TILE_SIZE = 256;
  const y = worldY / TILE_SIZE - 0.5;
  return (2 * Math.atan(Math.exp(-2 * Math.PI * y)) - Math.PI / 2) * (180 / Math.PI);
}
function unprojectLng(worldX) {
  const TILE_SIZE = 256;
  return (worldX / TILE_SIZE - 0.5) * 360;
}

export default function CheckpointFormDialog({ open, onClose, onSave, checkpoint, rondes, clients, sites }) {
  const defaultForm = {
    name: '', description: '', nfc_tag_id: '', photo_url: '',
    ronde_id: '', cp_id: null, client_id: '', site_id: '',
    latitude: null, longitude: null,
    batiment: '', etage: '', numero_clef: '',
    is_start: false, is_end: false,
  };

  const [form, setForm] = useState(defaultForm);
  const [activeSection, setActiveSection] = useState('site');
  const [geolocating, setGeolocating] = useState(false);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    setForm(checkpoint ? { ...defaultForm, ...checkpoint } : defaultForm);
    setActiveSection('site');
    setGeoBlocked(false);
    // Auto-geolocation on open (unless editing existing with coords)
    if (open && !checkpoint?.latitude) {
      setGeolocating(true);
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setForm(f => ({ ...f, latitude: parseFloat(pos.coords.latitude.toFixed(6)), longitude: parseFloat(pos.coords.longitude.toFixed(6)) }));
          setGeolocating(false);
        },
        () => { setGeoBlocked(true); setGeolocating(false); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [checkpoint, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const filteredSites = sites?.filter(s => !form.client_id || s.client_id === form.client_id) || [];
  const filteredRondes = rondes?.filter(r => !form.site_id || r.site_id === form.site_id) || [];

  // Get current GPS position
  const fetchGeolocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Géolocalisation non disponible')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: parseFloat(pos.coords.latitude.toFixed(6)), lng: parseFloat(pos.coords.longitude.toFixed(6)) }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  // NFC scan callback — capture tag id + auto-fetch GPS
  const handleNfcCaptured = async (tagId) => {
    set('nfc_tag_id', tagId);
    setGeolocating(true);
    try {
      const { lat, lng } = await fetchGeolocation();
      setForm(f => ({ ...f, latitude: lat, longitude: lng }));
    } catch {
      // silently fail geolocation
    } finally {
      setGeolocating(false);
    }
  };

  // Manual geolocation button
  const handleManualGeolocate = async () => {
    setGeolocating(true);
    try {
      const { lat, lng } = await fetchGeolocation();
      setForm(f => ({ ...f, latitude: lat, longitude: lng }));
    } catch {
      // silently fail
    } finally {
      setGeolocating(false);
    }
  };

  const handleMapLocationChange = useCallback((lat, lng) => {
    setForm(f => ({ ...f, latitude: lat, longitude: lng }));
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('photo_url', file_url);
    setUploading(false);
  };

  const canSave = form.name && form.ronde_id && !geoBlocked;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden" style={{ maxHeight: '92vh' }}>
        <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">Ajout d'un point de contrôle</DialogTitle>
        </DialogHeader>

        {/* Geo blocked warning */}
        {geoBlocked && (
          <div className="mx-5 mt-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <span className="text-lg">🚫</span>
            <div>
              <p className="font-semibold">Géolocalisation requise</p>
              <p className="text-xs mt-0.5">Vous devez autoriser la géolocalisation pour ajouter un point de contrôle. Activez-la dans les paramètres de votre navigateur et rechargez.</p>
            </div>
          </div>
        )}

        {/* Geo loading */}
        {geolocating && !geoBlocked && (
          <div className="mx-5 mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            Récupération de votre position GPS...
          </div>
        )}

        <div className="flex overflow-hidden" style={{ height: 'calc(92vh - 115px)' }}>
          {/* Left sidebar icons */}
          <div className="w-12 border-r bg-muted/20 flex flex-col items-center py-4 gap-3 shrink-0">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                title={s.label}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
                  activeSection === s.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {s.icon}
              </button>
            ))}
          </div>

          {/* Form column */}
          <div className="w-[48%] overflow-y-auto border-r shrink-0">

            {/* SITE */}
            <div className={activeSection === 'site' ? 'px-5 py-4' : 'hidden'}>
              <h3 className="text-sm font-semibold mb-4">Site</h3>
              <div className="space-y-3">
                <div>
                  <Select value={form.client_id} onValueChange={v => { set('client_id', v); set('site_id', ''); set('ronde_id', ''); }}>
                    <SelectTrigger className={!form.client_id ? 'border-red-400' : ''}>
                      <SelectValue placeholder="Client" />
                    </SelectTrigger>
                    <SelectContent>
                      {(clients || []).map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!form.client_id && <p className="text-xs text-red-500 mt-1">Obligatoire</p>}
                </div>
                <Select value={form.site_id} onValueChange={v => { set('site_id', v); set('ronde_id', ''); }}>
                  <SelectTrigger><SelectValue placeholder="Site" /></SelectTrigger>
                  <SelectContent>
                    {filteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={form.ronde_id} onValueChange={v => set('ronde_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Ronde associée" /></SelectTrigger>
                  <SelectContent>
                    {filteredRondes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* NFC */}
            <div className={activeSection === 'nfc' ? 'px-5 py-4' : 'hidden'}>
              <h3 className="text-sm font-semibold mb-4">NFC</h3>

              {/* Scanner NFC de qualité — animation + feedback + saisie manuelle */}
              <div className="mb-4">
                <NfcScanner value={form.nfc_tag_id} onChange={handleNfcCaptured} />
              </div>

              {/* NFC tag confirmed */}
              {form.nfc_tag_id && (
                <div className="mb-3 flex items-center gap-2 text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700">
                  <Wifi className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 truncate">Tag : {form.nfc_tag_id}</span>
                  <button onClick={() => set('nfc_tag_id', '')}><X className="w-3 h-3" /></button>
                </div>
              )}

              <Input
                value={form.nfc_tag_id || ''}
                onChange={e => set('nfc_tag_id', e.target.value)}
                placeholder="ID Tag NFC (saisie manuelle)"
                className="mb-4 text-xs"
              />

              {/* Lat / Lng — auto-filled after NFC scan */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Input
                  value={form.latitude ?? ''}
                  onChange={e => set('latitude', parseFloat(e.target.value) || null)}
                  placeholder="Latitude *"
                  type="number"
                  step="0.000001"
                />
                <Input
                  value={form.longitude ?? ''}
                  onChange={e => set('longitude', parseFloat(e.target.value) || null)}
                  placeholder="Longitude *"
                  type="number"
                  step="0.000001"
                />
              </div>

              {/* Manual geoloc button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={handleManualGeolocate}
                disabled={geolocating}
              >
                {geolocating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Localisation...</>
                  : <><Navigation className="w-3.5 h-3.5" /> Utiliser ma position actuelle</>
                }
              </Button>

              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Ou cliquez sur la carte pour définir la position
              </p>

              {form.latitude && form.longitude && (
                <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Position enregistrée : {form.latitude}, {form.longitude}
                </div>
              )}
            </div>

            {/* DESCRIPTION */}
            <div className={activeSection === 'description' ? 'px-5 py-4' : 'hidden'}>
              <h3 className="text-sm font-semibold mb-4">Description</h3>
              <div className="space-y-3">
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Titre" />
                <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Description et consignes" rows={3} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border border-dashed border-border rounded-lg px-4 py-2.5 text-sm text-muted-foreground flex items-center justify-between hover:bg-muted/30"
                >
                  <span>Pièces jointes</span>
                  <Paperclip className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={form.batiment || ''} onChange={e => set('batiment', e.target.value)} placeholder="Batiment" />
                  <Input value={form.etage || ''} onChange={e => set('etage', e.target.value)} placeholder="Étage" />
                  <Input value={form.numero_clef || ''} onChange={e => set('numero_clef', e.target.value)} placeholder="Numéro de clef" />
                </div>
              </div>
            </div>

            {/* ATTRIBUTS */}
            <div className={activeSection === 'attributs' ? 'px-5 py-4' : 'hidden'}>
              <h3 className="text-sm font-semibold mb-4">Attributs</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <Label className="text-sm font-normal">Point de contrôle de début de mission</Label>
                  </div>
                  <Switch checked={form.is_start} onCheckedChange={v => set('is_start', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                    <Label className="text-sm font-normal">Point de contrôle de fin de mission</Label>
                  </div>
                  <Switch checked={form.is_end} onCheckedChange={v => set('is_end', v)} />
                </div>
              </div>
            </div>

            {/* PHOTO */}
            <div className={activeSection === 'photo' ? 'px-5 py-4' : 'hidden'}>
              <h3 className="text-sm font-semibold mb-4">Prendre une photo</h3>
              <input type="file" accept="image/*" ref={fileRef} onChange={handlePhotoUpload} className="hidden" />
              {form.photo_url ? (
                <div className="relative">
                  <img src={form.photo_url} alt="" className="w-full h-48 object-cover rounded-xl border" />
                  <button onClick={() => set('photo_url', '')} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground text-sm"
                >
                  <span className="text-2xl">📷</span>
                  {uploading ? 'Envoi en cours...' : 'Vous pouvez associer une photo à votre point de contrôle'}
                </button>
              )}
            </div>
          </div>

          {/* Google Maps column */}
          <div className="flex-1 relative overflow-hidden">
            <GoogleMapPicker
              lat={form.latitude}
              lng={form.longitude}
              onLocationChange={handleMapLocationChange}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-muted/20 flex justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => canSave && onSave(form)} disabled={!canSave} className="px-8">
            ENREGISTRER
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}