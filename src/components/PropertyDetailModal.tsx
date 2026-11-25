import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  Home,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
  ThumbsDown,
  Users,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  TENANT_PREF_OPTIONS,
  type AreaUnit,
  type LanguageMode,
  type PropertyListing,
} from '../types/rental';
import { formatArea, formatINR } from '../lib/geo';
import { submitPropertyInquiry } from '../lib/firebase';
import { NeighborhoodGroundingPanel } from './NeighborhoodGroundingPanel';

interface PropertyDetailModalProps {
  property: PropertyListing;
  distanceKm: number;
  areaUnit: AreaUnit;
  language: LanguageMode;
  user: User | null;
  isSaved: boolean;
  onToggleSave: (propertyId: string) => void;
  onCloseWithoutInterest: () => void;
  onCloseClean: () => void;
  onRequestSignIn: () => Promise<User | null>;
  onInquirySent: (propertyId: string) => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  property,
  distanceKm,
  areaUnit,
  language,
  user,
  isSaved,
  onToggleSave,
  onCloseWithoutInterest,
  onCloseClean,
  onRequestSignIn,
  onInquirySent,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [tenantName, setTenantName] = useState(user?.displayName || '');
  const [familySize, setFamilySize] = useState(Math.min(3, property.maxOccupants));
  const [tenantType, setTenantType] = useState<string>(property.preferredTenant);
  const [message, setMessage] = useState(
    'Namaste, humein aapka ghar pasand aaya hai. Kya hum is week ghar dekhne aa sakte hain?'
  );
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (tenantName.trim().length < 2) {
      setErrorMsg(
        language === 'hinglish'
          ? 'Kripya apna naam likhein.'
          : 'Please enter your name.'
      );
      return;
    }
    if (message.trim().length < 4) {
      setErrorMsg(
        language === 'hinglish'
          ? 'Kripya owner ke liye chhota message likhein.'
          : 'Please write a short message for the owner.'
      );
      return;
    }

    if (property.isShowcase) {
      setSentSuccess(true);
      onInquirySent(property.id);
      return;
    }

    let activeUser = user;
    if (!activeUser) {
      activeUser = await onRequestSignIn();
      if (!activeUser) return;
    }

    setSubmitting(true);
    try {
      await submitPropertyInquiry(activeUser, property, {
        tenantName: tenantName.trim(),
        familySize,
        tenantType,
        message: message.trim(),
      });
      setSentSuccess(true);
      onInquirySent(property.id);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not send visit request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClose = () => {
    if (sentSuccess || isSaved || user?.uid === property.ownerId) {
      onCloseClean();
    } else {
      onCloseWithoutInterest();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={handleBackdropClose}
    >
      <div
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">
              {property.bhkType} · {property.floor} · {distanceKm.toFixed(1)} km from selected area
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {property.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSave(property.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                isSaved
                  ? 'bg-teal-800 text-white border-teal-800'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? 'Shortlisted' : 'Shortlist'}</span>
            </button>
            <button
              type="button"
              onClick={handleBackdropClose}
              aria-label="Close home details"
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-6">
          {/* Left column: Photo + Specifications + Owner Preferences */}
          <div className="lg:col-span-7 space-y-6">
            <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              {!imgFailed && property.photoUrl ? (
                <img
                  src={property.photoUrl}
                  alt={property.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <Home className="w-10 h-10 mb-2" />
                  <span className="text-sm">{property.title}</span>
                </div>
              )}
            </div>

            {/* Key Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 border-y border-slate-200">
              <div>
                <div className="text-xs text-slate-500">
                  {language === 'hinglish' ? 'Area (Gaj / Sq.Ft)' : 'Carpet / Plot Area'}
                </div>
                <div className="text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                  {formatArea(property.areaGaj, property.areaSqft, areaUnit)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  {language === 'hinglish' ? 'Rooms & Floor' : 'Rooms & Floor'}
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {property.rooms} {property.rooms === 1 ? 'Room' : 'Rooms'} · {property.floor}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  {language === 'hinglish' ? 'Furnishing' : 'Furnishing'}
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {property.furnishing}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  {language === 'hinglish' ? 'Paint & Condition' : 'Paint & Condition'}
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {property.paintCondition}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  {language === 'hinglish' ? 'Security Deposit' : 'Security Deposit'}
                </div>
                <div className="text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                  {formatINR(property.securityDeposit)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  {language === 'hinglish' ? 'Max Log (Members)' : 'Max Occupants'}
                </div>
                <div className="text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                  Up to {property.maxOccupants} {language === 'hinglish' ? 'log' : 'people'}
                </div>
              </div>
            </div>

            {/* Proper Address Section */}
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">
                {language === 'hinglish' ? 'Proper Address aur Area' : 'Property Location & Address'}
              </h3>
              <p className="text-sm text-slate-700 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-teal-800 shrink-0 mt-0.5" />
                <span>
                  {property.addressLine}, {property.area}, {property.city}, {property.state}
                </span>
              </p>
            </div>

            {/* Description */}
            {property.description && (
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-slate-900">
                  {language === 'hinglish' ? 'Ghar ki Jaankari' : 'About this Home'}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {property.description}
                </p>
              </div>
            )}

            {/* Owner Tenant Preferences */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-800" />
                  <span>
                    {language === 'hinglish'
                      ? 'Owner ki Family Preference aur Niyam'
                      : 'Owner Tenant Preferences & House Rules'}
                  </span>
                </h3>
                <span className="text-xs font-medium text-slate-600">
                  {property.preferredTenant}
                </span>
              </div>

              {property.ownerPreferenceNote && (
                <p className="text-sm text-slate-700 leading-relaxed">
                  “{property.ownerPreferenceNote}”
                </p>
              )}

              {property.houseRules.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {property.houseRules.map((rule) => (
                    <li
                      key={rule}
                      className="text-xs text-slate-700 flex items-start gap-2"
                    >
                      <Check className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Live Google Maps Grounding: Neighborhood Insights */}
            <NeighborhoodGroundingPanel property={property} language={language} />
          </div>

          {/* Right column: Contiguous Rent & Inquiry + Exit Feedback trigger */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24 space-y-4">
              {/* Price & Owner Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">
                      {formatINR(property.monthlyRent)}
                      <span className="text-sm font-normal text-slate-500"> / month</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {property.negotiable ? 'Negotiable' : 'Fixed rent'} · Deposit{' '}
                      {formatINR(property.securityDeposit)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-xs text-slate-500">House Owner</div>
                    <div className="font-semibold text-slate-900">{property.ownerName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Visiting Hours</div>
                    <div className="text-xs font-medium text-slate-700">
                      {property.visitingHours || '10:00 AM – 7:00 PM'}
                    </div>
                  </div>
                </div>

                {/* Inquiry Form */}
                {sentSuccess ? (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-2">
                    <div className="text-sm font-semibold text-teal-900 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>
                        {language === 'hinglish'
                          ? 'Visit Request Owner ko Bhej Di Gayi!'
                          : 'Visit Request Sent to Owner!'}
                      </span>
                    </div>
                    <p className="text-xs text-teal-800 leading-relaxed">
                      {property.ownerName} will review your family details and confirm visiting time soon.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleInquirySubmit} className="space-y-3 pt-1">
                    <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-teal-800" />
                      <span>
                        {language === 'hinglish'
                          ? 'Owner se Direct Contact / Visit Book Karein'
                          : 'Request Direct Visit with Owner'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          {language === 'hinglish' ? 'Aapka Naam' : 'Your Name'}
                        </label>
                        <input
                          type="text"
                          value={tenantName}
                          onChange={(e) => setTenantName(e.target.value)}
                          placeholder="e.g. Amit Verma"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          {language === 'hinglish' ? 'Kitne Log Rahenge' : 'Family Members'}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={1}
                            max={15}
                            value={familySize}
                            onChange={(e) => setFamilySize(Number(e.target.value) || 1)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
                          />
                          <Users className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        {language === 'hinglish' ? 'Aap Kaise Tenant Hain' : 'Tenant Category'}
                      </label>
                      <select
                        value={tenantType}
                        onChange={(e) => setTenantType(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-teal-700"
                      >
                        {TENANT_PREF_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        {language === 'hinglish' ? 'Message for Owner' : 'Message for Owner'}
                      </label>
                      <textarea
                        rows={2}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 resize-none"
                      />
                    </div>

                    {errorMsg && (
                      <p className="text-xs text-rose-700 font-medium">{errorMsg}</p>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-60 rounded-lg transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {submitting
                          ? 'Sending...'
                          : language === 'hinglish'
                            ? 'Owner ko Visit Request Bhejein'
                            : 'Send Visit Request'}
                      </span>
                    </button>
                  </form>
                )}
              </div>

              {/* Explicit "Not Interested / Look at Another Home" Trigger */}
              {user?.uid !== property.ownerId && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      {language === 'hinglish'
                        ? 'Ye ghar pasand nahi aaya?'
                        : 'Not the right match?'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {language === 'hinglish'
                        ? 'Owner ko kami batayein aur dusra ghar dekhein'
                        : 'Tell the owner what was missing and browse next'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseWithoutInterest}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>{language === 'hinglish' ? 'Skip & Feedback' : 'Skip Home'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
