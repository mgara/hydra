import { useState, useCallback, useRef, useEffect } from 'react';
import { updateSettings } from '@/lib/api';
import { Icon } from './Icon';

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // state/region
}

interface LocationPickerProps {
  currentName: string;
  currentLat: string;
  currentLon: string;
  onUpdate: () => void;
}

export function LocationPicker({ currentName, currentLat, currentLon, onUpdate }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchCity = useCallback((q: string) => {
    if (q.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(data.results ?? []);
        setShowResults(true);
      } catch {
        setError('Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const selectLocation = async (r: GeoResult) => {
    const name = r.admin1 ? `${r.name}, ${r.admin1}, ${r.country}` : `${r.name}, ${r.country}`;
    await updateSettings({
      weather_lat: String(r.latitude),
      weather_lon: String(r.longitude),
      weather_location_name: name,
    });
    setQuery('');
    setResults([]);
    setShowResults(false);
    onUpdate();
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode to get city name
        let name = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
          const revUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto`;
          const revRes = await fetch(revUrl);
          const revData = await revRes.json();
          if (revData.timezone) {
            // Extract city-ish name from timezone like "America/Los_Angeles"
            const parts = revData.timezone.split('/');
            name = parts[parts.length - 1].replace(/_/g, ' ');
          }
        } catch { /* keep coordinate name */ }

        await updateSettings({
          weather_lat: String(latitude),
          weather_lon: String(longitude),
          weather_location_name: name,
        });
        setLocating(false);
        onUpdate();
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location access denied. Allow location in your browser settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable');
            break;
          default:
            setError('Could not get location');
        }
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-4">
      {/* Current location display */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/10">
        <Icon name="location_on" className="text-primary shrink-0" size={20} />
        <div className="flex-1 min-w-0">
          <span className="text-label-sm uppercase tracking-widest text-on-surface-variant block">Current Location</span>
          <span className="font-headline text-headline-sm text-on-surface truncate block">
            {currentName || `${currentLat}, ${currentLon}`}
          </span>
          <span className="text-[0.625rem] text-outline font-mono">{currentLat}, {currentLon}</span>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex gap-3">
        <button
          onClick={useMyLocation}
          disabled={locating}
          className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <Icon name={locating ? 'sync' : 'my_location'} size={18} className={locating ? 'animate-spin' : ''} />
          {locating ? 'Locating...' : 'Use My Location'}
        </button>
      </div>

      {/* City search */}
      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); searchCity(e.target.value); }}
            onFocus={() => { if (results.length > 0) setShowResults(true); }}
            placeholder="Search city..."
            className="w-full rounded-lg bg-surface-container-lowest pl-10 pr-3 py-2.5 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-outline"
          />
          {searching && (
            <Icon name="sync" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant animate-spin" />
          )}
        </div>

        {/* Results dropdown */}
        {showResults && results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg bg-surface-container-high border border-outline-variant/20 shadow-lg overflow-hidden">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => selectLocation(r)}
                className="w-full text-left px-4 py-3 hover:bg-surface-container-highest transition-colors flex items-center gap-3"
              >
                <Icon name="location_on" size={16} className="text-on-surface-variant shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm text-on-surface font-medium block truncate">{r.name}</span>
                  <span className="text-[0.625rem] text-on-surface-variant">
                    {[r.admin1, r.country].filter(Boolean).join(', ')} — {r.latitude.toFixed(2)}, {r.longitude.toFixed(2)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {showResults && query.length >= 2 && results.length === 0 && !searching && (
          <div className="absolute z-10 mt-1 w-full rounded-lg bg-surface-container-high border border-outline-variant/20 p-4 text-sm text-on-surface-variant text-center">
            No cities found
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-error flex items-center gap-1.5">
          <Icon name="error" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}
