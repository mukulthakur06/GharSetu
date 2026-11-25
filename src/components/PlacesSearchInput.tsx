import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import { PRESET_LOCATIONS, type SearchCenter } from '../types/rental';

interface PlacesSearchInputProps {
  value: SearchCenter;
  onSelectCenter: (center: SearchCenter) => void;
  placeholder?: string;
  showLocateMe?: boolean;
  compact?: boolean;
}

export const PlacesSearchInput: React.FC<PlacesSearchInputProps> = ({
  value,
  onSelectCenter,
  placeholder = 'Search city, sector, or area (e.g. Noida Sector 62, Jaipur)...',
  showLocateMe = true,
  compact = false,
}) => {
  const placesLib = useMapsLibrary('places');
  const [inputText, setInputText] = useState(value.label);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputText(value.label);
  }, [value.label]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    const trimmed = inputText.trim();
    if (!placesLib || !isOpen || trimmed.length < 2 || trimmed === value.label) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }
      setIsLoading(true);
      try {
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['in'],
        });
        setSuggestions(res?.suggestions || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [placesLib, inputText, isOpen, value.label]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
        const loc = place.location;
        if (loc) {
          const label =
            place.displayName ||
            place.formattedAddress ||
            suggestion.placePrediction.text.text;
          onSelectCenter({
            label,
            lat: loc.lat(),
            lng: loc.lng(),
          });
          setInputText(label);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      } finally {
        sessionTokenRef.current = null;
        setSuggestions([]);
        setIsOpen(false);
      }
    },
    [onSelectCenter]
  );

  const handleLocateMe = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Browser geolocation unavailable.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const center: SearchCenter = {
          label: 'My Current Location',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        onSelectCenter(center);
        setInputText(center.label);
        setIsOpen(false);
      },
      () => {
        setLocating(false);
        setGeoError('Location permission denied. Choose a city below.');
      },
      { enableHighAccuracy: false, timeout: 7000 }
    );
  };

  const filteredPresets = PRESET_LOCATIONS.filter((p) => {
    const q = inputText.trim().toLowerCase();
    if (!q || q === value.label.toLowerCase()) return true;
    return p.label.toLowerCase().includes(q);
  });

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`flex items-center gap-2 bg-white border border-slate-300 rounded-lg focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/15 transition-all ${
          compact ? 'px-3 py-2' : 'px-3.5 py-2.5'
        }`}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={inputText}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setInputText(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          aria-label="Search location"
          className="w-full text-sm text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
        />
        {inputText && (
          <button
            type="button"
            onClick={() => {
              setInputText('');
              setIsOpen(true);
            }}
            aria-label="Clear location"
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {showLocateMe && (
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            title="Use current GPS location"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>{locating ? 'Locating...' : 'Near Me'}</span>
          </button>
        )}
      </div>

      {geoError && (
        <p className="mt-1 text-xs text-amber-700">{geoError}</p>
      )}

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden max-h-72 overflow-y-auto">
          {isLoading && (
            <div className="px-3.5 py-2.5 text-xs text-slate-500">
              Searching locations...
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="border-b border-slate-100">
              <div className="px-3.5 pt-2.5 pb-1 text-[11px] font-medium text-slate-400">
                Google Maps Suggestions
              </div>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion.placePrediction?.placeId || idx}`}
                  type="button"
                  onClick={() => void handleSelectSuggestion(suggestion)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-teal-700 shrink-0" />
                  <span className="truncate">
                    {suggestion.placePrediction?.text.text}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="px-3.5 pt-2.5 pb-1 text-[11px] font-medium text-slate-400">
              Popular Residential Areas
            </div>
            {filteredPresets.map((loc) => (
              <button
                key={loc.label}
                type="button"
                onClick={() => {
                  onSelectCenter(loc);
                  setInputText(loc.label);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{loc.label}</span>
                </span>
                {loc.label === value.label && (
                  <span className="text-xs font-medium text-teal-700 shrink-0">
                    Selected
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
