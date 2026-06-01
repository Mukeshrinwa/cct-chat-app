import { useMemo, useState, useEffect } from 'react';

import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { addMembersToGroup } from 'src/actions/group';
import { getAllUsers, type UserData } from 'src/api/user';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  group: any;
  existingParticipantIds: string[];
};

export function ChatGroupAddMembersDialog({
  open,
  onClose,
  group,
  existingParticipantIds,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch all users when dialog opens
  useEffect(() => {
    async function fetchUsers() {
      if (!open) return;
      try {
        setLoadingUsers(true);
        const fetched = await getAllUsers();
        setUsers(fetched);
      } catch (error) {
        console.error('Failed to load users:', error);
        toast.error('Contacts load karne mein error aaya');
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedIds([]);
    }
  }, [open]);

  // Filter out users already in the group
  const availableUsers = useMemo(
    () => users.filter((u) => !existingParticipantIds.includes(u._id)),
    [users, existingParticipantIds]
  );

  const filteredUsers = useMemo(
    () =>
      availableUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.username.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [availableUsers, searchQuery]
  );

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAdd = async () => {
    if (!selectedIds.length || !group?._id) return;
    try {
      setSubmitting(true);
      await addMembersToGroup(group._id, selectedIds);
      toast.success(
        `${selectedIds.length} member${selectedIds.length > 1 ? 's' : ''} add kar diya gaya!`
      );
      onClose();
    } catch (error) {
      toast.error('Members add karne mein error aaya. Dobara try karein.');
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
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      {/* ---- Title ---- */}
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Iconify icon="solar:user-plus-bold-duotone" width={26} sx={{ color: 'primary.main' }} />
        <Stack flex={1}>
          <Typography variant="h6">Add Members</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {group?.groupName}
          </Typography>
        </Stack>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 0 }}>
        {/* Search */}
        <Stack sx={{ px: 2.5, pt: 2, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" width={18} sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />

          {selectedIds.length > 0 && (
            <Typography variant="caption" sx={{ mt: 1, color: 'primary.main', fontWeight: 600 }}>
              {selectedIds.length} selected
            </Typography>
          )}
        </Stack>

        {/* User List */}
        <List sx={{ px: 1.5, maxHeight: 280, overflow: 'auto', minHeight: 120 }}>
          {loadingUsers ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 5 }}>
              <CircularProgress size={28} />
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1.5 }}>
                Loading contacts...
              </Typography>
            </Stack>
          ) : filteredUsers.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 5 }}>
              <Iconify
                icon="solar:users-group-two-rounded-bold"
                width={40}
                sx={{ color: 'text.disabled', mb: 1 }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {availableUsers.length === 0
                  ? 'Saare contacts already group mein hain!'
                  : 'Koi contact nahi mila'}
              </Typography>
            </Stack>
          ) : (
            filteredUsers.map((userItem) => {
              const isSelected = selectedIds.includes(userItem._id);
              return (
                <ListItemButton
                  key={userItem._id}
                  onClick={() => handleToggle(userItem._id)}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.5,
                    px: 1.5,
                    py: 0.8,
                    bgcolor: isSelected ? 'primary.lighter' : 'transparent',
                    '&:hover': {
                      bgcolor: isSelected ? 'primary.lighter' : 'action.hover',
                    },
                  }}
                >
                  <Avatar
                    alt={userItem.name}
                    src={userItem.avatar}
                    sx={{ width: 36, height: 36, flexShrink: 0 }}
                  />
                  <ListItemText
                    primary={userItem.name}
                    secondary={`@${userItem.username}`}
                    primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                    sx={{ ml: 1.5 }}
                  />
                  <Checkbox
                    checked={isSelected}
                    color="primary"
                    size="small"
                    disableRipple
                    sx={{ flexShrink: 0 }}
                  />
                </ListItemButton>
              );
            })
          )}
        </List>
      </DialogContent>

      <Divider />

      {/* ---- Actions ---- */}
      <DialogActions sx={{ p: 2.5, pt: 1.5 }}>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>

        <LoadingButton
          variant="contained"
          color="primary"
          onClick={handleAdd}
          loading={submitting}
          disabled={selectedIds.length === 0}
          startIcon={<Iconify icon="solar:user-plus-bold" width={18} />}
        >
          Add {selectedIds.length > 0 && `(${selectedIds.length})`}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
