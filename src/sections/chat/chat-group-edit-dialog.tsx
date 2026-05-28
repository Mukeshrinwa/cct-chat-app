import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { deleteGroup, updateGroup } from 'src/actions/group';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  group: any;
};

export function ChatGroupEditDialog({ open, onClose, group }: Props) {
  const router = useRouter();

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('');
  const [onlyAdminsCanMessage, setOnlyAdminsCanMessage] = useState(false);
  const [onlyAdminsCanEditInfo, setOnlyAdminsCanEditInfo] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (group && open) {
      setGroupName(group.groupName || '');
      setDescription(group.description || '');
      setGroupAvatar(group.groupAvatar || '');
      setOnlyAdminsCanMessage(group.permissions?.onlyAdminsCanMessage ?? false);
      setOnlyAdminsCanEditInfo(group.permissions?.onlyAdminsCanEditInfo ?? false);
    }
  }, [group, open]);

  const handleSave = async () => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }

    try {
      setSaving(true);
      await updateGroup(group._id, {
        groupName,
        description,
        groupAvatar,
        permissions: {
          onlyAdminsCanMessage,
          onlyAdminsCanEditInfo,
        },
      });
      toast.success('Group settings updated');
      onClose();
    } catch (error) {
      toast.error('Failed to update group settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this group? This action cannot be undone.'
    );
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      await deleteGroup(group._id);
      toast.success('Group deleted successfully');
      onClose();
      router.push(paths.dashboard.chat);
    } catch (error) {
      toast.error('Failed to delete group');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="solar:settings-bold-duotone" width={28} sx={{ color: 'primary.main' }} />
          <Typography variant="h6">Group Settings</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ py: 3 }}>
        <Stack spacing={3}>
          <TextField
            label="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="solar:users-group-two-rounded-bold" width={20} sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="What is this group about?"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                  <Iconify icon="solar:info-circle-bold" width={20} sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Group Avatar URL"
            value={groupAvatar}
            onChange={(e) => setGroupAvatar(e.target.value)}
            fullWidth
            placeholder="https://example.com/avatar.png"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="solar:camera-bold" width={20} sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.neutral' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Permissions
            </Typography>

            <Stack spacing={1.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={onlyAdminsCanMessage}
                    onChange={(e) => setOnlyAdminsCanMessage(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Stack>
                    <Typography variant="subtitle2" sx={{ fontSize: 13 }}>
                      Restrict Messaging
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Only admins can send messages to this group
                    </Typography>
                  </Stack>
                }
                sx={{ mx: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
              />

              <Divider />

              <FormControlLabel
                control={
                  <Switch
                    checked={onlyAdminsCanEditInfo}
                    onChange={(e) => setOnlyAdminsCanEditInfo(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Stack>
                    <Typography variant="subtitle2" sx={{ fontSize: 13 }}>
                      Restrict Editing Group Info
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Only admins can change group name, description, and avatar
                    </Typography>
                  </Stack>
                }
                sx={{ mx: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3, display: 'flex', justifyContent: 'space-between' }}>
        <LoadingButton
          variant="outlined"
          color="error"
          onClick={handleDelete}
          loading={deleting}
          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
        >
          Delete Group
        </LoadingButton>

        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" color="inherit" onClick={onClose} disabled={saving || deleting}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            color="primary"
            onClick={handleSave}
            loading={saving}
            disabled={deleting}
          >
            Save Changes
          </LoadingButton>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
