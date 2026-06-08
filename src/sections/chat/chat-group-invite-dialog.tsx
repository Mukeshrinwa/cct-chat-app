import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';

import { joinGroupByLink } from 'src/actions/group';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { JwtSignInView } from 'src/sections/auth/jwt/jwt-sign-in-view';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  inviteCode: string;
};

export function ChatGroupInviteDialog({ open, onClose, inviteCode }: Props) {
  const { user } = useMockedUser();
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode) return;
    
    if (!user) {
      toast.error('You must be logged in to join a group');
      setShowLogin(true);
      return;
    }

    try {
      setLoading(true);
      const inviteUrl = `${window.location.origin}/group/invite/${inviteCode}`;
      const res = await joinGroupByLink(inviteUrl);
      
      if (res?.status === 'pending' || res?.message?.toLowerCase().includes('request') || res?.data?.needsApproval || res?.needsApproval) {
        toast.success('Join request sent to group admins for approval.');
      } else {
        toast.success('Successfully joined the group!');
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || error.error || 'Failed to join group or request already sent.');
    } finally {
      setLoading(false);
    }
  };

  if (showLogin) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogContent sx={{ p: 4, pt: 5 }}>
          <JwtSignInView />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogContent sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Iconify icon="solar:users-group-two-rounded-bold-duotone" width={64} sx={{ color: 'primary.main', mb: 2 }} />
        
        <Typography variant="h5" gutterBottom>
          Group Invitation
        </Typography>
        
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          You have been invited to join a group. Would you like to join?
        </Typography>

        <Stack spacing={2} sx={{ width: 1 }}>
          <LoadingButton
            fullWidth
            size="large"
            variant="contained"
            loading={loading}
            onClick={handleJoin}
          >
            Join Group
          </LoadingButton>

          <Button
            fullWidth
            size="large"
            color="inherit"
            onClick={onClose}
          >
            Cancel
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
