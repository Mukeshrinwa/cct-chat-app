import { useRef, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ListItemButton from '@mui/material/ListItemButton';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import axios from 'src/utils/axios';

import {
  deleteGroup,
  updateGroup,
  promoteToAdmin,
  demoteFromAdmin,
  generateGroupInviteLink,
  updateDisappearingMessages,
} from 'src/actions/group';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const DISAPPEARING_OPTIONS = [
  { value: 'off', label: 'Off', icon: 'solar:close-circle-bold' },
  { value: '24h', label: '24 Hours', icon: 'solar:clock-circle-bold' },
  { value: '7d', label: '7 Days', icon: 'solar:calendar-bold' },
  { value: '30d', label: '30 Days', icon: 'solar:calendar-mark-bold' },
];

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  group: any;
};

export function ChatGroupEditDialog({ open, onClose, group }: Props) {
  const router = useRouter();
  const { user } = useMockedUser();

  const [activeTab, setActiveTab] = useState(0);

  // ── General Info ───────────────────────────────────────────────────
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('');

  // ── Permissions ────────────────────────────────────────────────────
  const [onlyAdminsCanMessage, setOnlyAdminsCanMessage] = useState(false);
  const [onlyAdminsCanEditInfo, setOnlyAdminsCanEditInfo] = useState(false);

  // ── Disappearing messages ──────────────────────────────────────────
  const [disappearingMode, setDisappearingMode] = useState('off');

  // ── Invite link ────────────────────────────────────────────────────
  const [inviteLink, setInviteLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── Admin management ───────────────────────────────────────────────
  const [adminLoading, setAdminLoading] = useState<string | null>(null);

  // ── Save / Delete ──────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Avatar upload ──────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Derived
  const ownerId: string = group?.owner?.id || group?.owner?._id || group?.owner || '';
  const currentUserId = (user as any)?.id || (user as any)?._id || '';
  const isOwner = !!currentUserId && currentUserId === ownerId;
  const adminIds = new Set<string>(
    (group?.admins || []).map((a: any) => a.id || a._id || a)
  );
  const isAdmin = isOwner || adminIds.has(currentUserId);

  // All members (admins + members, deduped)
  const allMembers: any[] = (() => {
    const seen = new Set<string>();
    const result: any[] = [];
    const add = (u: any) => {
      const id = u.id || u._id || '';
      if (id && !seen.has(id)) { seen.add(id); result.push(u); }
    };
    (group?.admins || []).forEach(add);
    (group?.members || []).forEach(add);
    return result;
  })();

  // ── Init on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (group && open) {
      setGroupName(group.groupName || '');
      setDescription(group.description || '');
      setGroupAvatar(group.groupAvatar || '');
      setGroupAvatarPreview(group.groupAvatar || '');
      setOnlyAdminsCanMessage(group.permissions?.onlyAdminsCanMessage ?? false);
      setOnlyAdminsCanEditInfo(group.permissions?.onlyAdminsCanEditInfo ?? false);
      // Always sync disappearingMode from the group — after a successful save
      // the optimistic SWR patch in updateDisappearingMessages ensures group.disappearingMode
      // already reflects the new value, so this is always correct.
      // disappearingMode lives on the nested conversationId object per the API response
      setDisappearingMode(group.conversationId?.disappearingMode || group.disappearingMode || 'off');
      setInviteLink(group.inviteLink || '');
      setActiveTab(0);
    }
  }, [group, open]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!groupName.trim()) { toast.error('Group name is required'); return; }
    try {
      setSaving(true);
      await updateGroup(group._id, {
        groupName,
        description,
        groupAvatar,
        permissions: { onlyAdminsCanMessage, onlyAdminsCanEditInfo },
      });
      toast.success('Group settings updated');
      onClose();
    } catch {
      toast.error('Failed to update group settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this group? This cannot be undone.')) return;
    try {
      setDeleting(true);
      await deleteGroup(group._id);
      toast.success('Group deleted successfully');
      onClose();
      router.push(paths.dashboard.chat);
    } catch {
      toast.error('Failed to delete group');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateLink = async () => {
    try {
      setGeneratingLink(true);
      const res = await generateGroupInviteLink(group._id);
      const link = res?.data?.inviteLink || res?.inviteLink || '';
      setInviteLink(link);
      toast.success('Invite link generated');
    } catch {
      toast.error('Failed to generate invite link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [inviteLink]);

  const handleDisappearingSave = async (mode: string) => {
    // The backend endpoint requires a conversationId, not the group _id.
    // group.conversationId may be a populated object or a plain string ID.
    const conversationId =
      group.conversationId?._id ||
      group.conversationId ||
      group._id;
    try {
      await updateDisappearingMessages(conversationId, mode);
      setDisappearingMode(mode);
      toast.success('Disappearing messages updated');
    } catch {
      toast.error('Failed to update disappearing messages');
    }
  };

  const handleToggleAdmin = async (member: any) => {
    const memberId = member.id || member._id || '';
    if (!memberId || memberId === ownerId) return;
    const memberIsAdmin = adminIds.has(memberId);

    try {
      setAdminLoading(memberId);
      if (memberIsAdmin) {
        await demoteFromAdmin(group._id, memberId);
        toast.success(`${member.name} removed as admin`);
      } else {
        await promoteToAdmin(group._id, memberId);
        toast.success(`${member.name} is now an admin`);
      }
    } catch (error: any) {
      const msg =
        error?.error ||
        error?.message ||
        'Failed to update admin status';
      toast.error(msg);
    } finally {
      setAdminLoading(null);
    }
  };

  const handleAvatarFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file (JPG, PNG, WebP)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }

      // Show local preview immediately
      const previewUrl = URL.createObjectURL(file);
      setGroupAvatarPreview(previewUrl);

      try {
        setAvatarUploading(true);
        const formData = new FormData();
        formData.append('avatar', file);
        const res = await axios.post(`/api/v1/groups/${group._id}/avatar`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const newUrl: string =
          res.data?.data?.groupAvatar ||
          res.data?.groupAvatar ||
          res.data?.avatar ||
          previewUrl;
        setGroupAvatar(newUrl);
        setGroupAvatarPreview(newUrl);
        toast.success('Group photo updated!');
      } catch {
        // Revert preview on failure
        setGroupAvatarPreview(groupAvatar);
        toast.error('Failed to upload group photo');
      } finally {
        setAvatarUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [group._id, groupAvatar]
  );

  // ── Tab panels ──────────────────────────────────────────────────────

  const renderGeneralTab = (
    <Stack spacing={2.5}>
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

      {/* Avatar upload */}
      <Stack direction="row" alignItems="center" spacing={2.5} sx={{ pb: 1 }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Avatar
            src={groupAvatarPreview}
            alt={groupName}
            sx={{
              width: 80,
              height: 80,
              fontSize: 28,
              fontWeight: 700,
              bgcolor: 'primary.main',
              border: (theme) => `3px solid ${theme.vars.palette.primary.main}`,
              boxShadow: (theme) => `0 0 0 3px ${theme.vars.palette.background.paper}`,
            }}
          >
            {groupName?.charAt(0)?.toUpperCase()}
          </Avatar>

          <IconButton
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            size="small"
            sx={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 28,
              height: 28,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: 2,
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            {avatarUploading ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <Iconify icon="solar:camera-bold" width={14} />
            )}
          </IconButton>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            style={{ display: 'none' }}
          />
        </Box>

        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Group Photo</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Click the camera icon to upload
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            JPG, PNG, or WebP • Max 5MB
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );

  const renderPermissionsTab = (
    <Stack spacing={2}>
      {/* Messaging permission */}
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.neutral' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
          <Iconify icon="solar:chat-round-bold" width={20} sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle2">Send Messages</Typography>
        </Stack>
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
              <Typography variant="body2">Only admins &amp; owner can send messages</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {onlyAdminsCanMessage
                  ? 'Regular members cannot send messages'
                  : 'All members can send messages'}
              </Typography>
            </Stack>
          }
          sx={{ mx: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
        />
      </Box>

      {/* Group info permission */}
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.neutral' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
          <Iconify icon="solar:pen-new-square-bold" width={20} sx={{ color: 'warning.main' }} />
          <Typography variant="subtitle2">Edit Group Info</Typography>
        </Stack>
        <FormControlLabel
          control={
            <Switch
              checked={onlyAdminsCanEditInfo}
              onChange={(e) => setOnlyAdminsCanEditInfo(e.target.checked)}
              color="warning"
            />
          }
          label={
            <Stack>
              <Typography variant="body2">Only admins &amp; owner can edit group info</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {onlyAdminsCanEditInfo
                  ? 'Group name, avatar & description locked to admins'
                  : 'All members can edit group info'}
              </Typography>
            </Stack>
          }
          sx={{ mx: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
        />
      </Box>
    </Stack>
  );

  const renderAdminsTab = (
    <Stack spacing={1.5}>
      {isAdmin && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          As an <strong>{isOwner ? 'Owner' : 'Admin'}</strong>, you can promote or demote other admins.
        </Alert>
      )}

      <List disablePadding>
        {allMembers.map((member) => {
          const memberId = member.id || member._id || '';
          const memberIsOwner = memberId === ownerId;
          const memberIsAdmin = adminIds.has(memberId);
          const isLoading = adminLoading === memberId;
          const isSelf = memberId === currentUserId;

          return (
            <Box key={memberId}>
              <ListItemButton
                disableRipple
                sx={{ px: 1, py: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'transparent' } }}
              >
                <Avatar
                  src={member.avatar || member.avatarUrl || ''}
                  alt={member.name}
                  sx={{ width: 38, height: 38, mr: 1.5 }}
                />
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <Typography variant="subtitle2" noWrap>
                        {member.name}
                        {isSelf && (
                          <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>
                            (you)
                          </Typography>
                        )}
                      </Typography>
                      {memberIsOwner && (
                        <Chip label="Owner" size="small" color="warning" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                      )}
                      {!memberIsOwner && memberIsAdmin && (
                        <Chip label="Admin" size="small" color="info" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                      )}
                    </Stack>
                  }
                  secondary={`@${member.username || ''}`}
                  secondaryTypographyProps={{ noWrap: true, typography: 'caption' }}
                />

                {/* Toggle admin — admin or owner can do this, not for self or the group owner */}
                {isAdmin && !memberIsOwner && !isSelf && (
                  <Tooltip title={memberIsAdmin ? 'Remove admin' : 'Make admin'}>
                    <LoadingButton
                      size="small"
                      loading={isLoading}
                      onClick={() => handleToggleAdmin(member)}
                      variant={memberIsAdmin ? 'outlined' : 'contained'}
                      color={memberIsAdmin ? 'error' : 'primary'}
                      sx={{ minWidth: 100, fontSize: 12 }}
                      startIcon={
                        !isLoading && (
                          <Iconify
                            icon={memberIsAdmin ? 'solar:shield-minus-bold' : 'solar:shield-plus-bold'}
                            width={14}
                          />
                        )
                      }
                    >
                      {memberIsAdmin ? 'Remove' : 'Make Admin'}
                    </LoadingButton>
                  </Tooltip>
                )}
              </ListItemButton>
              <Divider sx={{ mx: 1 }} />
            </Box>
          );
        })}
      </List>
    </Stack>
  );

  const renderInviteTab = (
    <Stack spacing={2.5}>
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.neutral', textAlign: 'center' }}>
        <Iconify icon="solar:link-bold-duotone" width={48} sx={{ color: 'primary.main', mb: 1 }} />
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>Group Invite Link</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Anyone with this link can join the group
        </Typography>
      </Box>

      {inviteLink ? (
        <Stack spacing={1.5}>
          <TextField
            value={inviteLink}
            fullWidth
            InputProps={{
              readOnly: true,
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="solar:link-bold" width={18} sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={linkCopied ? 'Copied!' : 'Copy link'}>
                    <IconButton onClick={handleCopyLink} size="small" color={linkCopied ? 'success' : 'default'}>
                      <Iconify icon={linkCopied ? 'solar:check-circle-bold' : 'solar:copy-bold'} width={18} />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
            sx={{ '& input': { fontSize: 13 } }}
          />
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<Iconify icon="solar:restart-bold" width={16} />}
            onClick={handleGenerateLink}
            disabled={generatingLink}
          >
            Regenerate Link
          </Button>
        </Stack>
      ) : (
        <LoadingButton
          variant="contained"
          loading={generatingLink}
          onClick={handleGenerateLink}
          startIcon={<Iconify icon="solar:link-bold" width={18} />}
          fullWidth
        >
          Generate Invite Link
        </LoadingButton>
      )}
    </Stack>
  );

  const renderDisappearingTab = (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Messages will automatically disappear after the selected time.
      </Typography>

      {DISAPPEARING_OPTIONS.map((option) => {
        const isSelected = disappearingMode === option.value;
        return (
          <Box
            key={option.value}
            onClick={() => handleDisappearingSave(option.value)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 2,
              py: 1.5,
              borderRadius: 2,
              cursor: 'pointer',
              border: '1.5px solid',
              borderColor: isSelected ? 'primary.main' : 'divider',
              bgcolor: isSelected ? 'primary.soft' : 'background.paper',
              transition: 'all 0.18s',
              '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' },
            }}
          >
            <Iconify
              icon={option.icon}
              width={22}
              sx={{ color: isSelected ? 'primary.main' : 'text.disabled', flexShrink: 0 }}
            />
            <Typography variant="subtitle2" sx={{ flexGrow: 1, color: isSelected ? 'primary.main' : 'text.primary' }}>
              {option.label}
            </Typography>
            {isSelected && (
              <Iconify icon="solar:check-circle-bold" width={20} sx={{ color: 'primary.main' }} />
            )}
          </Box>
        );
      })}
    </Stack>
  );

  const TABS = [
    { label: 'General', icon: 'solar:settings-bold', content: renderGeneralTab },
    { label: 'Permissions', icon: 'solar:shield-bold', content: renderPermissionsTab },
    { label: 'Admins', icon: 'solar:crown-bold', content: renderAdminsTab },
    { label: 'Invite Link', icon: 'solar:link-bold', content: renderInviteTab },
    { label: 'Disappearing', icon: 'solar:clock-circle-bold', content: renderDisappearingTab },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2.5, overflow: 'hidden' } }}
    >
      {/* Header */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="solar:settings-bold-duotone" width={26} sx={{ color: 'primary.main' }} />
          <Typography variant="h6">Group Settings</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          px: 2,
          mt: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 44, fontSize: 12, fontWeight: 600, minWidth: 'auto', px: 1.5 },
        }}
      >
        {TABS.map((tab) => (
          <Tab
            key={tab.label}
            label={tab.label}
            icon={<Iconify icon={tab.icon} width={16} />}
            iconPosition="start"
          />
        ))}
      </Tabs>

      {/* Tab Content */}
      <DialogContent sx={{ py: 2.5, minHeight: 280 }}>
        {TABS[activeTab].content}
      </DialogContent>

      <Divider />

      {/* Footer — only show Save/Delete on General tab */}
      {activeTab === 0 && (
        <DialogActions sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between' }}>
          {isOwner ? (
            <LoadingButton
              variant="outlined"
              color="error"
              onClick={handleDelete}
              loading={deleting}
              startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
            >
              Delete Group
            </LoadingButton>
          ) : <Box />}

          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" color="inherit" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </Button>
            <LoadingButton variant="contained" color="primary" onClick={handleSave} loading={saving} disabled={deleting}>
              Save Changes
            </LoadingButton>
          </Stack>
        </DialogActions>
      )}
    </Dialog>
  );
}
