import type { ButtonProps } from '@mui/material/Button';
import type { Theme, SxProps } from '@mui/material/styles';

import { useCallback } from 'react';

import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';

import { toast } from 'src/components/snackbar';

import { signOut as jwtSignOut } from 'src/auth/context/jwt/action';

// ----------------------------------------------------------------------

type Props = ButtonProps & {
  sx?: SxProps<Theme>;
  onClose?: () => void;
};

export function SignOutButton({ onClose, ...other }: Props) {
  const handleLogout = useCallback(async () => {
    try {
      await jwtSignOut();

      onClose?.();

      // Hard redirect to sign-in page to ensure full state reset
      window.location.href = paths.auth.jwt.signIn;
    } catch (error) {
      console.error(error);
      toast.error('Unable to logout!');
    }
  }, [onClose]);

  return (
    <Button
      fullWidth
      variant="soft"
      size="large"
      color="error"
      onClick={handleLogout}
      {...other}
    >
      Logout
    </Button>
  );
}
