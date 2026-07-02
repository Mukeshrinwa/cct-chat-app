// import type { SelectChangeEvent } from '@mui/material/Select';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Badge, { badgeClasses } from '@mui/material/Badge';

import { paths } from 'src/routes/paths';

// import { socketManager } from 'src/socket/socket-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';
import { signOut as jwtSignOut } from 'src/auth/context/jwt/action';

import { ChatProfileEditDialog } from './chat-profile-edit-dialog';
import { ChatAvatarPreviewDialog } from './chat-avatar-preview-dialog';

// ----------------------------------------------------------------------

export function ChatNavAccount() {
  const { user } = useMockedUser();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const handleOpenDrawer = () => setDrawerOpen(true);
  const handleCloseDrawer = () => setDrawerOpen(false);

  const [status, setStatus] = useState<'online' | 'alway' | 'busy' | 'offline'>('online');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cct_user_presence_status');
      if (saved && ['online', 'alway', 'busy', 'offline'].includes(saved)) {
        setStatus(saved as 'online' | 'alway' | 'busy' | 'offline');
      }
    } catch (e) {
      console.error('Failed to load status', e);
    }
  }, []);

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  /* const handleChangeStatus = useCallback((event: SelectChangeEvent) => {
    const newStatus = event.target.value as 'online' | 'alway' | 'busy' | 'offline';
    setStatus(newStatus);
    
    try {
      localStorage.setItem('cct_user_presence_status', newStatus);
    } catch (e) {
      console.error('Failed to save status', e);
    }

    const socket = socketManager.getSocket();
    if (socket && socket.connected) {
      socket.emit('update_presence', { status: newStatus });
    }
  }, []); */

  const handleLogout = useCallback(async () => {
    try {
      await jwtSignOut();
      handleCloseDrawer();
      window.location.href = paths.auth.jwt.signIn;
    } catch (error) {
      console.error(error);
      toast.error('Unable to logout!');
    }
  }, []);

  const handleOpenProfile = useCallback(() => {
    handleCloseDrawer();
    setProfileDialogOpen(true);
  }, []);

  return (
    <>
      <Badge variant={status} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Avatar
          src={user?.photoURL}
          alt={user?.displayName}
          onClick={handleOpenDrawer}
          sx={{ cursor: 'pointer', width: 48, height: 48 }}
        >
          {user?.displayName?.charAt(0).toUpperCase()}
        </Avatar>
      </Badge>

      <Drawer
        open={drawerOpen}
        anchor="right"
        onClose={handleCloseDrawer}
        PaperProps={{
          sx: {
            width: { xs: 280, md: 320 },
            p: 3,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Typography variant="h6">My Profile</Typography>
          <IconButton onClick={handleCloseDrawer}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Stack>

        <Stack spacing={3} sx={{ flexGrow: 1 }}>
          <Stack alignItems="center" spacing={2}>
            <Badge
              variant={status}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              sx={{
                [`& .${badgeClasses.badge}`]: {
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                },
              }}
            >
              <Avatar
                src={user?.photoURL}
                alt={user?.displayName}
                sx={{ width: 80, height: 80, cursor: 'pointer' }}
                onClick={() => setAvatarPreviewOpen(true)}
              >
                {user?.displayName?.charAt(0).toUpperCase()}
              </Avatar>
            </Badge>
            <Stack alignItems="center">
              <Typography variant="subtitle1">{user?.displayName}</Typography>
              <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
            </Stack>
          </Stack>

          <Divider sx={{ borderStyle: 'dashed' }} />

          {/* <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">Status</Typography>
            <FormControl fullWidth>
              <Select
                native
                value={status}
                onChange={handleChangeStatus}
                input={<InputBase />}
                inputProps={{ id: 'chat-status-select-drawer', sx: { textTransform: 'capitalize' } }}
              >
                {['online', 'alway', 'busy', 'offline'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </FormControl>
          </Stack> */}

          <Button
            fullWidth
            size="large"
            variant="soft"
            color="primary"
            onClick={handleOpenProfile}
            startIcon={<Iconify icon="solar:user-id-bold" />}
          >
            Edit Profile
          </Button>

             <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
            <a href={paths.dashboard.privacy} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit',cursor: 'pointer' }}>
              Privacy Policy
            </a>
            {' | '}
            <a href={paths.dashboard.terms} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit',cursor: 'pointer' }}>
              Terms & Conditions
            </a>
          </Typography>
        </Stack>

        <Box sx={{ mt: 3 }}>
          <Button
            fullWidth
            size="large"
            color="error"
            variant="contained"
            onClick={handleLogout}
            startIcon={<Iconify icon="ic:round-power-settings-new" />}
          >
            Logout
          </Button>
        </Box>
      </Drawer>

      <ChatProfileEditDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />

      <ChatAvatarPreviewDialog
        open={avatarPreviewOpen}
        onClose={() => setAvatarPreviewOpen(false)}
        name={user?.displayName || 'User'}
        avatarUrl={user?.photoURL}
      />
    </>
  );
}
