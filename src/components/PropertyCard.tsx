import React, { useState } from 'react';
import { Bookmark, Home, MapPin, Users } from 'lucide-react';
import type { AreaUnit, LanguageMode, PropertyListing } from '../types/rental';
import { formatArea, formatINR } from '../lib/geo';

interface PropertyCardProps {
  property: PropertyListing;
  distanceKm: number;
  areaUnit: AreaUnit;
  language: LanguageMode;
  isSaved: boolean;
  isSelected?: boolean;
  onToggleSave: (propertyId: string) => void;
  onSelect: (property: PropertyListing) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  distanceKm,
  areaUnit,
  language,
  isSaved,
  isSelected = false,
  onToggleSave,
  onSelect,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article
      className={`group bg-white rounded-xl border transition-all duration-200 overflow-hidden flex flex-col ${
        isSelected
          ? 'border-teal-700 ring-1 ring-teal-700/20'
          : 'border-slate-200 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      {/* Image container (4:3 uniform ratio) */}
      <div
        onClick={() => onSelect(property)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(property);
          }
        }}
        className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden cursor-pointer"
      >
        {!imgFailed && property.photoUrl ? (
          <img
            src={property.photoUrl}
            alt={property.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-4 text-slate-500">
            <Home className="w-8 h-8 mb-2 text-slate-400" />
            <span className="text-xs font-medium text-center line-clamp-1">
              {property.title}
            </span>
          </div>
        )}

        {/* Measured bottom scrim strictly for distance & status text */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent px-3.5 py-2.5 flex items-end justify-between">
          <span className="text-xs font-medium text-white tabular-nums">
            {distanceKm.toFixed(1)} km {language === 'hinglish' ? 'door' : 'away'}
          </span>
          <span className="text-xs font-medium text-white/95">
            {property.paintCondition}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(property.id);
          }}
          aria-label={isSaved ? 'Remove from shortlist' : 'Shortlist home'}
          className={`absolute top-3 right-3 w-9 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm ${
            isSaved
              ? 'bg-teal-800 text-white'
              : 'bg-white/95 text-slate-700 hover:bg-white hover:text-teal-800'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-1.5">
          {/* Clean unboxed metadata row */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{property.bhkType}</span>
            <span aria-hidden="true">·</span>
            <span>{property.floor}</span>
            <span aria-hidden="true">·</span>
            <span>{property.furnishing}</span>
          </div>

          <button
            type="button"
            onClick={() => onSelect(property)}
            className="text-left block w-full"
          >
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-teal-800 transition-colors line-clamp-1">
              {property.title}
            </h3>
          </button>

          <p className="text-xs text-slate-500 flex items-center gap-1 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {property.area}, {property.city}, {property.state}
            </span>
          </p>

          <div className="pt-1 text-xs text-slate-600 tabular-nums">
            <span className="font-medium text-slate-800">
              {formatArea(property.areaGaj, property.areaSqft, areaUnit)}
            </span>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {property.preferredTenant} ·{' '}
              {language === 'hinglish'
                ? `Max ${property.maxOccupants} log`
                : `Up to ${property.maxOccupants} members`}
            </span>
          </div>
        </div>

        {/* Footer price baseline */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-bold text-slate-900 tabular-nums leading-tight">
              {formatINR(property.monthlyRent)}
              <span className="text-xs font-normal text-slate-500">
                {language === 'hinglish' ? ' / mahina' : ' / mo'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {property.negotiable
                ? language === 'hinglish'
                  ? 'Rent negotiable'
                  : 'Negotiable rent'
                : language === 'hinglish'
                  ? 'Fixed rent'
                  : 'Fixed rent'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelect(property)}
            className="px-3.5 py-2 text-xs font-semibold text-teal-900 bg-slate-100 hover:bg-teal-800 hover:text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {language === 'hinglish' ? 'Ghar Dekhein' : 'View Home'}
          </button>
        </div>
      </div>
    </article>
  );
};
