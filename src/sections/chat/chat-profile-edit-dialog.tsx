import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { uploadAvatar, updateProfile, checkUsernameAvailability } from 'src/api/profile';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChatProfileEditDialog({ open, onClose }: Props) {
  const { user: authUser, checkUserSession } = useAuthContext();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tabValue, setTabValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Profile fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [about, setAbout] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');

  // Username check
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'same'
  >('same');
  const [originalUsername, setOriginalUsername] = useState('');

  // Privacy settings
  const [profilePhoto, setProfilePhoto] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [lastSeen, setLastSeen] = useState<'everyone' | 'contacts' | 'nobody'>('contacts');
  const [readReceipts, setReadReceipts] = useState(true);

  // Initialize form with current user data
  useEffect(() => {
    if (authUser && open) {
      setName(authUser.name || authUser.displayName || '');
      setUsername(authUser.username || '');
      setOriginalUsername(authUser.username || '');
      setAbout(authUser.about || '');
      setAvatar(authUser.avatar || authUser.photoURL || '');
      setAvatarPreview(authUser.avatar || authUser.photoURL || '');
      setProfilePhoto(authUser.privacy?.profilePhoto || 'everyone');
      setLastSeen(authUser.privacy?.lastSeen || 'contacts');
      setReadReceipts(authUser.privacy?.readReceipts ?? true);
      setUsernameStatus('same');
      setErrorMsg('');
      setTabValue(0);
    }
  }, [authUser, open]);

  // Check username availability
  const handleCheckUsername = useCallback(
    async (value: string) => {
      if (value === originalUsername) {
        setUsernameStatus('same');
        return;
      }
      if (value.length < 3) {
        setUsernameStatus('idle');
        return;
      }
      setUsernameStatus('checking');
      try {
        const available = await checkUsernameAvailability(value);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    },
    [originalUsername]
  );

  // Handle file selection for avatar upload
  const handleAvatarFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please select a valid image file (jpg, png, webp, etc.)');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Image size must be less than 5MB');
        return;
      }

      // Show local preview immediately
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);

      // Upload to server
      try {
        setUploading(true);
        setErrorMsg('');
        const res = await uploadAvatar(file);
        // Update avatar URL with the server response
        const newAvatarUrl = res?.data?.avatar || res?.avatar || avatar;
        setAvatar(newAvatarUrl);
        setAvatarPreview(newAvatarUrl);
        toast.success('Photo uploaded successfully!');
      } catch (error) {
        console.error(error);
        // Revert preview on error
        setAvatarPreview(avatar);
        const msg = error?.message || error?.msg || 'Failed to upload photo';
        setErrorMsg(typeof msg === 'string' ? msg : 'Failed to upload photo');
      } finally {
        setUploading(false);
        // Reset the input so same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [avatar]
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg('');

      if (usernameStatus === 'taken') {
        setErrorMsg('Username is already taken!');
        return;
      }

      await updateProfile({
        name,
        username,
        avatar,
        about,
        privacy: {
          profilePhoto,
          lastSeen,
          readReceipts,
        },
      });

      // Refresh user session to get updated data
      await checkUserSession?.();

      toast.success('Profile updated successfully!');
      onClose();
    } catch (error) {
      console.error(error);
      const msg = error?.message || error?.msg || 'Failed to update profile';
      setErrorMsg(typeof msg === 'string' ? msg : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Username status adornment
  const renderUsernameAdornment = () => {
    if (usernameStatus === 'checking') {
      return (
        <InputAdornment position="end">
          <CircularProgress size={20} />
        </InputAdornment>
      );
    }
    if (usernameStatus === 'available') {
      return (
        <InputAdornment position="end">
          <Chip
            label="Available"
            size="small"
            color="success"
            icon={<Iconify icon="solar:check-circle-bold" />}
          />
        </InputAdornment>
      );
    }
    if (usernameStatus === 'taken') {
      return (
        <InputAdornment position="end">
          <Chip
            label="Taken"
            size="small"
            color="error"
            icon={<Iconify icon="solar:close-circle-bold" />}
          />
        </InputAdornment>
      );
    }
    return null;
  };

  const renderProfileTab = (
    <Stack spacing={3} sx={{ pt: 2 }}>
      {/* Avatar upload section */}
      <Stack direction="row" alignItems="center" spacing={2.5}>
        <Box sx={{ position: 'relative' }}>
          <Avatar
            src={avatarPreview}
            alt={name}
            sx={{
              width: 88,
              height: 88,
              border: (theme) => `3px solid ${theme.vars.palette.primary.main}`,
              boxShadow: (theme) => `0 0 0 4px ${theme.vars.palette.background.paper}`,
            }}
          >
            {name?.charAt(0)?.toUpperCase()}
          </Avatar>

          {/* Upload overlay */}
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            sx={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 32,
              height: 32,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: 2,
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            {uploading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <Iconify icon="solar:camera-bold" width={16} />
            )}
          </IconButton>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            style={{ display: 'none' }}
          />
        </Box>

        <Stack spacing={0.5}>
          <Typography variant="subtitle1">Profile Photo</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Click the camera icon to upload a new photo
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            JPG, PNG, or WebP • Max 5MB
          </Typography>
        </Stack>
      </Stack>

      <TextField
        label="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="solar:user-bold" width={20} sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        label="Username"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          handleCheckUsername(e.target.value);
        }}
        fullWidth
        error={usernameStatus === 'taken'}
        helperText={usernameStatus === 'taken' ? 'This username is already taken' : ''}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Typography sx={{ color: 'text.disabled', fontWeight: 600 }}>@</Typography>
            </InputAdornment>
          ),
          endAdornment: renderUsernameAdornment(),
        }}
      />

      <TextField
        label="About"
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        fullWidth
        multiline
        rows={3}
        placeholder="Tell others about yourself..."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
              <Iconify icon="solar:info-circle-bold" width={20} sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
      />
    </Stack>
  );

  const renderPrivacyTab = (
    <Stack spacing={3} sx={{ pt: 2 }}>
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          bgcolor: 'background.neutral',
        }}
      >
        <Stack spacing={2.5}>
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:camera-bold" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle2">Profile Photo</Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Who can see your profile photo
            </Typography>
            <FormControl size="small" fullWidth>
              <InputLabel>Visible to</InputLabel>
              <Select
                value={profilePhoto}
                label="Visible to"
                onChange={(e) =>
                  setProfilePhoto(e.target.value as 'everyone' | 'contacts' | 'nobody')
                }
              >
                <MenuItem value="everyone">Everyone</MenuItem>
                <MenuItem value="contacts">My Contacts</MenuItem>
                <MenuItem value="nobody">Nobody</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:clock-circle-bold" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle2">Last Seen</Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Who can see when you were last active
            </Typography>
            <FormControl size="small" fullWidth>
              <InputLabel>Visible to</InputLabel>
              <Select
                value={lastSeen}
                label="Visible to"
                onChange={(e) =>
                  setLastSeen(e.target.value as 'everyone' | 'contacts' | 'nobody')
                }
              >
                <MenuItem value="everyone">Everyone</MenuItem>
                <MenuItem value="contacts">My Contacts</MenuItem>
                <MenuItem value="nobody">Nobody</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Divider />

          <Stack spacing={0.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={readReceipts}
                  onChange={(e) => setReadReceipts(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Iconify
                      icon="solar:check-read-bold"
                      width={20}
                      sx={{ color: 'primary.main' }}
                    />
                    <Typography variant="subtitle2">Read Receipts</Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary', ml: 3.5 }}>
                    Let others know when you&apos;ve read their messages
                  </Typography>
                </Stack>
              }
              sx={{ mx: 0, alignItems: 'flex-start' }}
            />
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="solar:settings-bold-duotone" width={28} sx={{ color: 'primary.main' }} />
          <Typography variant="h6">Edit Profile</Typography>
        </Stack>

        <IconButton onClick={onClose} size="small">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <Box sx={{ px: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{
            '& .MuiTab-root': {
              minHeight: 48,
              textTransform: 'none',
              fontWeight: 'fontWeightSemiBold',
            },
          }}
        >
          <Tab
            icon={<Iconify icon="solar:user-bold" width={20} />}
            iconPosition="start"
            label="Profile"
          />
          <Tab
            icon={<Iconify icon="solar:shield-bold" width={20} />}
            iconPosition="start"
            label="Privacy"
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ pb: 1 }}>
        {!!errorMsg && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg('')}>
            {errorMsg}
          </Alert>
        )}

        {tabValue === 0 && renderProfileTab}
        {tabValue === 1 && renderPrivacyTab}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancel
        </Button>

        <LoadingButton
          variant="contained"
          onClick={handleSave}
          loading={saving}
          loadingIndicator="Saving..."
          disabled={usernameStatus === 'taken' || uploading}
        >
          Save Changes
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
