import { User } from '@prisma/client';

/**
 * What the API returns about the signed-in account. One definition, used by auth and users,
 * so a new column never leaks through one of them by accident.
 */
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    role: user.role,
    doctorStatus: user.doctorStatus,
    licenseNumber: user.licenseNumber,
    hospital: user.hospital,
    doctorReviewNote: user.doctorReviewNote,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}
