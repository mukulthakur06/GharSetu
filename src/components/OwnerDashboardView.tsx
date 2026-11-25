import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  Edit3,
  Home,
  LogIn,
  MessageSquareHeart,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AreaUnit,
  LanguageMode,
  PropertyFeedback,
  PropertyInquiry,
  PropertyListing,
} from '../types/rental';
import { formatArea, formatINR } from '../lib/geo';
import {
  deletePropertyListing,
  resolvePropertyFeedback,
  updateInquiryStatus,
  updatePropertyListing,
} from '../lib/firebase';

interface OwnerDashboardViewProps {
  user: User | null;
  language: LanguageMode;
  areaUnit: AreaUnit;
  ownedProperties: PropertyListing[];
  allProperties: PropertyListing[];
  ownerFeedback: PropertyFeedback[];
  sessionShowcaseFeedback: PropertyFeedback[];
  ownerInquiries: PropertyInquiry[];
  onRequestSignIn: () => Promise<User | null>;
  onCreateNew: () => void;
  onEditProperty: (property: PropertyListing) => void;
}

export const OwnerDashboardView: React.FC<OwnerDashboardViewProps> = ({
  user,
  language,
  areaUnit,
  ownedProperties,
  allProperties,
  ownerFeedback,
  sessionShowcaseFeedback,
  ownerInquiries,
  onRequestSignIn,
  onCreateNew,
  onEditProperty,
}) => {
  const [activeTab, setActiveTab] = useState<'feedback' | 'listings' | 'inquiries'>('feedback');
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showingLiveFeedback = ownerFeedback.length > 0;
  const displayedFeedback = showingLiveFeedback ? ownerFeedback : sessionShowcaseFeedback;

  const propertyLookup = useMemo(() => {
    const map: Record<string, PropertyListing> = {};
    for (const p of allProperties) {
      map[p.id] = p;
    }
    return map;
  }, [allProperties]);

  // Aggregate feedback reasons
  const reasonStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let rentSum = 0;
    let rentCount = 0;
    for (const fb of displayedFeedback) {
      for (const reason of fb.reasons) {
        counts[reason] = (counts[reason] || 0) + 1;
      }
      if (fb.suggestedRent > 0) {
        rentSum += fb.suggestedRent;
        rentCount += 1;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      sorted,
      maxCount: sorted[0]?.[1] || 1,
      avgSuggestedRent: rentCount > 0 ? Math.round(rentSum / rentCount) : 0,
    };
  }, [displayedFeedback]);

  const handleResolveFeedback = async (fb: PropertyFeedback) => {
    if (!showingLiveFeedback) {
      setStatusMessage(
        'Publish a listing and receive live tenant feedback to mark items resolved in the database.'
      );
      return;
    }
    setBusyId(fb.id);
    setStatusMessage(null);
    try {
      const note =
        actionNotes[fb.id]?.trim() ||
        'Reviewed tenant suggestion and improved the property.';
      await resolvePropertyFeedback(fb.propertyId, fb.id, 'resolved', note);
      setStatusMessage('Feedback marked as resolved.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStatus = async (prop: PropertyListing) => {
    setBusyId(prop.id);
    try {
      await updatePropertyListing(prop.id, {
        status: prop.status === 'available' ? 'rented' : 'available',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteProperty = async (prop: PropertyListing) => {
    setBusyId(prop.id);
    try {
      await deletePropertyListing(prop.id);
      setStatusMessage(`Removed "${prop.title}".`);
    } finally {
      setBusyId(null);
    }
  };

  const handleInquiryAction = async (
    inq: PropertyInquiry,
    status: 'accepted' | 'declined'
  ) => {
    setBusyId(inq.id);
    try {
      await updateInquiryStatus(inq.propertyId, inq.id, status);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-teal-800">
            {language === 'hinglish'
              ? 'House Owner Insights & Listing Manager'
              : 'House Owner Insights & Listing Manager'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 text-balance">
            {language === 'hinglish'
              ? 'Owner Hub & Ghar Improvement Feedback'
              : 'Owner Hub & Tenant Feedback Insights'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            {language === 'hinglish'
              ? 'Dekhein ki tenants ne aapka ghar kyun skip kiya — rent, area/Gaj, furnishing ya paint ki kami samajh kar turant sudhar karein.'
              : 'See why prospective tenants moved on from a home — review rent, Gaj area, furnishing, or paint feedback and improve your listing.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!user && (
            <button
              type="button"
              onClick={() => void onRequestSignIn()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>
              {language === 'hinglish' ? 'Naya Ghar List Karein' : 'Post New Property'}
            </span>
          </button>
        </div>
      </div>

      {/* 4-column KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Your Listed Homes</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {ownedProperties.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Improvement Feedback</div>
          <div className="text-2xl font-bold text-teal-800 tabular-nums mt-1">
            {displayedFeedback.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Visit Inquiries</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {ownerInquiries.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Avg. Suggested Rent</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {reasonStats.avgSuggestedRent > 0
              ? formatINR(reasonStats.avgSuggestedRent)
              : '—'}
          </div>
        </div>
      </div>

      {/* Segmented Workspace Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('feedback')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'feedback'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hinglish'
              ? `Tenant Feedback (${displayedFeedback.length})`
              : `Improvement Feedback (${displayedFeedback.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('listings')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'listings'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hinglish'
              ? `Mere Ghar (${ownedProperties.length})`
              : `My Listings (${ownedProperties.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inquiries')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'inquiries'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'hinglish'
              ? `Visit Requests (${ownerInquiries.length})`
              : `Visit Inquiries (${ownerInquiries.length})`}
          </button>
        </div>

        {statusMessage && (
          <div className="text-xs font-medium text-teal-800">{statusMessage}</div>
        )}
      </div>

      {/* TAB 1: TENANT IMPROVEMENT FEEDBACK */}
      {activeTab === 'feedback' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Top Missing Factors Bar Chart */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquareHeart className="w-4 h-4 text-teal-800" />
                <span>
                  {language === 'hinglish'
                    ? 'Ghar mein Sabse Jyada Batayi Gayi Kamiyan'
                    : 'Top Reasons Tenants Moved On'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {showingLiveFeedback
                  ? 'Live aggregated exit feedback from tenants who viewed your homes.'
                  : 'Preview of how exit feedback appears here. Try skipping any home in Find Homes to see your feedback appear instantly!'}
              </p>
            </div>

            {reasonStats.sorted.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No tenant feedback recorded yet.
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {reasonStats.sorted.map(([reason, count]) => {
                  const pct = Math.round((count / reasonStats.maxCount) * 100);
                  return (
                    <div key={reason} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800">{reason}</span>
                        <span className="font-semibold text-slate-600 tabular-nums">
                          {count} {count === 1 ? 'report' : 'reports'}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-700 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Individual Actionable Feedback Stream */}
          <div className="lg:col-span-7 space-y-4">
            {displayedFeedback.map((fb) => {
              const relatedProp = propertyLookup[fb.propertyId];
              const isResolved = fb.status === 'resolved';
              return (
                <div
                  key={fb.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500">
                        {relatedProp
                          ? `${relatedProp.title} · ${formatINR(relatedProp.monthlyRent)}/mo`
                          : `Property ${fb.propertyId}`}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 mt-1">
                        {fb.reasons.join(' · ')}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isResolved ? 'text-teal-800' : 'text-amber-700'
                      }`}
                    >
                      {isResolved ? 'Improved & Resolved' : 'Needs Owner Review'}
                    </span>
                  </div>

                  {fb.comment && (
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3.5 py-2.5 leading-relaxed">
                      “{fb.comment}”
                    </p>
                  )}

                  {fb.suggestedRent > 0 && (
                    <div className="text-xs text-slate-600 tabular-nums">
                      Tenant suggested fair rent:{' '}
                      <span className="font-semibold text-slate-900">
                        {formatINR(fb.suggestedRent)} / month
                      </span>
                    </div>
                  )}

                  {isResolved && fb.ownerActionNote && (
                    <div className="text-xs text-teal-800 flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Owner improvement: {fb.ownerActionNote}</span>
                    </div>
                  )}

                  {!isResolved && (
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={actionNotes[fb.id] || ''}
                        onChange={(e) =>
                          setActionNotes((prev) => ({
                            ...prev,
                            [fb.id]: e.target.value,
                          }))
                        }
                        placeholder="Note improvement (e.g. Reduced rent by ₹1,500 / Freshly painted)"
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        {relatedProp && user?.uid === relatedProp.ownerId && (
                          <button
                            type="button"
                            onClick={() => onEditProperty(relatedProp)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Home</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === fb.id}
                          onClick={() => void handleResolveFeedback(fb)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Improved</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MY LISTINGS */}
      {activeTab === 'listings' && (
        <div>
          {!user ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <Home className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-base font-semibold text-slate-900">
                Sign in to manage your published homes
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Publish rental homes with Gaj/Sq.Ft measurements, family preferences, and receive direct tenant improvement feedback.
              </p>
              <button
                type="button"
                onClick={() => void onRequestSignIn()}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors"
              >
                Sign In with Google
              </button>
            </div>
          ) : ownedProperties.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <Home className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-base font-semibold text-slate-900">
                You haven&apos;t listed a home yet
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Upload your house photos, rooms, Gaj area, monthly rent, and preferred family rules in under 2 minutes.
              </p>
              <button
                type="button"
                onClick={onCreateNew}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors"
              >
                Post Your First Home
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {ownedProperties.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <img
                      src={prop.photoUrl}
                      alt={prop.title}
                      referrerPolicy="no-referrer"
                      className="w-24 h-20 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs text-slate-500">
                        {prop.bhkType} · {prop.floor} · {prop.paintCondition} ·{' '}
                        <span
                          className={
                            prop.status === 'available'
                              ? 'text-teal-800 font-medium'
                              : 'text-slate-600 font-medium'
                          }
                        >
                          {prop.status === 'available' ? 'Available' : 'Rented'}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 truncate">
                        {prop.title}
                      </h3>
                      <div className="text-xs text-slate-600 tabular-nums">
                        {formatINR(prop.monthlyRent)}/mo ·{' '}
                        {formatArea(prop.areaGaj, prop.areaSqft, areaUnit)} ·{' '}
                        {prop.area}, {prop.city}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditProperty(prop)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit / Improve</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyId === prop.id}
                      onClick={() => void handleToggleStatus(prop)}
                      className="px-3 py-2 text-xs font-semibold text-teal-900 border border-teal-700/30 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                    >
                      {prop.status === 'available' ? 'Mark Rented' : 'Mark Available'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === prop.id}
                      onClick={() => void handleDeleteProperty(prop)}
                      aria-label="Delete listing"
                      className="p-2 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VISIT INQUIRIES */}
      {activeTab === 'inquiries' && (
        <div className="space-y-4">
          {ownerInquiries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-base font-semibold text-slate-900">
                No visit inquiries yet
              </h3>
              <p className="text-sm text-slate-500">
                When prospective tenants request to visit your listed homes, their family details and messages appear here.
              </p>
            </div>
          ) : (
            ownerInquiries.map((inq) => {
              const relatedProp = propertyLookup[inq.propertyId];
              return (
                <div
                  key={inq.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500">
                      {relatedProp?.title || inq.propertyId} · {inq.tenantType} ·{' '}
                      {inq.familySize} {inq.familySize === 1 ? 'member' : 'members'}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {inq.tenantName}
                    </div>
                    <p className="text-sm text-slate-700">“{inq.message}”</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {inq.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === inq.id}
                          onClick={() => void handleInquiryAction(inq, 'accepted')}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors"
                        >
                          Accept Visit
                        </button>
                        <button
                          type="button"
                          disabled={busyId === inq.id}
                          onClick={() => void handleInquiryAction(inq, 'declined')}
                          className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-xs font-semibold ${
                          inq.status === 'accepted' ? 'text-teal-800' : 'text-slate-500'
                        }`}
                      >
                        {inq.status === 'accepted' ? 'Visit Accepted' : 'Declined'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
