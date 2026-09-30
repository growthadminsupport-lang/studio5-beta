import { ChildRole } from '@prisma/client';

/**
 * What each role may do for one child. docs/user-flows.md §2 is the human-readable version of
 * this table; the two must say the same thing.
 *
 * Roles live on the link between a person and a child (ChildGuardian.role), so the same
 * account can be a parent of one child and a caretaker of another. A DOCTOR link only counts
 * while the account is an approved doctor: see ChildrenService.access.
 */
export const CAPABILITIES = {
  /** See the child's profile. */
  'child.read': ['PARENT', 'CARETAKER', 'DOCTOR'],
  /** Edit name, sex, date of birth, photo. */
  'child.edit': ['PARENT'],
  /** Set the hospital number. The doctor is often the one who knows it. */
  'child.setHn': ['PARENT', 'DOCTOR'],
  /** See the hospital number. Caretakers have no use for a medical identifier. */
  'child.readHn': ['PARENT', 'DOCTOR'],
  'child.delete': ['PARENT'],
  /** Invite caretakers and doctors, list and remove members. */
  'members.manage': ['PARENT'],
  'growth.read': ['PARENT', 'CARETAKER', 'DOCTOR'],
  'growth.write': ['PARENT', 'CARETAKER', 'DOCTOR'],
  'puberty.submit': ['PARENT', 'CARETAKER', 'DOCTOR'],
  /** The screening outcome, past results and the follow-up plan. */
  'puberty.result': ['PARENT', 'DOCTOR'],
  /** Upload an X-ray, run the model, review and edit the record, delete it. */
  'boneAge.write': ['DOCTOR'],
  /** The model's estimate in months, the X-ray itself, failed and unreviewed records. */
  'boneAge.full': ['DOCTOR'],
  /** The doctor's review only: exam date, Normal / Advanced / Delayed, note. */
  'boneAge.status': ['PARENT', 'CARETAKER', 'DOCTOR'],
} as const satisfies Record<string, readonly ChildRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: ChildRole, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly ChildRole[]).includes(role);
}

/** The caller's standing on one child, as returned by ChildrenService.access. */
export interface ChildAccess {
  childId: string;
  userId: string;
  role: ChildRole;
  can: (capability: Capability) => boolean;
}
