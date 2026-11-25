import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  ImagePlus,
  LogIn,
  MapPin,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  BHK_OPTIONS,
  FLOOR_OPTIONS,
  FURNISHING_OPTIONS,
  GENERATED_PROPERTY_PHOTOS,
  HOUSE_RULE_PRESETS,
  INDIAN_STATES,
  PAINT_OPTIONS,
  PRESET_LOCATIONS,
  TENANT_PREF_OPTIONS,
  type BhkType,
  type FloorType,
  type FurnishingType,
  type LanguageMode,
  type PaintConditionType,
  type PreferredTenantType,
  type PropertyListing,
  type SearchCenter,
} from '../types/rental';
import {
  compressImageToDataUrl,
  formatINR,
  gajToSqft,
  sqftToGaj,
} from '../lib/geo';
import {
  createPropertyListing,
  updatePropertyListing,
} from '../lib/firebase';
import { PlacesSearchInput } from './PlacesSearchInput';

interface ListPropertyViewProps {
  user: User | null;
  language: LanguageMode;
  editingProperty?: PropertyListing | null;
  onRequestSignIn: () => Promise<User | null>;
  onSaved: (propertyId: string, isEdit: boolean) => void;
  onCancel: () => void;
}

export const ListPropertyView: React.FC<ListPropertyViewProps> = ({
  user,
  language,
  editingProperty = null,
  onRequestSignIn,
  onSaved,
  onCancel,
}) => {
  const isEditing = Boolean(editingProperty);

  const [ownerName, setOwnerName] = useState(
    editingProperty?.ownerName || user?.displayName || ''
  );
  const [contactPhone, setContactPhone] = useState('+91 98110 45210');
  const [visitingHours, setVisitingHours] = useState(
    editingProperty?.visitingHours || '10:00 AM – 7:00 PM'
  );
  const [title, setTitle] = useState(editingProperty?.title || '');
  const [description, setDescription] = useState(
    editingProperty?.description || ''
  );
  const [bhkType, setBhkType] = useState<BhkType>(
    editingProperty?.bhkType || '2 BHK'
  );
  const [rooms, setRooms] = useState<number>(editingProperty?.rooms || 2);
  const [floor, setFloor] = useState<FloorType>(
    editingProperty?.floor || '1st Floor'
  );
  const [areaGaj, setAreaGaj] = useState<number>(
    editingProperty?.areaGaj || 120
  );
  const [areaSqft, setAreaSqft] = useState<number>(
    editingProperty?.areaSqft || 1080
  );
  const [monthlyRent, setMonthlyRent] = useState<number>(
    editingProperty?.monthlyRent || 15000
  );
  const [securityDeposit, setSecurityDeposit] = useState<number>(
    editingProperty?.securityDeposit || 15000
  );
  const [negotiable, setNegotiable] = useState<boolean>(
    editingProperty?.negotiable ?? true
  );
  const [furnishing, setFurnishing] = useState<FurnishingType>(
    editingProperty?.furnishing || 'Semi-Furnished'
  );
  const [paintCondition, setPaintCondition] = useState<PaintConditionType>(
    editingProperty?.paintCondition || 'Freshly Painted'
  );
  const [preferredTenant, setPreferredTenant] = useState<PreferredTenantType>(
    editingProperty?.preferredTenant || 'Small Family'
  );
  const [maxOccupants, setMaxOccupants] = useState<number>(
    editingProperty?.maxOccupants || 4
  );
  const [houseRules, setHouseRules] = useState<string[]>(
    editingProperty?.houseRules || [
      'Saaf-safai ka dhyaan rakhein',
      'Jada shor na machayein',
      'Time par rent dein',
    ]
  );
  const [ownerPreferenceNote, setOwnerPreferenceNote] = useState(
    editingProperty?.ownerPreferenceNote ||
      'Shaant aur safai pasand family chahiye jo har mahine time par rent de.'
  );

  const [stateName, setStateName] = useState(
    editingProperty?.state || 'Uttar Pradesh'
  );
  const [city, setCity] = useState(editingProperty?.city || 'Noida');
  const [area, setArea] = useState(
    editingProperty?.area || 'Sector 62, Block C'
  );
  const [addressLine, setAddressLine] = useState(
    editingProperty?.addressLine || ''
  );
  const [mapPin, setMapPin] = useState<SearchCenter>({
    label: editingProperty
      ? `${editingProperty.area}, ${editingProperty.city}`
      : PRESET_LOCATIONS[0].label,
    lat: editingProperty?.lat || PRESET_LOCATIONS[0].lat,
    lng: editingProperty?.lng || PRESET_LOCATIONS[0].lng,
  });

  const [photoUrl, setPhotoUrl] = useState<string>(
    editingProperty?.photoUrl || GENERATED_PROPERTY_PHOTOS[0].url
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGajChange = (val: string) => {
    const num = Number(val) || 0;
    setAreaGaj(num);
    setAreaSqft(gajToSqft(num));
  };

  const handleSqftChange = (val: string) => {
    const num = Number(val) || 0;
    setAreaSqft(num);
    setAreaGaj(sqftToGaj(num));
  };

  const toggleRule = (ruleId: string) => {
    setHouseRules((prev) =>
      prev.includes(ruleId)
        ? prev.filter((item) => item !== ruleId)
        : prev.length < 8
          ? [...prev, ruleId]
          : prev
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setErrorMsg(null);
    try {
      const compressed = await compressImageToDataUrl(file);
      setPhotoUrl(compressed);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Photo upload failed.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (title.trim().length < 4) {
      setErrorMsg('Please enter a clear property title (at least 4 characters).');
      return;
    }
    if (areaGaj < 10) {
      setErrorMsg('Please enter a valid area (minimum 10 Gaj / 90 sq.ft).');
      return;
    }
    if (monthlyRent < 1000) {
      setErrorMsg('Please enter a valid monthly rent (minimum ₹1,000).');
      return;
    }
    if (!isEditing && addressLine.trim().length < 4) {
      setErrorMsg('Please enter the proper house address / sector landmark.');
      return;
    }

    let activeUser = user;
    if (!activeUser) {
      activeUser = await onRequestSignIn();
      if (!activeUser) return;
    }

    setSubmitting(true);
    try {
      if (isEditing && editingProperty) {
        await updatePropertyListing(editingProperty.id, {
          title: title.trim(),
          description: description.trim(),
          areaGaj,
          areaSqft,
          monthlyRent,
          securityDeposit,
          negotiable,
          furnishing,
          paintCondition,
          preferredTenant,
          maxOccupants,
          houseRules,
          ownerPreferenceNote: ownerPreferenceNote.trim(),
        });
        onSaved(editingProperty.id, true);
      } else {
        const newId = await createPropertyListing(activeUser, {
          ownerName: ownerName.trim() || activeUser.displayName || 'Property Owner',
          title: title.trim(),
          description: description.trim(),
          rooms,
          bhkType,
          floor,
          areaGaj,
          areaSqft,
          monthlyRent,
          securityDeposit,
          negotiable,
          furnishing,
          paintCondition,
          preferredTenant,
          maxOccupants,
          houseRules,
          ownerPreferenceNote: ownerPreferenceNote.trim(),
          state: stateName,
          city: city.trim(),
          area: area.trim(),
          addressLine: addressLine.trim(),
          lat: mapPin.lat,
          lng: mapPin.lng,
          photoUrl,
          contactPhone: contactPhone.trim(),
          visitingHours: visitingHours.trim(),
        });
        onSaved(newId, false);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save listing.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-teal-800">
            {isEditing
              ? language === 'hinglish'
                ? 'Apna Ghar Update Karein'
                : 'Update Your Rental Listing'
              : language === 'hinglish'
                ? 'Direct Owner Listing · Zero Brokerage'
                : 'Direct Owner Listing · Zero Brokerage'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 text-balance">
            {isEditing
              ? `Edit: ${editingProperty?.title}`
              : language === 'hinglish'
                ? 'Apna Ghar Rent Par Dein'
                : 'List Your House for Rent'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {language === 'hinglish'
              ? 'Ghar ki photo, rooms, Gaj/Sq.Ft area, floor, rent, proper address aur apni family preferences add karein.'
              : 'Add photos, rooms, Gaj/Sq.Ft area, floor, monthly rent, address, and preferred family rules.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg bg-white transition-colors self-start sm:self-auto"
        >
          Cancel
        </button>
      </div>

      {!user && (
        <div className="mt-6 bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-slate-700">
            {language === 'hinglish'
              ? 'Listing publish karne aur tenant feedback paane ke liye Google se sign in karein.'
              : 'Sign in with Google to publish your house listing and receive live tenant feedback.'}
          </div>
          <button
            type="button"
            onClick={() => void onRequestSignIn()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In with Google</span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-10">
        {/* Section 01: Photos & Room Specs */}
        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              01. {language === 'hinglish' ? 'Ghar ki Photo aur Basic Details' : 'Property Photo & Room Specifications'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hinglish'
                ? 'Apne mobile/laptop se photo upload karein ya sample architectural photo chunein.'
                : 'Upload a real photo from your device or choose a clean sample photo.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            <div className="md:col-span-5 space-y-3">
              <div className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={photoUrl}
                  alt="Property preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:border-teal-700 hover:text-teal-900 rounded-lg cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>
                  {uploadingPhoto
                    ? 'Optimizing photo...'
                    : language === 'hinglish'
                      ? 'Device se Ghar ki Photo Upload Karein'
                      : 'Upload House Photo from Device'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Or choose a quick architectural photo:</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {GENERATED_PROPERTY_PHOTOS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setPhotoUrl(preset.url)}
                      title={preset.label}
                      className={`aspect-[4/3] rounded-md overflow-hidden border-2 transition-all ${
                        photoUrl === preset.url
                          ? 'border-teal-700 ring-1 ring-teal-700/30'
                          : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {language === 'hinglish' ? 'Listing Title (Ghar ka Heading)' : 'Listing Title'} *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Spacious 2 BHK First Floor Family Home with Balcony"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    BHK Type
                  </label>
                  <select
                    value={bhkType}
                    onChange={(e) => {
                      const val = e.target.value as BhkType;
                      setBhkType(val);
                      const roomMap: Record<BhkType, number> = {
                        '1 RK': 1,
                        '1 BHK': 1,
                        '2 BHK': 2,
                        '3 BHK': 3,
                        '4+ BHK': 4,
                      };
                      setRooms(roomMap[val]);
                    }}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  >
                    {BHK_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {language === 'hinglish' ? 'Total Rooms' : 'Total Rooms'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={rooms}
                    onChange={(e) => setRooms(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {language === 'hinglish' ? 'Floor' : 'Floor Level'}
                  </label>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(e.target.value as FloorType)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  >
                    {FLOOR_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Furnishing Status
                  </label>
                  <select
                    value={furnishing}
                    onChange={(e) => setFurnishing(e.target.value as FurnishingType)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  >
                    {FURNISHING_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {language === 'hinglish' ? 'Paint & Maintenance' : 'Paint & Upkeep'}
                  </label>
                  <select
                    value={paintCondition}
                    onChange={(e) =>
                      setPaintCondition(e.target.value as PaintConditionType)
                    }
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                  >
                    {PAINT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {language === 'hinglish'
                    ? 'Ghar ka Description (Parking, Pani, Balcony, Metro distance)'
                    : 'Property Description'}
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe natural sunlight, balcony, water supply, parking, nearby schools or metro..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 resize-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 02: Area in Gaj & Sq. Ft. + Rent */}
        <section className="pt-8 border-t border-slate-200 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              02. {language === 'hinglish' ? 'Area (Gaj aur Sq. Ft.) aur Monthly Rent' : 'Area (Gaj / Sq. Ft.) & Monthly Rent'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hinglish'
                ? 'Gaj ya Square Feet kisi mein bhi daalein — dusri unit apne aap calculate ho jayegi (1 Gaj = 9 sq.ft, example: 200 Gaj = 1,800 sq.ft).'
                : 'Enter either Gaj or Square Feet — both stay synchronized automatically (1 Gaj = 9 sq.ft, e.g. 200 Gaj = 1,800 sq.ft).'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Area in Gaj (गज) *
              </label>
              <input
                type="number"
                min={10}
                max={5000}
                value={areaGaj}
                onChange={(e) => handleGajChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Example: 100 Gaj, 200 Gaj
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Area in Sq. Ft. (स्क्वायर फीट) *
              </label>
              <input
                type="number"
                min={90}
                max={45000}
                value={areaSqft}
                onChange={(e) => handleSqftChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Auto-converted (1 Gaj = 9 sq.ft)
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {language === 'hinglish' ? 'Monthly Rent (₹ / mahina)' : 'Monthly Rent (₹)'} *
              </label>
              <input
                type="number"
                min={1000}
                max={500000}
                step={500}
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
              />
              <span className="text-[11px] text-slate-500 mt-1 block tabular-nums">
                {formatINR(monthlyRent)} / month
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Security Deposit (₹)
              </label>
              <input
                type="number"
                min={0}
                max={2000000}
                step={500}
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
              />
              <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={negotiable}
                  onChange={(e) => setNegotiable(e.target.checked)}
                  className="rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                />
                <span>Rent Negotiable</span>
              </label>
            </div>
          </div>
        </section>

        {/* Section 03: Owner Family & Tenant Preferences */}
        <section className="pt-8 border-t border-slate-200 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-800" />
              <span>
                03.{' '}
                {language === 'hinglish'
                  ? 'Kaise Family / Tenants ko Ghar Dena Hai (Owner Preferences)'
                  : 'Preferred Family & Tenant Rules'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'hinglish'
                ? 'Kitne log reh sakte hain aur saaf-safai, shor, time par rent jaise niyam saaf likh dein.'
                : 'Specify tenant type, maximum occupants, cleanliness, noise, and rent punctuality expectations.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {language === 'hinglish' ? 'Preferred Family / Tenant Type' : 'Preferred Tenant Type'}
              </label>
              <select
                value={preferredTenant}
                onChange={(e) =>
                  setPreferredTenant(e.target.value as PreferredTenantType)
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              >
                {TENANT_PREF_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {language === 'hinglish'
                  ? 'Kitne Logo ko Ghar Rent Par Dena Hai (Max Members)'
                  : 'Maximum Occupants Allowed'}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxOccupants}
                onChange={(e) => setMaxOccupants(Number(e.target.value) || 1)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-700 mb-2">
              {language === 'hinglish'
                ? 'House Rules Select Karein (Jo aapko chahiye)'
                : 'Select House Expectations'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {HOUSE_RULE_PRESETS.map((rule) => {
                const active = houseRules.includes(rule.id);
                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => toggleRule(rule.id)}
                    className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border text-left text-xs font-medium transition-colors ${
                      active
                        ? 'bg-teal-50 border-teal-700 text-teal-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span>{language === 'hinglish' ? rule.hi : rule.en}</span>
                    {active && <Check className="w-3.5 h-3.5 text-teal-800 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {language === 'hinglish'
                ? 'Owner ka Khas Message (e.g. Saaf-safai, Shor, Time par rent)'
                : 'Personal Owner Preference Note'}
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={ownerPreferenceNote}
              onChange={(e) => setOwnerPreferenceNote(e.target.value)}
              placeholder="e.g. Chhoti family jo ghar saaf rakhe, shor na machaye aur har mahine 5 tarikh tak rent de."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 resize-none"
            />
          </div>
        </section>

        {/* Section 04: Location, Proper Address & Contact (only full edit on create) */}
        {!isEditing && (
          <section className="pt-8 border-t border-slate-200 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-800" />
                <span>
                  04.{' '}
                  {language === 'hinglish'
                    ? 'State, City, Area, Proper Address aur Owner Contact'
                    : 'Location, Full Address & Owner Contact'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'hinglish'
                  ? 'Map area chunein taaki 10 km radius search mein aapka ghar sahi jagah dikhe.'
                  : 'Select the map area so tenants searching within 10 km find your home accurately.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Pin Map Area for 10 km Radius Search
              </label>
              <PlacesSearchInput
                value={mapPin}
                onSelectCenter={(center) => {
                  setMapPin(center);
                  const parts = center.label.split(',').map((s) => s.trim());
                  if (parts[0]) setArea(parts[0]);
                  if (parts[1]) setCity(parts[1]);
                }}
                placeholder="Search locality or sector to pin GPS coordinates..."
                compact
              />
              <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                GPS Coordinates: {mapPin.lat.toFixed(4)}, {mapPin.lng.toFixed(4)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  State *
                </label>
                <select
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Noida, Jaipur, Gurugram"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Locality / Area *
                </label>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Sector 62, Shakti Khand 2"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {language === 'hinglish'
                  ? 'Proper Address (House/Plot No., Block, Landmark)'
                  : 'Full Property Address'} *
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="e.g. B-44, Sector 62 Residential Lane, Near Central Park"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Owner Name *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Owner Phone Number (Private Vault) *
                </label>
                <input
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98XXX XXXXX"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Preferred Visiting Hours
                </label>
                <input
                  type="text"
                  value={visitingHours}
                  onChange={(e) => setVisitingHours(e.target.value)}
                  placeholder="10:00 AM – 7:00 PM"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>
          </section>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-60 rounded-lg transition-colors"
          >
            {submitting
              ? 'Saving...'
              : isEditing
                ? language === 'hinglish'
                  ? 'Changes Save Karein'
                  : 'Save Home Improvements'
                : language === 'hinglish'
                  ? 'Ghar Publish Karein'
                  : 'Publish Rental Home'}
          </button>
        </div>
      </form>
    </div>
  );
};
