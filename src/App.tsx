import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Grid2X2,
  LogOut,
  Map as MapIcon,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  BHK_OPTIONS,
  FLOOR_OPTIONS,
  FURNISHING_OPTIONS,
  PRESET_LOCATIONS,
  TENANT_PREF_OPTIONS,
  type AreaUnit,
  type BhkType,
  type FloorType,
  type FurnishingType,
  type LanguageMode,
  type PreferredTenantType,
  type PropertyFeedback,
  type PropertyInquiry,
  type PropertyListing,
  type SavedListingRecord,
  type SearchCenter,
  type SearchFilters,
  type UserProfileData,
} from './types/rental';
import {
  INITIAL_SHOWCASE_FEEDBACK,
  STARTER_PROPERTIES,
} from './data/starterProperties';
import {
  acknowledgeRentChange,
  auth,
  db,
  ensureUserProfile,
  handleFirestoreError,
  OperationType,
  removePropertyBookmark,
  savePropertyBookmark,
  signInWithGoogle,
  signOutUser,
  submitPropertyFeedback,
  timestampToMillis,
} from './lib/firebase';
import { calculateDistanceKm, formatINR, gajToSqft } from './lib/geo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PlacesSearchInput } from './components/PlacesSearchInput';
import { RadiusMapView } from './components/RadiusMapView';
import { PropertyCard } from './components/PropertyCard';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { ExitFeedbackModal } from './components/ExitFeedbackModal';
import { ListPropertyView } from './components/ListPropertyView';
import { OwnerDashboardView } from './components/OwnerDashboardView';
import {
  ProfileView,
  type SavedListingWithLiveStatus,
} from './components/ProfileView';

type ActivePage = 'explore' | 'map' | 'saved' | 'owner' | 'list';

const LOCAL_SAVED_STORAGE_KEY = 'gharsetu_saved_listings_v1';

function loadLocalSavedListings(): SavedListingRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_SAVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedListingRecord =>
        Boolean(item) &&
        typeof item.propertyId === 'string' &&
        typeof item.savedRent === 'number'
    );
  } catch {
    return [];
  }
}

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];
const MIN_GAJ_OPTIONS = [0, 50, 100, 150, 200];

const DEFAULT_FILTERS: SearchFilters = {
  radiusKm: 10,
  maxBudget: 50000,
  minGaj: 0,
  bhkType: 'All',
  floor: 'All',
  furnishing: 'All',
  preferredTenant: 'All',
};

const MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  (import.meta.env.GOOGLE_MAPS_API_KEY as string | undefined) ||
  '';

function mapDocToProperty(id: string, data: Record<string, unknown>): PropertyListing {
  return {
    id,
    ownerId: String(data.ownerId || ''),
    ownerName: String(data.ownerName || 'Property Owner'),
    title: String(data.title || 'Rental Home'),
    description: String(data.description || ''),
    rooms: Number(data.rooms || 1),
    bhkType: (data.bhkType as BhkType) || '2 BHK',
    floor: (data.floor as FloorType) || '1st Floor',
    areaGaj: Number(data.areaGaj || 100),
    areaSqft: Number(data.areaSqft || 900),
    monthlyRent: Number(data.monthlyRent || 15000),
    securityDeposit: Number(data.securityDeposit || 15000),
    negotiable: Boolean(data.negotiable),
    furnishing: (data.furnishing as FurnishingType) || 'Semi-Furnished',
    paintCondition:
      (data.paintCondition as PropertyListing['paintCondition']) || 'Well Maintained',
    preferredTenant: (data.preferredTenant as PreferredTenantType) || 'Small Family',
    maxOccupants: Number(data.maxOccupants || 4),
    houseRules: Array.isArray(data.houseRules)
      ? data.houseRules.map((r) => String(r))
      : [],
    ownerPreferenceNote: String(data.ownerPreferenceNote || ''),
    state: String(data.state || ''),
    city: String(data.city || ''),
    area: String(data.area || ''),
    addressLine: String(data.addressLine || ''),
    lat: Number(data.lat || 28.6279),
    lng: Number(data.lng || 77.3649),
    photoUrl: String(data.photoUrl || ''),
    status: (data.status as PropertyListing['status']) || 'available',
    isPublished: Boolean(data.isPublished),
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

function GharSetuApp() {
  const [page, setPage] = useState<ActivePage>('explore');
  const [language, setLanguage] = useState<LanguageMode>('hinglish');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('gaj');
  const [showMapSplit, setShowMapSplit] = useState<boolean>(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Google Maps Demo Key Quota Banner State
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Search & Filter State
  const [searchCenter, setSearchCenter] = useState<SearchCenter>(PRESET_LOCATIONS[0]);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  // Cloud & Local Data State
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [cloudProperties, setCloudProperties] = useState<PropertyListing[]>([]);
  const [ownedProperties, setOwnedProperties] = useState<PropertyListing[]>([]);
  const [cloudSavedListings, setCloudSavedListings] = useState<SavedListingRecord[]>([]);
  const [localSavedListings, setLocalSavedListings] = useState<SavedListingRecord[]>(() =>
    loadLocalSavedListings()
  );
  const [ownerFeedbackMap, setOwnerFeedbackMap] = useState<
    Record<string, PropertyFeedback[]>
  >({});
  const [ownerInquiryMap, setOwnerInquiryMap] = useState<
    Record<string, PropertyInquiry[]>
  >({});
  const [sessionShowcaseFeedback, setSessionShowcaseFeedback] = useState<
    PropertyFeedback[]
  >(INITIAL_SHOWCASE_FEEDBACK);

  // Interactive Tenant Workflow State
  const [inquiredIds, setInquiredIds] = useState<string[]>([]);
  const [feedbackGivenIds, setFeedbackGivenIds] = useState<string[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [pendingFeedbackProperty, setPendingFeedbackProperty] =
    useState<PropertyListing | null>(null);
  const [queuedNextProperty, setQueuedNextProperty] =
    useState<PropertyListing | null>(null);
  const [editingProperty, setEditingProperty] = useState<PropertyListing | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const notifiedPriceChangeRef = useRef<Record<string, number>>({});

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  // Persist guest saved listings locally
  useEffect(() => {
    try {
      window.localStorage.setItem(
        LOCAL_SAVED_STORAGE_KEY,
        JSON.stringify(localSavedListings)
      );
    } catch {
      // Ignore storage quota errors in private mode
    }
  }, [localSavedListings]);

  // Listen for Google Maps quota exceeded custom events
  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        void ensureUserProfile(nextUser);
      } else {
        setUserProfile(null);
        setCloudProperties([]);
        setOwnedProperties([]);
        setCloudSavedListings([]);
        setOwnerFeedbackMap({});
        setOwnerInquiryMap({});
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time listeners (strictly attached only when authReady && user)
  useEffect(() => {
    if (!authReady || !user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const prefUnit: AreaUnit = data.preferredUnit === 'sqft' ? 'sqft' : 'gaj';
        setUserProfile({
          uid: String(data.uid || user.uid),
          displayName: String(data.displayName || user.displayName || 'GharSetu Member'),
          preferredUnit: prefUnit,
          city: String(data.city || 'Noida'),
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    );

    const savedPath = `users/${user.uid}/savedListings`;
    const savedQuery = query(
      collection(db, 'users', user.uid, 'savedListings'),
      where('userId', '==', user.uid)
    );
    const unsubSaved = onSnapshot(
      savedQuery,
      (snap) => {
        const list: SavedListingRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              propertyId: String(data.propertyId || d.id),
              userId: String(data.userId || user.uid),
              propertyTitle: String(data.propertyTitle || 'Saved Rental Home'),
              propertyArea: String(data.propertyArea || ''),
              savedRent: Number(data.savedRent || 0),
              lastSeenRent: Number(data.lastSeenRent || data.savedRent || 0),
              savedAt: timestampToMillis(data.savedAt),
              updatedAt: timestampToMillis(data.updatedAt),
            };
          })
          .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        setCloudSavedListings(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, savedPath);
      }
    );

    const pubQuery = query(
      collection(db, 'properties'),
      where('isPublished', '==', true)
    );
    const unsubPub = onSnapshot(
      pubQuery,
      (snap) => {
        const list = snap.docs.map((d) =>
          mapDocToProperty(d.id, d.data() as Record<string, unknown>)
        );
        setCloudProperties(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'properties');
      }
    );

    const ownedQuery = query(
      collection(db, 'properties'),
      where('ownerId', '==', user.uid)
    );
    const unsubOwned = onSnapshot(
      ownedQuery,
      (snap) => {
        const list = snap.docs.map((d) =>
          mapDocToProperty(d.id, d.data() as Record<string, unknown>)
        );
        setOwnedProperties(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'properties');
      }
    );

    return () => {
      unsubProfile();
      unsubSaved();
      unsubPub();
      unsubOwned();
    };
  }, [authReady, user]);

  // Subscribe to feedback and inquiries for every property owned by the signed-in user
  useEffect(() => {
    if (!authReady || !user || ownedProperties.length === 0) {
      setOwnerFeedbackMap({});
      setOwnerInquiryMap({});
      return;
    }

    const unsubscribers: Unsubscribe[] = [];

    for (const prop of ownedProperties) {
      const fbPath = `properties/${prop.id}/feedback`;
      const fbQuery = query(
        collection(db, 'properties', prop.id, 'feedback'),
        where('propertyOwnerId', '==', user.uid)
      );
      unsubscribers.push(
        onSnapshot(
          fbQuery,
          (snap) => {
            const items: PropertyFeedback[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                propertyId: String(data.propertyId || prop.id),
                propertyOwnerId: String(data.propertyOwnerId || user.uid),
                tenantId: String(data.tenantId || ''),
                reasons: Array.isArray(data.reasons)
                  ? data.reasons.map((r) => String(r))
                  : [],
                comment: String(data.comment || ''),
                suggestedRent: Number(data.suggestedRent || 0),
                status: (data.status as PropertyFeedback['status']) || 'new',
                ownerActionNote: String(data.ownerActionNote || ''),
                createdAt: timestampToMillis(data.createdAt),
                updatedAt: timestampToMillis(data.updatedAt),
              };
            });
            setOwnerFeedbackMap((prev) => ({ ...prev, [prop.id]: items }));
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, fbPath);
          }
        )
      );

      const inqPath = `properties/${prop.id}/inquiries`;
      const inqQuery = query(
        collection(db, 'properties', prop.id, 'inquiries'),
        where('propertyOwnerId', '==', user.uid)
      );
      unsubscribers.push(
        onSnapshot(
          inqQuery,
          (snap) => {
            const items: PropertyInquiry[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                propertyId: String(data.propertyId || prop.id),
                propertyOwnerId: String(data.propertyOwnerId || user.uid),
                tenantId: String(data.tenantId || ''),
                tenantName: String(data.tenantName || 'Tenant'),
                familySize: Number(data.familySize || 1),
                tenantType: String(data.tenantType || 'Small Family'),
                message: String(data.message || ''),
                status: (data.status as PropertyInquiry['status']) || 'pending',
                createdAt: timestampToMillis(data.createdAt),
                updatedAt: timestampToMillis(data.updatedAt),
              };
            });
            setOwnerInquiryMap((prev) => ({ ...prev, [prop.id]: items }));
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, inqPath);
          }
        )
      );
    }

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [authReady, user, ownedProperties]);

  const ownerFeedbackList = useMemo(() => {
    return Object.values(ownerFeedbackMap)
      .flat()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [ownerFeedbackMap]);

  const ownerInquiriesList = useMemo(() => {
    return Object.values(ownerInquiryMap)
      .flat()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [ownerInquiryMap]);

  // Combine cloud listings with starter catalog (cloud listings appear first!)
  const allProperties = useMemo(() => {
    const availableCloud = cloudProperties.filter((p) => p.status === 'available');
    return [...availableCloud, ...STARTER_PROPERTIES];
  }, [cloudProperties]);

  // Full lookup map including owned & cloud listings so saved watchlist tracks live rent updates
  const propertyByIdMap = useMemo(() => {
    const map = new Map<string, PropertyListing>();
    for (const p of STARTER_PROPERTIES) map.set(p.id, p);
    for (const p of cloudProperties) map.set(p.id, p);
    for (const p of ownedProperties) map.set(p.id, p);
    return map;
  }, [cloudProperties, ownedProperties]);

  const activeProperty = useMemo(
    () => (activePropertyId ? propertyByIdMap.get(activePropertyId) || null : null),
    [activePropertyId, propertyByIdMap]
  );

  // Saved Listings & Real-time Rent Price Change Detection
  const activeSavedRecords = user ? cloudSavedListings : localSavedListings;

  const savedIds = useMemo(
    () => activeSavedRecords.map((rec) => rec.propertyId),
    [activeSavedRecords]
  );

  const savedItems = useMemo<SavedListingWithLiveStatus[]>(() => {
    return activeSavedRecords.map((record) => {
      const property = propertyByIdMap.get(record.propertyId) || null;
      const currentRent = property ? property.monthlyRent : record.lastSeenRent;
      const unreadDelta = property ? currentRent - record.lastSeenRent : 0;
      const totalDelta = property ? currentRent - record.savedRent : 0;
      return {
        record,
        property,
        currentRent,
        unreadDelta,
        totalDelta,
        hasUnreadPriceChange: Boolean(property) && unreadDelta !== 0,
      };
    });
  }, [activeSavedRecords, propertyByIdMap]);

  const unreadAlertCount = useMemo(
    () => savedItems.filter((item) => item.hasUnreadPriceChange).length,
    [savedItems]
  );

  // Trigger a live toast notification whenever a bookmarked property's rent changes
  useEffect(() => {
    for (const item of savedItems) {
      if (!item.hasUnreadPriceChange) continue;
      const prevNotified = notifiedPriceChangeRef.current[item.record.propertyId];
      if (prevNotified === item.currentRent) continue;

      notifiedPriceChangeRef.current[item.record.propertyId] = item.currentRent;
      const title = item.property?.title || item.record.propertyTitle;
      const direction = item.unreadDelta < 0 ? 'dropped' : 'increased';
      showToast(
        language === 'hinglish'
          ? `Rent Alert: "${title}" ka rent ${formatINR(item.record.lastSeenRent)} se ${formatINR(item.currentRent)}/mo ho gaya!`
          : `Rent Alert: "${title}" ${direction} from ${formatINR(item.record.lastSeenRent)} to ${formatINR(item.currentRent)}/mo!`
      );
      break;
    }
  }, [savedItems, language, showToast]);

  // Compute exact distances and apply Radius + Budget + Gaj + Rooms/Floor/Furnishing filters
  const filteredProperties = useMemo(() => {
    return allProperties
      .map((prop) => ({
        ...prop,
        distanceKm: calculateDistanceKm(
          searchCenter.lat,
          searchCenter.lng,
          prop.lat,
          prop.lng
        ),
      }))
      .filter((prop) => {
        if (prop.distanceKm > filters.radiusKm) return false;
        if (prop.monthlyRent > filters.maxBudget) return false;
        if (prop.areaGaj < filters.minGaj) return false;
        if (filters.bhkType !== 'All' && prop.bhkType !== filters.bhkType) return false;
        if (filters.floor !== 'All' && prop.floor !== filters.floor) return false;
        if (filters.furnishing !== 'All' && prop.furnishing !== filters.furnishing)
          return false;
        if (
          filters.preferredTenant !== 'All' &&
          prop.preferredTenant !== filters.preferredTenant &&
          prop.preferredTenant !== 'Anyone'
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [allProperties, searchCenter, filters]);

  const handleRequestSignIn = useCallback(async (): Promise<User | null> => {
    try {
      const signedUser = await signInWithGoogle();
      showToast(`Signed in as ${signedUser.displayName || 'Member'}`);
      return signedUser;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in cancelled.';
      if (!msg.includes('popup-closed-by-user')) {
        showToast('Sign-in could not be completed. Please try again.');
      }
      return null;
    }
  }, [showToast]);

  const handleToggleSave = useCallback(
    async (propertyId: string) => {
      const alreadySaved = savedIds.includes(propertyId);
      const targetProp = propertyByIdMap.get(propertyId);

      if (user) {
        try {
          if (alreadySaved) {
            await removePropertyBookmark(user, propertyId);
            showToast(
              language === 'hinglish'
                ? 'Saved Listings se hata diya gaya.'
                : 'Removed from Saved Listings.'
            );
          } else if (targetProp) {
            await savePropertyBookmark(user, targetProp);
            showToast(
              language === 'hinglish'
                ? 'Ghar bookmark ho gaya! Rent badalne par notification milega.'
                : 'Saved to watchlist — we will notify you if the rent changes!'
            );
          }
        } catch (err) {
          showToast(
            err instanceof Error
              ? err.message
              : 'Could not update saved listing.'
          );
        }
        return;
      }

      // Guest local browser persistence
      if (alreadySaved) {
        setLocalSavedListings((prev) =>
          prev.filter((item) => item.propertyId !== propertyId)
        );
        showToast(
          language === 'hinglish'
            ? 'Saved Listings se hata diya gaya.'
            : 'Removed from Saved Listings.'
        );
      } else if (targetProp) {
        const now = Date.now();
        const newRec: SavedListingRecord = {
          propertyId: targetProp.id,
          userId: 'guest',
          propertyTitle: targetProp.title,
          propertyArea: `${targetProp.area}, ${targetProp.city}`,
          savedRent: targetProp.monthlyRent,
          lastSeenRent: targetProp.monthlyRent,
          savedAt: now,
          updatedAt: now,
        };
        setLocalSavedListings((prev) => [newRec, ...prev]);
        showToast(
          language === 'hinglish'
            ? 'Ghar bookmark ho gaya! Sign in karke real-time rent alerts sync karein.'
            : 'Bookmarked! Sign in to sync across devices & track live rent changes.'
        );
      }
    },
    [savedIds, propertyByIdMap, user, language, showToast]
  );

  const handleAcknowledgeAlert = useCallback(
    async (item: SavedListingWithLiveStatus) => {
      const nextTitle = item.property?.title || item.record.propertyTitle;
      const nextArea = item.property
        ? `${item.property.area}, ${item.property.city}`
        : item.record.propertyArea;

      if (user) {
        await acknowledgeRentChange(
          user,
          item.record.propertyId,
          item.currentRent,
          nextTitle,
          nextArea
        );
      } else {
        setLocalSavedListings((prev) =>
          prev.map((rec) =>
            rec.propertyId === item.record.propertyId
              ? {
                  ...rec,
                  lastSeenRent: item.currentRent,
                  propertyTitle: nextTitle,
                  propertyArea: nextArea,
                  updatedAt: Date.now(),
                }
              : rec
          )
        );
      }
      showToast(
        language === 'hinglish'
          ? 'Price alert seen mark kar diya gaya.'
          : 'Rent change alert marked as seen.'
      );
    },
    [user, language, showToast]
  );

  const handleAcknowledgeAllAlerts = useCallback(async () => {
    const unread = savedItems.filter((item) => item.hasUnreadPriceChange);
    if (unread.length === 0) return;
    if (user) {
      await Promise.all(
        unread.map((item) =>
          acknowledgeRentChange(
            user,
            item.record.propertyId,
            item.currentRent,
            item.property?.title || item.record.propertyTitle,
            item.property
              ? `${item.property.area}, ${item.property.city}`
              : item.record.propertyArea
          )
        )
      );
    } else {
      const rentMap = new Map(unread.map((u) => [u.record.propertyId, u.currentRent]));
      setLocalSavedListings((prev) =>
        prev.map((rec) => {
          const updatedRent = rentMap.get(rec.propertyId);
          return updatedRent !== undefined
            ? { ...rec, lastSeenRent: updatedRent, updatedAt: Date.now() }
            : rec;
        })
      );
    }
    showToast(
      language === 'hinglish'
        ? 'Sabhi rent price alerts seen mark ho gaye.'
        : 'All rent change alerts marked as seen.'
    );
  }, [savedItems, user, language, showToast]);

  // Smart switching: if user was viewing Property A without saving/inquiring and opens Property B, ask quick feedback for A!
  const handleSelectProperty = (nextProp: PropertyListing) => {
    if (
      activeProperty &&
      activeProperty.id !== nextProp.id &&
      !savedIds.includes(activeProperty.id) &&
      !inquiredIds.includes(activeProperty.id) &&
      !feedbackGivenIds.includes(activeProperty.id) &&
      user?.uid !== activeProperty.ownerId
    ) {
      setPendingFeedbackProperty(activeProperty);
      setQueuedNextProperty(nextProp);
      setActivePropertyId(null);
      return;
    }
    setActivePropertyId(nextProp.id);
  };

  const handleCloseWithoutInterest = () => {
    if (!activeProperty) return;
    const prevProp = activeProperty;
    setActivePropertyId(null);
    if (
      !feedbackGivenIds.includes(prevProp.id) &&
      user?.uid !== prevProp.ownerId
    ) {
      setPendingFeedbackProperty(prevProp);
    }
  };

  const handleSubmitExitFeedback = async (payload: {
    reasons: string[];
    comment: string;
    suggestedRent: number;
  }) => {
    if (!pendingFeedbackProperty) return;
    const target = pendingFeedbackProperty;

    if (!target.isShowcase && user) {
      await submitPropertyFeedback(user, target, payload);
    } else {
      const localFb: PropertyFeedback = {
        id: `session_fb_${Date.now()}`,
        propertyId: target.id,
        propertyOwnerId: target.ownerId,
        tenantId: user?.uid || 'guest_tenant',
        reasons: payload.reasons,
        comment: payload.comment,
        suggestedRent: payload.suggestedRent,
        status: 'new',
        ownerActionNote: '',
        createdAt: Date.now(),
      };
      setSessionShowcaseFeedback((prev) => [localFb, ...prev]);
    }

    setFeedbackGivenIds((prev) => [...prev, target.id]);
    setPendingFeedbackProperty(null);
    showToast(
      language === 'hinglish'
        ? 'Shukriya! Owner ko aapka feedback bhej diya gaya hai.'
        : 'Thank you! Your improvement feedback has been shared with the owner.'
    );

    if (queuedNextProperty) {
      setActivePropertyId(queuedNextProperty.id);
      setQueuedNextProperty(null);
    }
  };

  const handleSkipFeedback = () => {
    if (pendingFeedbackProperty) {
      setFeedbackGivenIds((prev) => [...prev, pendingFeedbackProperty.id]);
    }
    setPendingFeedbackProperty(null);
    if (queuedNextProperty) {
      setActivePropertyId(queuedNextProperty.id);
      setQueuedNextProperty(null);
    }
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const firstName = user?.displayName?.split(' ')[0] || 'Account';

  return (
    <APIProvider apiKey={MAPS_API_KEY} language="en" region="IN">
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        {/* Mandatory Case A Demo Key Quota Banner */}
        {mapsQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Strict 3-Zone Top Bar Contract */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
            {/* Zone 1: Single-line Brand Wordmark */}
            <button
              type="button"
              onClick={() => {
                setEditingProperty(null);
                setPage('explore');
              }}
              className="font-display text-xl font-extrabold tracking-tight text-slate-900 hover:text-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              GharSetu
            </button>

            {/* Zone 2: 5 Concise Single-Line Nav Links */}
            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-6 text-sm font-medium"
            >
              <button
                type="button"
                onClick={() => {
                  setEditingProperty(null);
                  setPage('explore');
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  page === 'explore'
                    ? 'text-teal-800 font-semibold border-b-2 border-teal-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Find Homes
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProperty(null);
                  setShowMapSplit(true);
                  setPage('map');
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  page === 'map'
                    ? 'text-teal-800 font-semibold border-b-2 border-teal-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Map Radius
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProperty(null);
                  setPage('saved');
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  page === 'saved'
                    ? 'text-teal-800 font-semibold border-b-2 border-teal-800'
                    : unreadAlertCount > 0
                      ? 'text-teal-800 font-semibold hover:text-teal-900'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {unreadAlertCount > 0 ? `Saved (${unreadAlertCount})` : 'Saved'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProperty(null);
                  setPage('owner');
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  page === 'owner'
                    ? 'text-teal-800 font-semibold border-b-2 border-teal-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Owner Hub
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProperty(null);
                  setPage('list');
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  page === 'list'
                    ? 'text-teal-800 font-semibold border-b-2 border-teal-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Post Home
              </button>
            </nav>

            {/* Zone 3: 1 Primary Action */}
            <div className="relative shrink-0">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((prev) => !prev)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {firstName}
                  </button>
                  {accountMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                      <div className="px-3.5 py-2 border-b border-slate-100">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {user.displayName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {user.email}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setPage('saved');
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Profile &amp; Saved Listings</span>
                        {unreadAlertCount > 0 && (
                          <span className="text-[11px] font-bold text-teal-800 tabular-nums">
                            {unreadAlertCount} new
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setPage('owner');
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Owner Hub &amp; Feedback
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setEditingProperty(null);
                          setPage('list');
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Post a Home
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          void signOutUser();
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleRequestSignIn()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Mobile compact nav row (only on < md screens) */}
          <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
            {(
              [
                ['explore', 'Find Homes'],
                ['map', 'Map Radius'],
                ['saved', unreadAlertCount > 0 ? `Saved (${unreadAlertCount})` : 'Saved'],
                ['owner', 'Owner Hub'],
                ['list', 'Post Home'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setEditingProperty(null);
                  setPage(key);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                  page === key
                    ? 'bg-teal-50 text-teal-900 font-semibold'
                    : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-medium max-w-sm">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1">
          {(page === 'explore' || page === 'map') && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
              {/* Focused Rental Search Header + Utility Strip */}
              <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 text-balance">
                    {language === 'hinglish'
                      ? 'Apne area ke 10 km ke andar seedha rent par ghar dhundhein'
                      : 'Direct rental homes within your chosen radius'}
                  </h1>
                  <p className="text-sm text-slate-600">
                    {language === 'hinglish'
                      ? 'Budget, Gaj / Sq.Ft, floor aur owner ki family preferences ke hisab se filter karein. Ghar pasand na aaye toh owner ko seedha feedback dein.'
                      : 'Filter by distance radius, monthly budget, Gaj or Sq.Ft area, and owner family preferences — and share honest feedback when you skip a home.'}
                  </p>
                </div>

                {/* Workspace Language & Gaj/Sq.Ft Controls (kept out of top header) */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="inline-flex items-center p-1 bg-slate-200/75 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setAreaUnit('gaj')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        areaUnit === 'gaj'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Gaj (गज)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAreaUnit('sqft')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        areaUnit === 'sqft'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sq. Ft.
                    </button>
                  </div>

                  <div className="inline-flex items-center p-1 bg-slate-200/75 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setLanguage('hinglish')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        language === 'hinglish'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Hinglish
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('english')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        language === 'english'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>
              </section>

              {/* Primary Search & Filter Bar (Radius + Budget + Gaj) */}
              <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                  {/* Location Search */}
                  <div className="lg:col-span-5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {language === 'hinglish'
                        ? 'Area ya City Chunein (Search Center)'
                        : 'Search Area or Locality'}
                    </label>
                    <PlacesSearchInput
                      value={searchCenter}
                      onSelectCenter={setSearchCenter}
                    />
                  </div>

                  {/* 10 km Radius Selector */}
                  <div className="lg:col-span-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        {language === 'hinglish'
                          ? 'Kitne km ka Area Dekhna Hai'
                          : 'Search Radius'}
                      </label>
                      <span className="text-xs font-bold text-teal-800 tabular-nums">
                        Within {filters.radiusKm} km
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1 p-1 bg-slate-100 rounded-lg">
                      {RADIUS_OPTIONS.map((km) => (
                        <button
                          key={km}
                          type="button"
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, radiusKm: km }))
                          }
                          className={`py-1.5 text-xs font-semibold rounded-md tabular-nums transition-colors ${
                            filters.radiusKm === km
                              ? 'bg-teal-800 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {km} km
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Monthly Budget Slider */}
                  <div className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        {language === 'hinglish' ? 'Aapka Max Budget' : 'Max Monthly Budget'}
                      </label>
                      <span className="text-xs font-bold text-slate-900 tabular-nums">
                        {filters.maxBudget >= 50000
                          ? '₹50,000+'
                          : formatINR(filters.maxBudget)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={8000}
                      max={50000}
                      step={1000}
                      value={filters.maxBudget}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          maxBudget: Number(e.target.value),
                        }))
                      }
                      aria-label="Maximum monthly rent budget"
                      className="w-full h-2 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 tabular-nums mt-0.5">
                      <span>₹8k</span>
                      <span>₹20k</span>
                      <span>₹35k</span>
                      <span>₹50k+</span>
                    </div>
                  </div>
                </div>

                {/* Second Row: Gaj Filter + BHK + More Filters + Layout Switch */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Minimum Gaj / Sq.Ft Filter */}
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <span className="px-2 text-[11px] font-medium text-slate-500 whitespace-nowrap">
                        {areaUnit === 'gaj' ? 'Min Gaj:' : 'Min Sq.Ft:'}
                      </span>
                      {MIN_GAJ_OPTIONS.map((gaj) => (
                        <button
                          key={gaj}
                          type="button"
                          onClick={() =>
                            setFilters((prev) => ({ ...prev, minGaj: gaj }))
                          }
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md tabular-nums transition-colors whitespace-nowrap ${
                            filters.minGaj === gaj
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {gaj === 0
                            ? 'Any'
                            : areaUnit === 'gaj'
                              ? `${gaj}+ Gaj`
                              : `${gajToSqft(gaj)}+`}
                        </button>
                      ))}
                    </div>

                    {/* BHK Selector */}
                    <select
                      aria-label="Filter by BHK"
                      value={filters.bhkType}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          bhkType: e.target.value as BhkType | 'All',
                        }))
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-teal-700"
                    >
                      <option value="All">All Rooms / BHK</option>
                      {BHK_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {/* Toggle Extra Filters */}
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                        showAdvancedFilters
                          ? 'bg-teal-50 border-teal-700 text-teal-900'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>
                        {language === 'hinglish'
                          ? 'Floor & Family Filters'
                          : 'More Filters'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>

                  {/* Map Split vs Grid Toggle */}
                  {page === 'explore' && (
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setShowMapSplit(true)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          showMapSplit
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                        <span>Map + List</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMapSplit(false)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          !showMapSplit
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Grid2X2 className="w-3.5 h-3.5" />
                        <span>Grid Only</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Expandable Extra Filters (Floor, Furnishing, Family Type) */}
                {showAdvancedFilters && (
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Floor Preference
                      </label>
                      <select
                        value={filters.floor}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            floor: e.target.value as FloorType | 'All',
                          }))
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      >
                        <option value="All">Any Floor</option>
                        {FLOOR_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Furnishing
                      </label>
                      <select
                        value={filters.furnishing}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            furnishing: e.target.value as FurnishingType | 'All',
                          }))
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      >
                        <option value="All">Any Furnishing</option>
                        {FURNISHING_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Owner Family / Tenant Preference
                      </label>
                      <select
                        value={filters.preferredTenant}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            preferredTenant: e.target.value as PreferredTenantType | 'All',
                          }))
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                      >
                        <option value="All">Any Tenant Type</option>
                        {TENANT_PREF_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </section>

              {/* Results Status Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="text-slate-700">
                  <span className="font-bold text-slate-900 tabular-nums">
                    {filteredProperties.length}
                  </span>{' '}
                  {filteredProperties.length === 1 ? 'home' : 'homes'} within{' '}
                  <span className="font-semibold text-teal-800 tabular-nums">
                    {filters.radiusKm} km
                  </span>{' '}
                  of <span className="font-semibold text-slate-900">{searchCenter.label}</span>
                  {filters.maxBudget < 50000 && (
                    <span className="text-slate-500">
                      {' '}
                      · Under {formatINR(filters.maxBudget)}/mo
                    </span>
                  )}
                  {filters.minGaj > 0 && (
                    <span className="text-slate-500">
                      {' '}
                      · {filters.minGaj}+ Gaj ({gajToSqft(filters.minGaj)}+ sq.ft)
                    </span>
                  )}
                </div>

                {savedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPage('saved')}
                    className="text-xs font-semibold text-teal-800 hover:text-teal-900 underline underline-offset-2 tabular-nums"
                  >
                    {savedIds.length} saved
                    {unreadAlertCount > 0
                      ? ` · ${unreadAlertCount} rent ${unreadAlertCount === 1 ? 'alert' : 'alerts'}`
                      : ''}
                  </button>
                )}
              </div>

              {/* MAP-FIRST OR SPLIT LAYOUT */}
              {page === 'map' ? (
                <div className="space-y-6">
                  <RadiusMapView
                    center={searchCenter}
                    radiusKm={filters.radiusKm}
                    properties={filteredProperties}
                    areaUnit={areaUnit}
                    selectedPropertyId={activeProperty?.id || null}
                    onSelectProperty={handleSelectProperty}
                    onChangeCenter={setSearchCenter}
                    hasApiKey={Boolean(MAPS_API_KEY)}
                  />
                  {filteredProperties.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredProperties.map((prop) => (
                        <PropertyCard
                          key={prop.id}
                          property={prop}
                          distanceKm={prop.distanceKm}
                          areaUnit={areaUnit}
                          language={language}
                          isSaved={savedIds.includes(prop.id)}
                          isSelected={activeProperty?.id === prop.id}
                          onToggleSave={handleToggleSave}
                          onSelect={handleSelectProperty}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : showMapSplit ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left: Property Cards */}
                  <div className="lg:col-span-7">
                    {filteredProperties.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                        <h3 className="text-base font-semibold text-slate-900">
                          {language === 'hinglish'
                            ? `${filters.radiusKm} km ke andar is budget mein koi ghar nahi mila`
                            : `No homes match within ${filters.radiusKm} km`}
                        </h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                          {language === 'hinglish'
                            ? 'Radius (15 km ya 25 km) badha kar dekhein, ya budget / area filter adjust karein.'
                            : 'Try expanding the radius to 15 km or 25 km, or increasing your monthly budget.'}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                radiusKm: Math.min(50, Math.max(25, prev.radiusKm * 2)),
                              }))
                            }
                            className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors"
                          >
                            Expand Radius to 25 km
                          </button>
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Reset All Filters
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {filteredProperties.map((prop) => (
                          <PropertyCard
                            key={prop.id}
                            property={prop}
                            distanceKm={prop.distanceKm}
                            areaUnit={areaUnit}
                            language={language}
                            isSaved={savedIds.includes(prop.id)}
                            isSelected={activeProperty?.id === prop.id}
                            onToggleSave={handleToggleSave}
                            onSelect={handleSelectProperty}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Sticky Google Map with live Radius Circle */}
                  <div className="lg:col-span-5 lg:sticky lg:top-24">
                    <RadiusMapView
                      center={searchCenter}
                      radiusKm={filters.radiusKm}
                      properties={filteredProperties}
                      areaUnit={areaUnit}
                      selectedPropertyId={activeProperty?.id || null}
                      onSelectProperty={handleSelectProperty}
                      onChangeCenter={setSearchCenter}
                      hasApiKey={Boolean(MAPS_API_KEY)}
                    />
                  </div>
                </div>
              ) : (
                /* Full-width 3-column Grid View */
                <div>
                  {filteredProperties.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                      <h3 className="text-base font-semibold text-slate-900">
                        No homes match your current filters
                      </h3>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors"
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredProperties.map((prop) => (
                        <PropertyCard
                          key={prop.id}
                          property={prop}
                          distanceKm={prop.distanceKm}
                          areaUnit={areaUnit}
                          language={language}
                          isSaved={savedIds.includes(prop.id)}
                          isSelected={activeProperty?.id === prop.id}
                          onToggleSave={handleToggleSave}
                          onSelect={handleSelectProperty}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {page === 'saved' && (
            <ProfileView
              user={user}
              userProfile={userProfile}
              language={language}
              areaUnit={areaUnit}
              savedItems={savedItems}
              onChangeAreaUnit={setAreaUnit}
              onRequestSignIn={handleRequestSignIn}
              onSelectProperty={handleSelectProperty}
              onRemoveSaved={(propId) => void handleToggleSave(propId)}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onAcknowledgeAllAlerts={handleAcknowledgeAllAlerts}
              onGoExplore={() => setPage('explore')}
            />
          )}

          {page === 'list' && (
            <ListPropertyView
              user={user}
              language={language}
              editingProperty={editingProperty}
              onRequestSignIn={handleRequestSignIn}
              onSaved={(_id, isEdit) => {
                setEditingProperty(null);
                setPage('owner');
                showToast(
                  isEdit
                    ? 'Home details updated successfully!'
                    : 'Your home is now live in search results!'
                );
              }}
              onCancel={() => {
                setEditingProperty(null);
                setPage('explore');
              }}
            />
          )}

          {page === 'owner' && (
            <OwnerDashboardView
              user={user}
              language={language}
              areaUnit={areaUnit}
              ownedProperties={ownedProperties}
              allProperties={allProperties}
              ownerFeedback={ownerFeedbackList}
              sessionShowcaseFeedback={sessionShowcaseFeedback}
              ownerInquiries={ownerInquiriesList}
              onRequestSignIn={handleRequestSignIn}
              onCreateNew={() => {
                setEditingProperty(null);
                setPage('list');
              }}
              onEditProperty={(prop) => {
                setEditingProperty(prop);
                setPage('list');
              }}
            />
          )}
        </main>

        {/* Quiet Editorial Footer */}
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-800">GharSetu</span> — Direct
              Owner-to-Tenant Rental Marketplace (Gaj &amp; Sq.Ft · 10 km Map Search ·
              Saved Rent Alerts · Owner Feedback)
            </div>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setPage('explore')}
                className="hover:text-slate-900 transition-colors"
              >
                Find Homes
              </button>
              <button
                type="button"
                onClick={() => setPage('saved')}
                className="hover:text-slate-900 transition-colors"
              >
                Saved Listings
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProperty(null);
                  setPage('list');
                }}
                className="hover:text-slate-900 transition-colors"
              >
                List a Property
              </button>
              <button
                type="button"
                onClick={() => setPage('owner')}
                className="hover:text-slate-900 transition-colors"
              >
                Owner Feedback Hub
              </button>
            </div>
          </div>
        </footer>

        {/* Property Detail Modal */}
        {activeProperty && (
          <PropertyDetailModal
            property={activeProperty}
            distanceKm={calculateDistanceKm(
              searchCenter.lat,
              searchCenter.lng,
              activeProperty.lat,
              activeProperty.lng
            )}
            areaUnit={areaUnit}
            language={language}
            user={user}
            isSaved={savedIds.includes(activeProperty.id)}
            onToggleSave={(propId) => void handleToggleSave(propId)}
            onCloseWithoutInterest={handleCloseWithoutInterest}
            onCloseClean={() => setActivePropertyId(null)}
            onRequestSignIn={handleRequestSignIn}
            onInquirySent={(propId) => {
              setInquiredIds((prev) =>
                prev.includes(propId) ? prev : [...prev, propId]
              );
              showToast('Visit request sent to owner!');
            }}
          />
        )}

        {/* Smart Exit Feedback Modal */}
        {pendingFeedbackProperty && (
          <ExitFeedbackModal
            property={pendingFeedbackProperty}
            language={language}
            onSubmit={handleSubmitExitFeedback}
            onSkip={handleSkipFeedback}
          />
        )}
      </div>
    </APIProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GharSetuApp />
    </ErrorBoundary>
  );
}
