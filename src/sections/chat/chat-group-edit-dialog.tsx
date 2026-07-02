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
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useMockedUser } from 'src/auth/hooks';

import { InviteList } from './invite/InviteList';
import { InviteModal } from './invite/InviteModal';
import { ImageCropperDialog } from './image-cropper-dialog';
import { ChatShareInviteDialog } from './chat-share-invite-dialog';

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
  const [permissions, setPermissions] = useState({
    // onlyAdminsCanMessage: false,
    // onlyAdminsCanEditInfo: false,
    editGroupInfo: 'all',
    addMembers: 'all',
    removeMembers: 'admins',
    startCalls: 'all',
    manageMessages: 'admins',
    disappearingMessages: 'all',
  });
const [settings,setSettings] = useState({
  isAnnouncementOnly: false
})
  // ── Disappearing messages ──────────────────────────────────────────
  const [disappearingMode, setDisappearingMode] = useState('off');

  // ── Invite link ────────────────────────────────────────────────────
  const [inviteLink, setInviteLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── Admin management ───────────────────────────────────────────────
  const [adminLoading, setAdminLoading] = useState<string | null>(null);

  // ── Share Invite ───────────────────────────────────────────────────
  const [shareOpen, setShareOpen] = useState(false);

  // ── Invite Modal ───────────────────────────────────────────────────
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // ── Save / Delete ──────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // ── Avatar upload ──────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Cropper states
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSrc, setCropperSrc] = useState('');

  // Derived
  const rawOwnerId = group?.owner?.id || group?.owner?._id || group?.owner || '';
  const rawUserId = (user as any)?.id || (user as any)?._id || '';
  
  const ownerId = String(rawOwnerId);
  const currentUserId = String(rawUserId);
  const isOwner = !!rawUserId && currentUserId === ownerId;

  const adminIds = new Set<string>(
    (group?.admins || []).map((a: any) => String(a.id || a._id || a))
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
      setPermissions({
        // onlyAdminsCanMessage: group.permissions?.onlyAdminsCanMessage ?? false,
        // onlyAdminsCanEditInfo: group.permissions?.onlyAdminsCanEditInfo ?? false,
        editGroupInfo: group.permissions?.editGroupInfo || 'all',
        addMembers: group.permissions?.addMembers || 'all',
        removeMembers: group.permissions?.removeMembers || 'admins',
        startCalls: group.permissions?.startCalls || 'all',
        manageMessages: group.permissions?.manageMessages || 'admins',
        disappearingMessages: group.permissions?.disappearingMessages || 'all',
      });
      setSettings({
        isAnnouncementOnly: group.settings?.isAnnouncementOnly || false,
      });
      // Always sync disappearingMode from the group — after a successful save
      // the optimistic SWR patch in updateDisappearingMessages ensures group.disappearingMode
      // already reflects the new value, so this is always correct.
      // disappearingMode lives on the nested conversationId object per the API response
      setDisappearingMode(group.conversationId?.disappearingMode || group.disappearingMode || 'off');
      
      let link = group.inviteLink;
      if (!link) {
        const code = group.inviteCode || group.inviteToken;
        if (code) {
          link = `${window.location.origin}/group/invite/${code}`;
        }
      }
      setInviteLink(link || '');
      
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
        permissions,
        settings,
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
    try {
      setDeleting(true);
      await deleteGroup(group._id);
      toast.success('Group deleted successfully');
      setDeleteModalOpen(false);
      onClose();
      router.push(paths.dashboard.chat);
    } catch {
      toast.error('Failed to delete group');
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateLink = async () => {
    try {
      setGeneratingLink(true);
      const res = await generateGroupInviteLink(group._id);
      
      let link = res?.data?.inviteLink || res?.inviteLink;
      if (!link) {
        const code = res?.data?.inviteCode || res?.data?.token;
        if (code) {
          link = `${window.location.origin}/group/invite/${code}`;
        }
      }
      
      setInviteLink(link || '');
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

  const handleCroppedAvatarUpload = useCallback(
    async (croppedFile: File) => {
      const previewUrl = URL.createObjectURL(croppedFile);
      setGroupAvatarPreview(previewUrl);

      try {
        setAvatarUploading(true);
        const formData = new FormData();
        formData.append('avatar', croppedFile);
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
        setGroupAvatarPreview(groupAvatar);
        toast.error('Failed to upload group photo');
      } finally {
        setAvatarUploading(false);
      }
    },
    [group._id, groupAvatar]
  );

  const handleAvatarFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file (JPG, PNG, WebP)');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be less than 10MB');
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setCropperSrc(previewUrl);
      setCropperOpen(true);

      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    []
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

  const PERM_CONFIG = [
    // { key: 'onlyAdminsCanMessage', type: 'boolean', label: 'Send Messages', descOn: 'Regular members cannot send messages', descOff: 'All members can send messages', icon: 'solar:chat-round-bold', color: 'primary' },
    // { key: 'onlyAdminsCanEditInfo', type: 'boolean', label: 'Edit Group Info (Legacy)', descOn: 'Group name, avatar locked to admins', descOff: 'All members can edit group info', icon: 'solar:pen-new-square-bold', color: 'warning' },
    { key: 'editGroupInfo', type: 'string', label: 'Edit Group Info', descOn: 'Only admins can edit info', descOff: 'All members can edit info', icon: 'solar:pen-new-square-bold', color: 'warning' },
    { key: 'addMembers', type: 'string', label: 'Add Members', descOn: 'Only admins can add members', descOff: 'All members can add members', icon: 'solar:user-plus-bold', color: 'primary' },
    { key: 'removeMembers', type: 'string', label: 'Remove Members', descOn: 'Only admins can remove members', descOff: 'All members can remove members', icon: 'solar:user-minus-bold', color: 'error' },
    { key: 'startCalls', type: 'string', label: 'Start Calls', descOn: 'Only admins can start calls', descOff: 'All members can start calls', icon: 'solar:phone-bold', color: 'success' },
    { key: 'manageMessages', type: 'string', label: 'Manage Messages', descOn: 'Only admins can manage messages', descOff: 'All members can manage messages', icon: 'solar:chat-round-dots-bold', color: 'info' },
    { key: 'disappearingMessages', type: 'string', label: 'Disappearing Messages', descOn: 'Only admins can change disappearing settings', descOff: 'All members can change disappearing settings', icon: 'solar:clock-circle-bold', color: 'secondary' },
  ] as const;

  const renderPermissionsTab = (
    <Stack spacing={2}>
      {PERM_CONFIG.map((conf) => {
         const val = permissions[conf.key as keyof typeof permissions];
       const isChecked = val === 'admins';

        return (
          <Box key={conf.key} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.neutral' }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
              <Iconify icon={conf.icon} width={20} sx={{ color: `${conf.color}.main` }} />
              <Typography variant="subtitle2">{conf.label}</Typography>
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={isChecked}
                  onChange={(e) => {
                    const {checked} = e.target;
                    const newValue = checked ? 'admins' : 'all';
                    setPermissions((prev) => ({
                      ...prev,
                      [conf.key]: newValue,
                    }));
                  }}
                  color={conf.color as any}
                />
              }
              label={
                <Stack>
                  <Typography variant="body2">Only admins &amp; owner</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {isChecked ? conf.descOn : conf.descOff}
                  </Typography>
                </Stack>
              }
              sx={{ mx: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
            />
          </Box>
        );
      })}
      <Box key='setting-announce' sx={{ p: 2, borderRadius: 2, bgcolor: 'background.neutral' }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
              <Iconify icon='solar:chat-round-dots-bold' width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle2">Allow Users</Typography>
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.isAnnouncementOnly}
                  onChange={(e) => {
                    const {checked} = e.target;
                    setSettings((prev) => ({
                      ...prev,
                      isAnnouncementOnly: checked,
                    }));
                  }}
                  color="primary"
                />
              }
              label={
                <Stack>
                  <Typography variant="body2">Only admins &amp; owner</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {settings.isAnnouncementOnly ? "Users can only view announcements" : "Users can participate in discussions"}
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
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<Iconify icon="solar:restart-bold" width={16} />}
              onClick={handleGenerateLink}
              disabled={generatingLink}
              sx={{ flexGrow: 1 }}
            >
              Regenerate Link
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<Iconify icon="solar:share-bold" width={16} />}
              onClick={() => setShareOpen(true)}
              sx={{ flexGrow: 1 }}
            >
              Share to Chat
            </Button>
          </Stack>
        </Stack>
      ) : (
        <LoadingButton
          variant="contained"
          loading={generatingLink}
          onClick={handleGenerateLink}
          startIcon={<Iconify icon="solar:link-bold" width={18} />}
          fullWidth
        >
          Generate Basic Invite Link
        </LoadingButton>
      )}

      <Divider sx={{ my: 1 }} />
      
      <Box sx={{ mt: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Advanced Invites (Beta)</Typography>
          <Button
            size="small"
            variant="soft"
            onClick={() => setInviteModalOpen(true)}
            startIcon={<Iconify icon="solar:plus-bold" width={16} />}
          >
            Create
          </Button>
        </Stack>
        <InviteList roomId={group._id} />
      </Box>

      {inviteModalOpen && (
        <InviteModal
          open={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          roomId={group._id}
        />
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

      {/* Footer — show Save/Delete on General and Permissions tabs */}
      {(activeTab === 0 || activeTab === 1) && (
        <DialogActions sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between' }}>
          {activeTab === 0 && isOwner ? (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setDeleteModalOpen(true)}
              startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
            >
              Delete Group
            </Button>
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
      {shareOpen && (
        <ChatShareInviteDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          groupData={group}
          inviteLink={inviteLink}
        />
      )}

      <ConfirmDialog
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Group"
        content="Are you sure you want to delete this group? All messages and media will be permanently removed for all members. This cannot be undone."
        action={
          <LoadingButton
            variant="contained"
            color="error"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete
          </LoadingButton>
        }
      />

      {cropperOpen && (
        <ImageCropperDialog
          open={cropperOpen}
          onClose={() => setCropperOpen(false)}
          imageSrc={cropperSrc}
          onCrop={handleCroppedAvatarUpload}
          title="Crop Group Photo"
        />
      )}
    </Dialog>
  );
}
