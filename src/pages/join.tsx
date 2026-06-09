import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';

import { InviteService } from 'src/actions/invite';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { JwtSignInView } from 'src/sections/auth/jwt/jwt-sign-in-view';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get('invite');
  const token = searchParams.get('token') || undefined;

  const navigate = useNavigate();
  const { user } = useMockedUser();

  const [validating, setValidating] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<any>(null);

  useEffect(() => {
    if (!inviteId) {
      setError('Invalid invite link.');
      setValidating(false);
      return;
    }

    const validate = async () => {
      try {
        setValidating(true);
        setError(null);
        const res = await InviteService.validateInvite(inviteId, token);
        setInviteDetails(res);
      } catch (err: any) {
        setError(err.message || err.error || 'This invite link is invalid, expired, or has been revoked.');
      } finally {
        setValidating(false);
      }
    };

    validate();
  }, [inviteId, token]);

  useEffect(() => {
    if (user && loginOpen) {
      setLoginOpen(false);
    }
  }, [user, loginOpen]);

  const handleJoin = async () => {
    if (!inviteId) return;
    
    // Check if the user needs to be logged in for email verification or general join
    if (!user) {
      toast.error('You must be logged in to join.');
      setLoginOpen(true);
      return;
    }

    try {
      setJoining(true);
      setError(null);
      await InviteService.acceptInvite(inviteId, token);
      
      toast.success('Successfully joined the group!');
      if (inviteDetails?.redirectUrl) {
        window.location.href = inviteDetails.redirectUrl;
      } else {
        navigate(paths.dashboard.chat);
      }
    } catch (err: any) {
      setError(err.message || err.error || 'Failed to join group. The link may have expired or reached its maximum uses.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <Helmet>
        <title> Join Room </title>
      </Helmet>

      <Container component="main" maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Card sx={{ p: 4, width: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Iconify icon="solar:users-group-rounded-bold-duotone" width={64} sx={{ color: 'primary.main', mb: 2 }} />
            
            <Typography variant="h5" gutterBottom>
              Join Room
            </Typography>
            
            {validating ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
                Validating invite link...
              </Typography>
            ) : error ? (
              <Stack spacing={3} sx={{ width: 1, mt: 2 }}>
                <Alert severity="error">{error}</Alert>
                <Button fullWidth size="large" onClick={() => navigate('/')}>
                  Go Home
                </Button>
              </Stack>
            ) : (
              <>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
                  You have been invited to join this room. Click below to enter.
                </Typography>

                <Stack spacing={2} sx={{ width: 1 }}>
                  <LoadingButton
                    fullWidth
                    size="large"
                    variant="contained"
                    loading={joining}
                    onClick={handleJoin}
                  >
                    Join Room
                  </LoadingButton>

                  <Button fullWidth size="large" color="inherit" onClick={() => navigate('/')}>
                    Cancel
                  </Button>
                </Stack>
              </>
            )}
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
