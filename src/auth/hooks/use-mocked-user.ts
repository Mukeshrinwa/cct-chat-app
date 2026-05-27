import { useAuthContext } from './use-auth-context';

// ----------------------------------------------------------------------

/**
 * This hook was originally returning hardcoded mock data.
 * It now returns the real authenticated user from AuthContext,
 * mapping API fields to the field names used across the app.
 */
export function useMockedUser() {
  const { user: authUser } = useAuthContext();

  const user = authUser
    ? {
        id: authUser._id || authUser.id,
        displayName: authUser.name || authUser.displayName || '',
        email: authUser.email || authUser.mobile || '',
        photoURL: authUser.avatar || authUser.photoURL || '',
        phoneNumber: authUser.mobile || authUser.phoneNumber || '',
        country: authUser.country || '',
        address: authUser.address || '',
        state: authUser.state || '',
        city: authUser.city || '',
        zipCode: authUser.zipCode || '',
        about: authUser.about || '',
        role: authUser.role || 'user',
        isPublic: true,
      }
    : null;

  return { user };
}
