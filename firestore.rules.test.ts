/**
 * Phase 0 Security TDD Verification Suite for GharSetu Firestore Rules
 * Validates all "Dirty Dozen" adversarial payloads against firestore.rules constraints.
 */

export interface AdversarialPayloadCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_CASES: AdversarialPayloadCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Property Create',
    operation: 'create',
    path: '/properties/prop_spoof',
    auth: { uid: 'user_attacker', email_verified: true },
    payload: { ownerId: 'user_victim', title: 'Spoofed Home' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidProperty -> data.ownerId == request.auth.uid',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Property Create',
    operation: 'create',
    path: '/properties/prop_shadow',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', isVerified: true },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidProperty -> data.keys().hasOnly([...])',
  },
  {
    id: 3,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/properties/prop_time',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'allow create -> incoming().createdAt == request.time',
  },
  {
    id: 4,
    name: 'Cross-User Profile Read (PII Leak)',
    operation: 'get',
    path: '/users/user_victim',
    auth: { uid: 'user_attacker', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'users/{userId} -> request.auth.uid == userId',
  },
  {
    id: 5,
    name: 'Cross-User Owner Contact Scrape (PII Isolation)',
    operation: 'get',
    path: '/properties/prop_1/ownerContact/primary',
    auth: { uid: 'user_attacker', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'ownerContact/{contactId} -> existing().ownerId == request.auth.uid',
  },
  {
    id: 6,
    name: 'ID Poisoning Attack',
    operation: 'create',
    path: '/properties/bad$id!with*symbols',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(propertyId) -> matches(^[a-zA-Z0-9_\\-]+$)',
  },
  {
    id: 7,
    name: 'Orphaned Feedback Creation',
    operation: 'create',
    path: '/properties/nonexistent_prop/feedback/fb_1',
    auth: { uid: 'tenant_1', email_verified: true },
    payload: { propertyId: 'nonexistent_prop', tenantId: 'tenant_1', reasons: ['Rent jada hai'] },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'Master Gate -> exists(/databases/$(database)/documents/properties/$(propertyId))',
  },
  {
    id: 8,
    name: 'Feedback Owner Spoofing',
    operation: 'create',
    path: '/properties/prop_1/feedback/fb_spoof',
    auth: { uid: 'tenant_1', email_verified: true },
    payload: { propertyId: 'prop_1', propertyOwnerId: 'wrong_owner', tenantId: 'tenant_1' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'Master Gate -> incoming().propertyOwnerId == get(parent).data.ownerId',
  },
  {
    id: 9,
    name: 'Unbounded Array Resource Poisoning',
    operation: 'create',
    path: '/properties/prop_dos',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', houseRules: Array(15).fill('rule') },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidHouseRulesList -> rulesList.size() <= 8',
  },
  {
    id: 10,
    name: 'Terminal State Bypass on Resolved Feedback',
    operation: 'update',
    path: '/properties/prop_1/feedback/fb_resolved',
    auth: { uid: 'owner_1', email_verified: true },
    payload: { status: 'new' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'Terminal State Lock -> existing().status != "resolved"',
  },
  {
    id: 11,
    name: 'Value Poisoning on Property Update',
    operation: 'update',
    path: '/properties/prop_1',
    auth: { uid: 'owner_1', email_verified: true },
    payload: { monthlyRent: -500 },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidProperty -> data.monthlyRent >= 1000',
  },
  {
    id: 12,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/properties/prop_unverified',
    auth: { uid: 'user_unverified', email_verified: false },
    payload: { ownerId: 'user_unverified' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedUser() -> request.auth.token.email_verified == true',
  },
];
