import { useState, useEffect } from 'react';

import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
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

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { createGroup } from 'src/actions/group';
import { getAllUsers, type UserData } from 'src/api/user';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChatGroupCreateDialog({ open, onClose }: Props) {
  const router = useRouter();

  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      if (!open) return;
      try {
        setLoadingUsers(true);
        const fetched = await getAllUsers();
        setUsers(fetched);
      } catch (error) {
        console.error('Failed to load users:', error);
        toast.error('Failed to load contacts');
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, [open]);

  // Reset fields on close
  useEffect(() => {
    if (!open) {
      setGroupName('');
      setGroupAvatar('');
      setSearchQuery('');
      setSelectedIds([]);
    }
  }, [open]);

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    if (selectedIds.length === 0) {
      toast.error('Please select at least one participant');
      return;
    }

    try {
      setSubmitting(true);
      const res = await createGroup({
        name: groupName.trim(),
        participants: selectedIds,
        avatar: groupAvatar.trim() || undefined,
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

          <TextField
            fullWidth
            label="Group Avatar URL"
            placeholder="https://example.com/avatar.png"
            value={groupAvatar}
            onChange={(e) => setGroupAvatar(e.target.value)}
            size="small"
          />

          <Divider sx={{ my: 1 }} />

          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            Select participants
          </Typography>

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
        </Stack>

        <List sx={{ px: 2, maxHeight: 240, overflow: 'auto', minHeight: 120 }}>
          {loadingUsers ? (
            <Stack sx={{ py: 4 }} alignItems="center" justifyContent="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Loading contacts...
              </Typography>
            </Stack>
          ) : filteredUsers.length === 0 ? (
            <Stack sx={{ py: 4 }} alignItems="center" justifyContent="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No contacts found
              </Typography>
            </Stack>
          ) : (
            filteredUsers.map((userItem) => {
              const selected = selectedIds.includes(userItem._id);
              return (
                <ListItemButton
                  key={userItem._id}
                  onClick={() => handleSelect(userItem._id)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    px: 1.5,
                    py: 0.8,
                  }}
                >
                  <Avatar alt={userItem.name} src={userItem.avatar} sx={{ width: 36, height: 36 }} />
                  <ListItemText
                    primary={userItem.name}
                    secondary={`@${userItem.username}`}
                    primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                    sx={{ ml: 2 }}
                  />
                  <Checkbox checked={selected} color="primary" size="small" />
                </ListItemButton>
              );
            })
          )}
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
          disabled={!groupName.trim() || selectedIds.length === 0}
        >
          Create {selectedIds.length > 0 && `(${selectedIds.length})`}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
