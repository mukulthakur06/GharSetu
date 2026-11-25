# GharSetu Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **User Isolation**: `/users/{userId}` can only be read or written by the authenticated user where `request.auth.uid == userId`. No role or admin fields may be self-assigned.
2. **Property Ownership**: Only verified authenticated users may create `/properties/{propertyId}` with `ownerId == request.auth.uid` and `createdAt == request.time`. Only the owner may update or delete their property. `ownerId` and `createdAt` are immutable.
3. **Public Listing Visibility Boundary**: `get` and `list` on `/properties` only return documents where `resource.data.isPublished == true` or `resource.data.ownerId == request.auth.uid`. No blanket `allow list: if isSignedIn()` exists.
4. **PII Isolation**: Sensitive owner phone numbers reside exclusively in `/properties/{propertyId}/ownerContact/{contactId}`, accessible ONLY to the property owner (`ownerId == request.auth.uid`), preventing cross-user scraping.
5. **Relational Master Gate on Subcollections**: Feedback (`/feedback/{feedbackId}`) and Inquiries (`/inquiries/{inquiryId}`) require an existing parent `/properties/{propertyId}` document on create, and `propertyOwnerId` MUST equal the parent property's `ownerId`.
6. **Feedback Privacy & Terminal Locking**: Only the property owner (`propertyOwnerId == request.auth.uid`) or the submitting tenant (`tenantId == request.auth.uid`) may read or list feedback. Only the property owner may update `status` and `ownerActionNote`, and once `status == 'resolved'`, no further mutations are permitted.
7. **Inquiry Privacy & Terminal Locking**: Only the property owner or submitting tenant may read/list inquiries. Once an inquiry reaches `'accepted'` or `'declined'`, no further mutations are permitted.
8. **Saved Listings Privacy & Rent Baseline Integrity**: `/users/{userId}/savedListings/{propertyId}` is strictly isolated to `request.auth.uid == userId` (verified on `get`, `list`, `create`, `update`, and `delete`). `savedRent` and `savedAt` are immutable after creation; only `lastSeenRent` (to acknowledge price alerts) and display metadata may be updated.

## 2. The Dirty Dozen Adversarial Payloads
1. **Identity Spoofing on Property Create**: Authenticated user `u1` creates `/properties/prop1` with `ownerId: "u2"`. Expected: `PERMISSION_DENIED`.
2. **Shadow Field Injection on Property Create**: User `u1` includes `"isVerified": true` or `"isFeatured": true` on `/properties/prop1`. Expected: `PERMISSION_DENIED`.
3. **Client Timestamp Forgery**: User `u1` creates `/properties/prop1` with a past `createdAt` instead of `serverTimestamp()`. Expected: `PERMISSION_DENIED`.
4. **Cross-User Profile Read (PII Leak)**: User `u1` attempts `get` on `/users/u2`. Expected: `PERMISSION_DENIED`.
5. **Cross-User Owner Contact Scrape (PII Isolation)**: User `u2` attempts `get` on `/properties/prop1/ownerContact/primary` owned by `u1`. Expected: `PERMISSION_DENIED`.
6. **ID Poisoning Attack**: User `u1` attempts create on `/properties/bad$id!with*symbols`. Expected: `PERMISSION_DENIED`.
7. **Orphaned Feedback Creation**: User `u2` creates `/properties/nonexistent_prop/feedback/fb1`. Expected: `PERMISSION_DENIED`.
8. **Feedback Owner Spoofing**: User `u2` creates feedback under `prop1` (owned by `u1`) with `propertyOwnerId: "u3"`. Expected: `PERMISSION_DENIED`.
9. **Unbounded Array / Resource Poisoning**: User `u1` creates a property with 15 `houseRules` entries (max 8) or a 2000-char `title`. Expected: `PERMISSION_DENIED`.
10. **Terminal State Bypass on Feedback**: Owner `u1` attempts to modify a feedback item whose `status` is already `'resolved'`. Expected: `PERMISSION_DENIED`.
11. **Value Poisoning on Update**: Owner `u1` updates `monthlyRent` on `/properties/prop1` to `"free"` (string instead of number) or `-500`. Expected: `PERMISSION_DENIED`.
12. **Unverified Email Write**: User with `email_verified: false` attempts to create a property or feedback. Expected: `PERMISSION_DENIED`.
