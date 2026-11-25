import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  Compass,
  Home,
  LogIn,
  MapPin,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import type {
  AreaUnit,
  LanguageMode,
  PropertyListing,
  SavedListingRecord,
  UserProfileData,
} from '../types/rental';
import { formatArea, formatINR } from '../lib/geo';
import { updateUserProfile } from '../lib/firebase';
import { NeighborhoodGroundingPanel } from './NeighborhoodGroundingPanel';

export interface SavedListingWithLiveStatus {
  record: SavedListingRecord;
  property: PropertyListing | null;
  currentRent: number;
  /** Delta since user last acknowledged the alert (currentRent - lastSeenRent) */
  unreadDelta: number;
  /** Total delta since originally bookmarked (currentRent - savedRent) */
  totalDelta: number;
  hasUnreadPriceChange: boolean;
}

interface ProfileViewProps {
  user: User | null;
  userProfile: UserProfileData | null;
  language: LanguageMode;
  areaUnit: AreaUnit;
  savedItems: SavedListingWithLiveStatus[];
  onChangeAreaUnit: (unit: AreaUnit) => void;
  onRequestSignIn: () => Promise<User | null>;
  onSelectProperty: (property: PropertyListing) => void;
  onRemoveSaved: (propertyId: string) => void;
  onAcknowledgeAlert: (item: SavedListingWithLiveStatus) => Promise<void>;
  onAcknowledgeAllAlerts: () => Promise<void>;
  onGoExplore: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  userProfile,
  language,
  areaUnit,
  savedItems,
  onChangeAreaUnit,
  onRequestSignIn,
  onSelectProperty,
  onRemoveSaved,
  onAcknowledgeAlert,
  onAcknowledgeAllAlerts,
  onGoExplore,
}) => {
  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || user?.displayName || ''
  );
  const [city, setCity] = useState(userProfile?.city || 'Noida');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [expandedMapsId, setExpandedMapsId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.displayName) {
      setDisplayName(userProfile.displayName);
    } else if (user?.displayName) {
      setDisplayName(user.displayName);
    }
    if (userProfile?.city) {
      setCity(userProfile.city);
    }
  }, [userProfile?.displayName, userProfile?.city, user?.displayName]);

  const unreadAlerts = useMemo(
    () => savedItems.filter((item) => item.hasUnreadPriceChange),
    [savedItems]
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      await updateUserProfile(user, {
        displayName: displayName.trim() || user.displayName || 'GharSetu Member',
        preferredUnit: areaUnit,
        city: city.trim() || 'Noida',
      });
      setProfileNotice(
        language === 'hinglish'
          ? 'Profile preferences save ho gayi hain.'
          : 'Profile preferences saved.'
      );
    } catch (err) {
      setProfileNotice(
        err instanceof Error ? err.message : 'Unable to save profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-teal-800">
            {language === 'hinglish'
              ? 'User Profile & Rent Price Tracker'
              : 'User Profile & Rent Price Watchlist'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 text-balance">
            {language === 'hinglish'
              ? 'Saved Listings aur Rent Alerts'
              : 'Saved Listings & Rent Price Alerts'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {language === 'hinglish'
              ? 'Jo ghar aapne bookmark kiye hain unka rent live monitor hota hai — agar owner rent kam ya jada karega toh turant notification milega.'
              : 'Every home you bookmark is monitored in real time — whenever an owner lowers or raises the monthly rent, you get an immediate alert here.'}
          </p>
        </div>

        {!user && (
          <button
            type="button"
            onClick={() => void onRequestSignIn()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In to Sync Across Devices</span>
          </button>
        )}
      </div>

      {/* Rent Price Change Notifications Strip */}
      {unreadAlerts.length > 0 && (
        <section
          aria-label="Rent price change notifications"
          className="bg-white border border-teal-700/35 rounded-2xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-teal-800 shrink-0" />
              <h2 className="text-base font-bold text-slate-900">
                {language === 'hinglish'
                  ? `Rent Badalne ki Suchna (${unreadAlerts.length})`
                  : `Rent Price Change Notifications (${unreadAlerts.length})`}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => void onAcknowledgeAllAlerts()}
              className="px-3 py-1.5 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap"
            >
              {language === 'hinglish' ? 'Sabhi Alerts Seen Mark Karein' : 'Mark All Seen'}
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {unreadAlerts.map((item) => {
              const dropped = item.unreadDelta < 0;
              const absDiff = Math.abs(item.unreadDelta);
              const pct = Math.round(
                (absDiff / Math.max(1, item.record.lastSeenRent)) * 100
              );

              return (
                <div
                  key={item.record.propertyId}
                  className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      {dropped ? (
                        <span className="inline-flex items-center gap-1 text-teal-800">
                          <ArrowDownRight className="w-4 h-4" />
                          <span>
                            {language === 'hinglish'
                              ? `Rent ${formatINR(absDiff)} kam hua (-${pct}%)`
                              : `Rent dropped by ${formatINR(absDiff)}/mo (-${pct}%)`}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-800">
                          <ArrowUpRight className="w-4 h-4" />
                          <span>
                            {language === 'hinglish'
                              ? `Rent ${formatINR(absDiff)} badh gaya (+${pct}%)`
                              : `Rent increased by ${formatINR(absDiff)}/mo (+${pct}%)`}
                          </span>
                        </span>
                      )}
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-slate-500 font-normal tabular-nums">
                        Was {formatINR(item.record.lastSeenRent)} → Now{' '}
                        <strong className="text-slate-900">
                          {formatINR(item.currentRent)}/mo
                        </strong>
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-slate-900">
                      {item.property?.title || item.record.propertyTitle}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.property
                        ? `${item.property.area}, ${item.property.city}`
                        : item.record.propertyArea}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.property && (
                      <button
                        type="button"
                        onClick={() => onSelectProperty(item.property!)}
                        className="px-3 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors whitespace-nowrap"
                      >
                        View Home
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === item.record.propertyId}
                      onClick={async () => {
                        setBusyId(item.record.propertyId);
                        try {
                          await onAcknowledgeAlert(item);
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Got It</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Split: Profile Preferences + Saved Listings Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: User Profile Card */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">
                {user?.displayName || 'Guest Renter'}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {user?.email || 'Sign in to sync saved homes & rent alerts'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <div className="text-xs text-slate-500">Saved Homes</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                {savedItems.length}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <div className="text-xs text-slate-500">Price Alerts</div>
              <div className="text-xl font-bold text-teal-800 tabular-nums mt-0.5">
                {unreadAlerts.length}
              </div>
            </div>
          </div>

          {user ? (
            <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred City
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Noida, Jaipur, Gurugram"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Preferred Area Unit
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => onChangeAreaUnit('gaj')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      areaUnit === 'gaj'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Gaj (गज)
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAreaUnit('sqft')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      areaUnit === 'sqft'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sq. Ft.
                  </button>
                </div>
              </div>

              {profileNotice && (
                <p className="text-xs font-medium text-teal-800">{profileNotice}</p>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors"
              >
                {savingProfile ? 'Saving...' : 'Save Preferences'}
              </button>
            </form>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs text-slate-600">
              <p className="leading-relaxed">
                {language === 'hinglish'
                  ? 'Abhi aapke bookmarked ghar is browser mein save ho rahe hain. Google se sign in karke cloud mein save karein aur real-time Firestore rent-change alerts paayein.'
                  : 'Your bookmarks are currently saved in this browser. Sign in with Google to persist them in Firestore and receive real-time rent change alerts.'}
              </p>
              <button
                type="button"
                onClick={() => void onRequestSignIn()}
                className="w-full px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors"
              >
                Sign In with Google
              </button>
            </div>
          )}
        </aside>

        {/* Right: Saved Listings Watchlist */}
        <section className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-teal-800" />
              <span>
                {language === 'hinglish'
                  ? `Saved Listings (${savedItems.length})`
                  : `Saved Listings (${savedItems.length})`}
              </span>
            </h2>
            <span className="text-xs text-slate-500">
              Live rent tracking enabled
            </span>
          </div>

          {savedItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <Home className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-base font-semibold text-slate-900">
                {language === 'hinglish'
                  ? 'Abhi tak koi ghar bookmark nahi kiya hai'
                  : 'No saved listings yet'}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {language === 'hinglish'
                  ? 'Find Homes mein kisi bhi ghar par bookmark icon dabayein. Jaise hi owner rent badlega, aapko yahan turant notification milega.'
                  : 'Tap the bookmark button on any rental home to track its monthly rent here and get notified immediately whenever the price changes.'}
              </p>
              <button
                type="button"
                onClick={onGoExplore}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors"
              >
                Browse Rental Homes
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {savedItems.map((item) => {
                const { record, property, currentRent, totalDelta, hasUnreadPriceChange } = item;
                const showMaps = expandedMapsId === record.propertyId;

                return (
                  <article
                    key={record.propertyId}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 space-y-4 transition-colors ${
                      hasUnreadPriceChange
                        ? 'border-teal-700/50'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
                      <div className="flex items-start gap-4 min-w-0">
                        {property?.photoUrl ? (
                          <img
                            src={property.photoUrl}
                            alt={property.title}
                            referrerPolicy="no-referrer"
                            className="w-28 h-22 rounded-xl object-cover bg-slate-100 shrink-0 cursor-pointer"
                            onClick={() => onSelectProperty(property)}
                          />
                        ) : (
                          <div className="w-28 h-22 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Home className="w-6 h-6" />
                          </div>
                        )}

                        <div className="min-w-0 space-y-1">
                          {property && (
                            <div className="text-xs text-slate-500">
                              {property.bhkType} · {property.floor} ·{' '}
                              {formatArea(property.areaGaj, property.areaSqft, areaUnit)}
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={!property}
                            onClick={() => property && onSelectProperty(property)}
                            className="text-left block"
                          >
                            <h3 className="text-base font-semibold text-slate-900 hover:text-teal-800 transition-colors">
                              {property?.title || record.propertyTitle}
                            </h3>
                          </button>

                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {property
                                ? `${property.area}, ${property.city}, ${property.state}`
                                : record.propertyArea}
                            </span>
                          </div>

                          {/* Rent Watch Comparison Row */}
                          <div className="pt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                            <span className="text-sm font-bold text-slate-900">
                              {formatINR(currentRent)}/mo
                            </span>
                            <span className="text-slate-500">
                              Bookmarked at {formatINR(record.savedRent)}/mo
                            </span>

                            {totalDelta < 0 && (
                              <span className="inline-flex items-center gap-0.5 font-semibold text-teal-800">
                                <ArrowDownRight className="w-3.5 h-3.5" />
                                <span>
                                  Down {formatINR(Math.abs(totalDelta))}
                                </span>
                              </span>
                            )}
                            {totalDelta > 0 && (
                              <span className="inline-flex items-center gap-0.5 font-semibold text-amber-800">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                <span>Up {formatINR(totalDelta)}</span>
                              </span>
                            )}
                            {totalDelta === 0 && (
                              <span className="text-slate-500">· Price unchanged</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                        {property && (
                          <button
                            type="button"
                            onClick={() => onSelectProperty(property)}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors whitespace-nowrap"
                          >
                            View Home
                          </button>
                        )}
                        <div className="flex items-center gap-2">
                          {property && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedMapsId(showMaps ? null : record.propertyId)
                              }
                              className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                                showMaps
                                  ? 'bg-teal-50 border-teal-700 text-teal-900'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <Compass className="w-3.5 h-3.5" />
                              <span>Nearby Maps</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveSaved(record.propertyId)}
                            aria-label="Remove saved listing"
                            className="p-2 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {showMaps && property && (
                      <div className="pt-2 border-t border-slate-100">
                        <NeighborhoodGroundingPanel
                          property={property}
                          language={language}
                          compact
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
