import React, { useState } from 'react';
import {
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import type {
  LanguageMode,
  NeighborhoodInsightsResult,
  PropertyListing,
} from '../types/rental';

type InsightFocus = 'essentials' | 'commute' | 'family';

interface NeighborhoodGroundingPanelProps {
  property: PropertyListing;
  language: LanguageMode;
  compact?: boolean;
}

const FOCUS_TABS: { id: InsightFocus; en: string; hi: string }[] = [
  { id: 'essentials', en: 'Daily Essentials', hi: 'Hospital & Market' },
  { id: 'commute', en: 'Metro & Commute', hi: 'Metro & Commute' },
  { id: 'family', en: 'Schools & Parks', hi: 'Schools & Parks' },
];

export const NeighborhoodGroundingPanel: React.FC<
  NeighborhoodGroundingPanelProps
> = ({ property, language, compact = false }) => {
  const [focus, setFocus] = useState<InsightFocus>('essentials');
  const [cache, setCache] = useState<Record<string, NeighborhoodInsightsResult>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cacheKey = `${property.id}_${focus}_${language}`;
  const currentData = cache[cacheKey] || null;

  const fetchInsights = async (targetFocus: InsightFocus) => {
    const key = `${property.id}_${targetFocus}_${language}`;
    setFocus(targetFocus);
    setErrorMsg(null);

    if (cache[key]) return;

    setLoading(true);
    try {
      const res = await fetch('/api/neighborhood-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: property.lat,
          lng: property.lng,
          area: property.area,
          city: property.city,
          state: property.state,
          focus: targetFocus,
          language,
        }),
      });
      const data = (await res.json()) as Partial<NeighborhoodInsightsResult> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          data.error || `Failed to load Google Maps neighborhood data (${res.status}).`
        );
      }
      setCache((prev) => ({
        ...prev,
        [key]: {
          summary: data.summary || '',
          places: Array.isArray(data.places) ? data.places : [],
        },
      }));
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not load live Google Maps neighborhood info.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl ${
        compact ? 'p-4' : 'p-4 sm:p-5'
      } space-y-3.5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-teal-800 shrink-0" />
            <span>
              {language === 'hinglish'
                ? 'Aas-Paas ki Live Jaankari (Google Maps)'
                : 'Live Neighborhood Guide (Google Maps)'}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {property.area}, {property.city}
          </p>
        </div>

        {!currentData && !loading && (
          <button
            type="button"
            onClick={() => void fetchInsights(focus)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {language === 'hinglish' ? 'Nearby Places Dekhein' : 'Load Nearby Places'}
          </button>
        )}
      </div>

      {/* Category Switcher */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {FOCUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => void fetchInsights(tab.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              focus === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hinglish' ? tab.hi : tab.en}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-teal-800" />
          <span>
            {language === 'hinglish'
              ? 'Google Maps se live nearby places check ho rahe hain...'
              : 'Checking live nearby places with Google Maps...'}
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => void fetchInsights(focus)}
            className="inline-flex items-center gap-1 font-semibold underline shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {currentData && !loading && (
        <div className="space-y-3.5">
          {currentData.summary && (
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {currentData.summary}
            </div>
          )}

          {currentData.places.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-semibold text-slate-500">
                Google Maps Places &amp; Links
              </div>
              <ul className="space-y-2">
                {currentData.places.map((place) => (
                  <li
                    key={place.uri}
                    className="text-xs bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 space-y-1"
                  >
                    <a
                      href={place.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-teal-900 hover:text-teal-700 hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-teal-700" />
                      <span>{place.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                    {place.reviewSnippets.length > 0 && (
                      <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                        “{place.reviewSnippets[0]}”
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
