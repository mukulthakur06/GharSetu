export type AreaUnit = 'gaj' | 'sqft';
export type LanguageMode = 'hinglish' | 'english';

export type BhkType = '1 RK' | '1 BHK' | '2 BHK' | '3 BHK' | '4+ BHK';
export type FloorType =
  | 'Ground Floor'
  | '1st Floor'
  | '2nd Floor'
  | '3rd Floor+'
  | 'Independent Duplex';
export type FurnishingType = 'Unfurnished' | 'Semi-Furnished' | 'Fully Furnished';
export type PaintConditionType = 'Freshly Painted' | 'Well Maintained' | 'Needs Touch-up';
export type PreferredTenantType =
  | 'Small Family'
  | 'Joint Family'
  | 'Working Professionals'
  | 'Students'
  | 'Anyone';

export type PropertyStatus = 'available' | 'rented';
export type FeedbackStatus = 'new' | 'acknowledged' | 'resolved';
export type InquiryStatus = 'pending' | 'accepted' | 'declined';

export interface PropertyListing {
  id: string;
  ownerId: string;
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
  status: PropertyStatus;
  isPublished: boolean;
  createdAt?: number;
  updatedAt?: number;
  /** True for local showcase items before cloud publish */
  isShowcase?: boolean;
  /** Public visiting note for showcase or owner */
  visitingHours?: string;
}

export interface OwnerContactInfo {
  propertyId: string;
  ownerId: string;
  contactPhone: string;
  visitingHours: string;
}

export interface PropertyFeedback {
  id: string;
  propertyId: string;
  propertyOwnerId: string;
  tenantId: string;
  reasons: string[];
  comment: string;
  suggestedRent: number;
  status: FeedbackStatus;
  ownerActionNote: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface PropertyInquiry {
  id: string;
  propertyId: string;
  propertyOwnerId: string;
  tenantId: string;
  tenantName: string;
  familySize: number;
  tenantType: string;
  message: string;
  status: InquiryStatus;
  createdAt?: number;
  updatedAt?: number;
}

export interface SavedListingRecord {
  propertyId: string;
  userId: string;
  propertyTitle: string;
  propertyArea: string;
  /** Monthly rent when the user originally bookmarked the property */
  savedRent: number;
  /** Monthly rent the user last acknowledged (alerts fire when live rent !== lastSeenRent) */
  lastSeenRent: number;
  savedAt?: number;
  updatedAt?: number;
}

export interface UserProfileData {
  uid: string;
  displayName: string;
  preferredUnit: AreaUnit;
  city: string;
}

export interface NeighborhoodPlaceLink {
  title: string;
  uri: string;
  reviewSnippets: string[];
}

export interface NeighborhoodInsightsResult {
  summary: string;
  places: NeighborhoodPlaceLink[];
}

export interface SearchCenter {
  label: string;
  lat: number;
  lng: number;
}

export interface SearchFilters {
  radiusKm: number;
  maxBudget: number;
  minGaj: number;
  bhkType: BhkType | 'All';
  floor: FloorType | 'All';
  furnishing: FurnishingType | 'All';
  preferredTenant: PreferredTenantType | 'All';
}

export const BHK_OPTIONS: BhkType[] = ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4+ BHK'];

export const FLOOR_OPTIONS: FloorType[] = [
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor+',
  'Independent Duplex',
];

export const FURNISHING_OPTIONS: FurnishingType[] = [
  'Unfurnished',
  'Semi-Furnished',
  'Fully Furnished',
];

export const PAINT_OPTIONS: PaintConditionType[] = [
  'Freshly Painted',
  'Well Maintained',
  'Needs Touch-up',
];

export const TENANT_PREF_OPTIONS: PreferredTenantType[] = [
  'Small Family',
  'Joint Family',
  'Working Professionals',
  'Students',
  'Anyone',
];

export interface BilingualOption {
  id: string;
  en: string;
  hi: string;
}

export const HOUSE_RULE_PRESETS: BilingualOption[] = [
  {
    id: 'Saaf-safai ka dhyaan rakhein',
    en: 'Maintain cleanliness & hygiene',
    hi: 'Saaf-safai ka dhyaan rakhein',
  },
  {
    id: 'Jada shor na machayein',
    en: 'Peaceful & low noise',
    hi: 'Jada shor na machayein',
  },
  {
    id: 'Time par rent dein',
    en: 'Punctual rent by 5th of every month',
    hi: 'Har mahine time par rent dein',
  },
  {
    id: 'No smoking or alcohol',
    en: 'No smoking or alcohol on premises',
    hi: 'Smoking / alcohol mana hai',
  },
  {
    id: 'Vegetarian family preferred',
    en: 'Vegetarian household preferred',
    hi: 'Vegetarian family ko priority',
  },
  {
    id: 'Small quiet family',
    en: 'Quiet, settled household preferred',
    hi: 'Shaant aur chhoti family chahiye',
  },
  {
    id: 'No pets allowed',
    en: 'No pets allowed inside',
    hi: 'Pets allowed nahi hain',
  },
  {
    id: 'Proper police verification',
    en: 'ID & tenant verification required',
    hi: 'ID aur police verification zaroori',
  },
];

export const FEEDBACK_REASON_OPTIONS: BilingualOption[] = [
  {
    id: 'Rent jada hai',
    en: 'Rent is too high',
    hi: 'Rent jada lag raha hai',
  },
  {
    id: 'Area / Gaj kam hai',
    en: 'Area / Gaj feels too small',
    hi: 'Area / Gaj kam hai',
  },
  {
    id: 'Furnished nahi hai',
    en: 'Not furnished enough',
    hi: 'Furnished nahi hai',
  },
  {
    id: 'Paint / maintenance issue',
    en: 'Needs fresh paint or upkeep',
    hi: 'Paint ya safai sahi nahi hai',
  },
  {
    id: 'Floor pasand nahi aaya',
    en: 'Floor does not suit us',
    hi: 'Floor pasand nahi aaya',
  },
  {
    id: 'Owner rules strict hain',
    en: 'Owner preferences too strict',
    hi: 'Owner ki conditions strict hain',
  },
  {
    id: 'Location / parking issue',
    en: 'Location or parking concern',
    hi: 'Location ya parking ki dikkat',
  },
];

export const PRESET_LOCATIONS: SearchCenter[] = [
  { label: 'Noida Sector 62, UP', lat: 28.6279, lng: 77.3649 },
  { label: 'Indirapuram, Ghaziabad', lat: 28.6415, lng: 77.3714 },
  { label: 'Mayur Vihar, Delhi', lat: 28.6096, lng: 77.2951 },
  { label: 'DLF Phase 3, Gurugram', lat: 28.4945, lng: 77.0942 },
  { label: 'Dwarka Sector 12, Delhi', lat: 28.5921, lng: 77.046 },
  { label: 'Malviya Nagar, Jaipur', lat: 26.8549, lng: 75.8243 },
];

export const INDIAN_STATES = [
  'Uttar Pradesh',
  'Delhi',
  'Haryana',
  'Rajasthan',
  'Maharashtra',
  'Karnataka',
  'Punjab',
  'Chandigarh',
  'Gujarat',
  'Madhya Pradesh',
  'Uttarakhand',
  'Telangana',
  'Tamil Nadu',
  'West Bengal',
  'Bihar',
];

export const GENERATED_PROPERTY_PHOTOS = [
  {
    label: 'Modern 2 BHK Living Room',
    url: '/src/assets/images/home_modern_2bhk_1795192694571.jpg',
  },
  {
    label: 'Independent Ground Floor',
    url: '/src/assets/images/home_independent_floor_1795192763269.jpg',
  },
  {
    label: 'Spacious 3 BHK Family Flat',
    url: '/src/assets/images/home_family_3bhk_1795192703367.jpg',
  },
  {
    label: 'Bright 1 BHK Apartment',
    url: '/src/assets/images/home_compact_1bhk_1795192689856.jpg',
  },
  {
    label: '200 Gaj Independent Duplex',
    url: '/src/assets/images/home_villa_200gaj_1795192692563.jpg',
  },
];
