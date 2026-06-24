import type { IChatParticipant } from 'src/types/chat';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { createGroup } from 'src/actions/group';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  chatContacts: IChatParticipant[];
  preSelectedIds?: string[]; // pre-check specific contacts when opening
};

export function ChatGroupCreateDialog({ open, onClose, chatContacts, preSelectedIds = [] }: Props) {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupName, setGroupName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAvatarFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    setAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  }, []);

  const handleRemoveAvatar = () => {
    setAvatarPreview('');
    setAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Reset fields on close / seed pre-selected on open
  useEffect(() => {
    if (open) {
      setGroupName('');
      setAvatarPreview('');
      setAvatarFile(null);
      setSearchQuery('');
      setSelectedIds(preSelectedIds.length > 0 ? preSelectedIds : []);
    } else if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only show results when user is actively searching
  const hasQuery = searchQuery.trim().length > 0;
  const filteredUsers = hasQuery
    ? chatContacts.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.username || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Always keep the selected contacts available for chip display
  const selectedContacts = chatContacts.filter((c) => selectedIds.includes(c.id));

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (selectedIds.length < 2) {
      toast.error('Please select at least two participants');
      return;
    }

    try {
      setSubmitting(true);
      const res = await createGroup({
        name: groupName.trim(),
        participants: selectedIds,
        avatarFile: avatarFile || undefined,
      });

      toast.success('Group created successfully');
      onClose();

      const newConvId =
        res?.data?.conversationId?._id ||
        res?.data?.conversationId ||
        res?.conversationId?._id ||
        res?.conversationId ||
        res?.data?._id;

      if (newConvId) {
        router.push(`${paths.dashboard.chat}?id=${newConvId}`);
      } else {
        router.push(paths.dashboard.chat);
      }
    } catch (error) {
      toast.error('Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Iconify icon="solar:users-group-two-rounded-bold" width={24} sx={{ color: 'primary.main' }} />
        <Typography variant="h6">Create new group</Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Stack spacing={2} sx={{ px: 3, pt: 2, pb: 1 }}>
          <TextField
            fullWidth
            label="Group Name"
            placeholder="e.g. Project Alpha Team"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
            size="small"
          />

          <Stack direction="row" alignItems="center" spacing={3} sx={{ py: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={avatarPreview}
                alt="Group Avatar"
                sx={{
                  width: 64,
                  height: 64,
                  border: (theme) => `2px solid ${theme.vars.palette.primary.main}`,
                }}
              >
                <Iconify icon="solar:users-group-two-rounded-bold" width={32} />
              </Avatar>

              <IconButton
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 24,
                  height: 24,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <Iconify icon="solar:camera-bold" width={12} />
              </IconButton>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                style={{ display: 'none' }}
              />
            </Box>

            <Stack spacing={0.5} alignItems="flex-start">
              <Typography variant="subtitle2">Group Photo</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Upload an image for the group profile
              </Typography>
              {avatarPreview && (
                <Button size="small" color="error" onClick={handleRemoveAvatar} sx={{ p: 0, minWidth: 0, height: 'auto', textTransform: 'none' }}>
                  Remove photo
                </Button>
              )}
            </Stack>
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            Select participants
          </Typography>

          {/* Selected chips — always visible so user tracks their picks */}
          {selectedContacts.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {selectedContacts.map((c) => (
                <Stack
                  key={c.id}
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{
                    px: 1,
                    py: 0.4,
                    borderRadius: 5,
                    bgcolor: 'primary.soft',
                    border: '1px solid',
                    borderColor: 'primary.light',
                  }}
                >
                  <Avatar src={c.avatarUrl} alt={c.name} sx={{ width: 18, height: 18, fontSize: 10 }} />
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </Typography>
                  <Box
                    component="span"
                    onClick={() => handleSelect(c.id)}
                    sx={{ cursor: 'pointer', color: 'primary.main', display: 'flex', ml: 0.25 }}
                  >
                    <Iconify icon="mingcute:close-line" width={12} />
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}

          <TextField
            fullWidth
            autoComplete="off"
            size="small"
            placeholder="Type a name to search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" width={18} sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <Iconify icon="mingcute:close-line" width={14} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Stack>

        <List sx={{ px: 2, maxHeight: 240, overflow: 'auto', minHeight: 120 }}>
          {/* Empty state — before user types anything */}
          {!hasQuery && (
            <Stack sx={{ py: 4 }} alignItems="center" justifyContent="center" spacing={1}>
              <Iconify icon="eva:search-fill" width={32} sx={{ color: 'text.disabled' }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Type a name to find contacts
              </Typography>
              {selectedIds.length > 0 && (
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  {selectedIds.length} selected
                </Typography>
              )}
            </Stack>
          )}

          {/* No results after searching */}
          {hasQuery && filteredUsers.length === 0 && (
            <Stack sx={{ py: 4 }} alignItems="center" justifyContent="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No contacts found for &ldquo;{searchQuery}&rdquo;
              </Typography>
            </Stack>
          )}

          {/* Search results */}
          {hasQuery &&
            filteredUsers.map((contact) => {
              const selected = selectedIds.includes(contact.id);
              return (
                <ListItemButton
                  key={contact.id}
                  onClick={() => handleSelect(contact.id)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    px: 1.5,
                    py: 0.8,
                    bgcolor: selected ? 'primary.soft' : 'transparent',
                  }}
                >
                  <Avatar alt={contact.name} src={contact.avatarUrl} sx={{ width: 36, height: 36 }} />
                  <ListItemText
                    primary={contact.name}
                    secondary={`@${contact.username || contact.name}`}
                    primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                    sx={{ ml: 2 }}
                  />
                  <Checkbox checked={selected} color="primary" size="small" />
                </ListItemButton>
              );
            })}
        </List>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2.5, pt: 1.5 }}>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          color="primary"
          onClick={handleCreate}
          loading={submitting}
          disabled={!groupName.trim() || selectedIds.length < 2}
        >
          Create {selectedIds.length > 0 && `(${selectedIds.length})`}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
