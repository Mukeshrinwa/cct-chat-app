import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';

import { joinGroupByLink } from 'src/actions/group';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { JwtSignInView } from 'src/sections/auth/jwt/jwt-sign-in-view';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export default function GroupInvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useMockedUser();
  const [loading, setLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (user && loginOpen) {
      setLoginOpen(false);
      // Auto join once logged in
      handleJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loginOpen]);

  const handleJoin = async () => {
    if (!code) return;
    
    if (!user) {
      toast.error('You must be logged in to join a group');
      setLoginOpen(true);
      return;
    }

    try {
      setLoading(true);
      const inviteUrl = `${window.location.origin}/group/invite/${code}`;
      const res = await joinGroupByLink(inviteUrl);
      
      if (res?.status === 'pending' || res?.message?.toLowerCase().includes('request') || res?.data?.needsApproval || res?.needsApproval) {
        toast.success('Join request sent to group admins for approval.');
      } else {
        toast.success('Successfully joined the group!');
      }
      navigate(paths.dashboard.chat);
    } catch (error: any) {
      toast.error(error.message || error.error || 'Failed to join group or request already sent.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title> Join Group Invite </title>
      </Helmet>

      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Card
            sx={{
              p: 4,
              width: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
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
                type="submit"
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
                onClick={() => navigate(paths.dashboard.chat)}
              >
                Cancel
              </Button>
            </Stack>
          </Card>
        </Box>
      </Container>

      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ p: 4, pt: 5 }}>
          <JwtSignInView />
        </DialogContent>
      </Dialog>
    </>
  );
}
