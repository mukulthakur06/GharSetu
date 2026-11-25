import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AreaUnit,
  BhkType,
  FeedbackStatus,
  FloorType,
  FurnishingType,
  InquiryStatus,
  OwnerContactInfo,
  PaintConditionType,
  PreferredTenantType,
  PropertyListing,
  PropertyStatus,
} from '../types/rental';
import { sanitizeId } from './geo';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function timestampToMillis(value: unknown): number {
  if (!value) return Date.now();
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return (value as Timestamp).toMillis();
  }
  return Date.now();
}

export async function ensureUserProfile(user: User, preferredUnit: AreaUnit = 'gaj') {
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        displayName: (user.displayName || 'GharSetu Member').trim().slice(0, 100),
        preferredUnit,
        city: 'Noida',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface CreatePropertyPayload {
  ownerName: string;
  title: string;
  description: string;
  rooms: number;
  bhkType: BhkType;
  floor: FloorType;
  areaGaj: number;
  areaSqft: number;
  monthlyRent: number;
  securityDeposit: number;
  negotiable: boolean;
  furnishing: FurnishingType;
  paintCondition: PaintConditionType;
  preferredTenant: PreferredTenantType;
  maxOccupants: number;
  houseRules: string[];
  ownerPreferenceNote: string;
  state: string;
  city: string;
  area: string;
  addressLine: string;
  lat: number;
  lng: number;
  photoUrl: string;
  contactPhone: string;
  visitingHours: string;
}

function clampNumber(val: number, min: number, max: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

function sanitizePhone(raw: string): string {
  const cleaned = raw.replace(/[^0-9+\-\s()]/g, '').trim().slice(0, 20);
  return cleaned.length >= 7 ? cleaned : '+91 98000 00000';
}

export async function createPropertyListing(
  user: User,
  payload: CreatePropertyPayload
): Promise<string> {
  const propertyId = sanitizeId(`prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const propertyPath = `properties/${propertyId}`;
  const contactPath = `properties/${propertyId}/ownerContact/primary`;

  const sanitizedRules = payload.houseRules
    .map((r) => r.trim().slice(0, 80))
    .filter((r) => r.length > 0)
    .slice(0, 8);

  const areaGaj = clampNumber(Math.round(payload.areaGaj), 10, 5000);
  const areaSqft = clampNumber(Math.round(payload.areaSqft || areaGaj * 9), 90, 45000);

  const propertyDoc = {
    ownerId: user.uid,
    ownerName: (payload.ownerName || user.displayName || 'Property Owner').trim().slice(0, 80),
    title: payload.title.trim().slice(0, 120),
    description: payload.description.trim().slice(0, 1000),
    rooms: clampNumber(Math.round(payload.rooms), 1, 10),
    bhkType: payload.bhkType,
    floor: payload.floor,
    areaGaj,
    areaSqft,
    monthlyRent: clampNumber(Math.round(payload.monthlyRent), 1000, 500000),
    securityDeposit: clampNumber(Math.round(payload.securityDeposit), 0, 2000000),
    negotiable: Boolean(payload.negotiable),
    furnishing: payload.furnishing,
    paintCondition: payload.paintCondition,
    preferredTenant: payload.preferredTenant,
    maxOccupants: clampNumber(Math.round(payload.maxOccupants), 1, 20),
    houseRules: sanitizedRules,
    ownerPreferenceNote: payload.ownerPreferenceNote.trim().slice(0, 300),
    state: payload.state.trim().slice(0, 60),
    city: payload.city.trim().slice(0, 60),
    area: payload.area.trim().slice(0, 100),
    addressLine: payload.addressLine.trim().slice(0, 200),
    lat: clampNumber(payload.lat, -90, 90),
    lng: clampNumber(payload.lng, -180, 180),
    photoUrl: payload.photoUrl.trim().slice(0, 200000),
    status: 'available' as PropertyStatus,
    isPublished: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'properties', propertyId), propertyDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, propertyPath);
  }

  try {
    await setDoc(doc(db, 'properties', propertyId, 'ownerContact', 'primary'), {
      propertyId,
      ownerId: user.uid,
      contactPhone: sanitizePhone(payload.contactPhone),
      visitingHours: (payload.visitingHours || '10:00 AM - 7:00 PM').trim().slice(0, 100),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, contactPath);
  }

  return propertyId;
}

export async function updatePropertyListing(
  propertyId: string,
  updates: Partial<{
    title: string;
    description: string;
    monthlyRent: number;
    securityDeposit: number;
    negotiable: boolean;
    furnishing: FurnishingType;
    paintCondition: PaintConditionType;
    preferredTenant: PreferredTenantType;
    maxOccupants: number;
    houseRules: string[];
    ownerPreferenceNote: string;
    status: PropertyStatus;
    areaGaj: number;
    areaSqft: number;
  }>
): Promise<void> {
  const path = `properties/${propertyId}`;
  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.title !== undefined) cleanUpdates.title = updates.title.trim().slice(0, 120);
  if (updates.description !== undefined)
    cleanUpdates.description = updates.description.trim().slice(0, 1000);
  if (updates.monthlyRent !== undefined)
    cleanUpdates.monthlyRent = clampNumber(Math.round(updates.monthlyRent), 1000, 500000);
  if (updates.securityDeposit !== undefined)
    cleanUpdates.securityDeposit = clampNumber(Math.round(updates.securityDeposit), 0, 2000000);
  if (updates.negotiable !== undefined) cleanUpdates.negotiable = Boolean(updates.negotiable);
  if (updates.furnishing !== undefined) cleanUpdates.furnishing = updates.furnishing;
  if (updates.paintCondition !== undefined) cleanUpdates.paintCondition = updates.paintCondition;
  if (updates.preferredTenant !== undefined) cleanUpdates.preferredTenant = updates.preferredTenant;
  if (updates.maxOccupants !== undefined)
    cleanUpdates.maxOccupants = clampNumber(Math.round(updates.maxOccupants), 1, 20);
  if (updates.houseRules !== undefined) {
    cleanUpdates.houseRules = updates.houseRules
      .map((r) => r.trim().slice(0, 80))
      .filter((r) => r.length > 0)
      .slice(0, 8);
  }
  if (updates.ownerPreferenceNote !== undefined)
    cleanUpdates.ownerPreferenceNote = updates.ownerPreferenceNote.trim().slice(0, 300);
  if (updates.status !== undefined) cleanUpdates.status = updates.status;
  if (updates.areaGaj !== undefined)
    cleanUpdates.areaGaj = clampNumber(Math.round(updates.areaGaj), 10, 5000);
  if (updates.areaSqft !== undefined)
    cleanUpdates.areaSqft = clampNumber(Math.round(updates.areaSqft), 90, 45000);

  try {
    await updateDoc(doc(db, 'properties', propertyId), cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePropertyListing(propertyId: string): Promise<void> {
  const path = `properties/${propertyId}`;
  try {
    await deleteDoc(doc(db, 'properties', propertyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getOwnerContact(propertyId: string): Promise<OwnerContactInfo | null> {
  const path = `properties/${propertyId}/ownerContact/primary`;
  try {
    const snap = await getDoc(doc(db, 'properties', propertyId, 'ownerContact', 'primary'));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      propertyId: String(d.propertyId),
      ownerId: String(d.ownerId),
      contactPhone: String(d.contactPhone),
      visitingHours: String(d.visitingHours || ''),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function submitPropertyFeedback(
  user: User,
  property: PropertyListing,
  payload: {
    reasons: string[];
    comment: string;
    suggestedRent: number;
  }
): Promise<string> {
  const feedbackId = sanitizeId(`fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const path = `properties/${property.id}/feedback/${feedbackId}`;
  const cleanReasons = payload.reasons
    .map((r) => r.trim().slice(0, 60))
    .filter((r) => r.length > 0)
    .slice(0, 7);

  if (cleanReasons.length === 0) {
    throw new Error('Please select at least one reason.');
  }

  try {
    await setDoc(doc(db, 'properties', property.id, 'feedback', feedbackId), {
      propertyId: property.id,
      propertyOwnerId: property.ownerId,
      tenantId: user.uid,
      reasons: cleanReasons,
      comment: payload.comment.trim().slice(0, 400),
      suggestedRent: clampNumber(Math.round(payload.suggestedRent || 0), 0, 500000),
      status: 'new' as FeedbackStatus,
      ownerActionNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return feedbackId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function resolvePropertyFeedback(
  propertyId: string,
  feedbackId: string,
  status: 'acknowledged' | 'resolved',
  ownerActionNote: string
): Promise<void> {
  const path = `properties/${propertyId}/feedback/${feedbackId}`;
  try {
    await updateDoc(doc(db, 'properties', propertyId, 'feedback', feedbackId), {
      status,
      ownerActionNote: ownerActionNote.trim().slice(0, 250),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitPropertyInquiry(
  user: User,
  property: PropertyListing,
  payload: {
    tenantName: string;
    familySize: number;
    tenantType: string;
    message: string;
  }
): Promise<string> {
  const inquiryId = sanitizeId(`inq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const path = `properties/${property.id}/inquiries/${inquiryId}`;
  try {
    await setDoc(doc(db, 'properties', property.id, 'inquiries', inquiryId), {
      propertyId: property.id,
      propertyOwnerId: property.ownerId,
      tenantId: user.uid,
      tenantName: (payload.tenantName || user.displayName || 'Tenant').trim().slice(0, 80),
      familySize: clampNumber(Math.round(payload.familySize), 1, 20),
      tenantType: payload.tenantType.trim().slice(0, 40),
      message: payload.message.trim().slice(0, 400),
      status: 'pending' as InquiryStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return inquiryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateInquiryStatus(
  propertyId: string,
  inquiryId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  const path = `properties/${propertyId}/inquiries/${inquiryId}`;
  try {
    await updateDoc(doc(db, 'properties', propertyId, 'inquiries', inquiryId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserProfile(
  user: User,
  updates: { displayName: string; preferredUnit: AreaUnit; city: string }
): Promise<void> {
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}`;
  await ensureUserProfile(user, updates.preferredUnit);
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: (updates.displayName || user.displayName || 'GharSetu Member')
        .trim()
        .slice(0, 100),
      preferredUnit: updates.preferredUnit,
      city: updates.city.trim().slice(0, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function savePropertyBookmark(
  user: User,
  property: PropertyListing
): Promise<void> {
  const uid = sanitizeId(user.uid);
  const propId = sanitizeId(property.id);
  const path = `users/${uid}/savedListings/${propId}`;

  await ensureUserProfile(user);

  const safeRent = clampNumber(Math.round(property.monthlyRent), 1000, 500000);
  const safeTitle = (property.title || 'Rental Home').trim().slice(0, 120) || 'Rental Home';
  const safeArea =
    `${property.area}, ${property.city}`.trim().slice(0, 140) || 'India';

  try {
    await setDoc(doc(db, 'users', uid, 'savedListings', propId), {
      userId: uid,
      propertyId: propId,
      propertyTitle: safeTitle,
      propertyArea: safeArea,
      savedRent: safeRent,
      lastSeenRent: safeRent,
      savedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removePropertyBookmark(
  user: User,
  propertyId: string
): Promise<void> {
  const uid = sanitizeId(user.uid);
  const propId = sanitizeId(propertyId);
  const path = `users/${uid}/savedListings/${propId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'savedListings', propId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function acknowledgeRentChange(
  user: User,
  propertyId: string,
  currentRent: number,
  propertyTitle: string,
  propertyArea: string
): Promise<void> {
  const uid = sanitizeId(user.uid);
  const propId = sanitizeId(propertyId);
  const path = `users/${uid}/savedListings/${propId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'savedListings', propId), {
      lastSeenRent: clampNumber(Math.round(currentRent), 1000, 500000),
      propertyTitle: propertyTitle.trim().slice(0, 120) || 'Rental Home',
      propertyArea: propertyArea.trim().slice(0, 140) || 'India',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export { collection, doc, query, where } from 'firebase/firestore';
