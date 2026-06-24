import type { IChatParticipant } from 'src/types/chat';

import useSWR from 'swr';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { fetcher } from 'src/utils/axios';

import { useCall } from 'src/call';
import { useSocket } from 'src/socket';
import { useAuthStore } from 'src/store/useAuthStore';
import { blockUser, unblockUser } from 'src/api/user';
import { useGetGroups, addMembersToGroup } from 'src/actions/group';
import {
  useGetContacts,
  muteConversation,
  useGetConversations,
  setConversationDisappearingMode,
} from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

import { ChatGroupCreateDialog } from './chat-group-create-dialog';
import { ChatAvatarPreviewDialog } from './chat-avatar-preview-dialog';

// ----------------------------------------------------------------------

const DISAPPEARING_OPTIONS = [
  { value: 'off', label: 'Off', icon: 'solar:close-circle-bold' },
  { value: '24h', label: '24 Hours', icon: 'solar:clock-circle-bold' },
  { value: '7d', label: '7 Days', icon: 'solar:calendar-bold' },
  { value: '30d', label: '30 Days', icon: 'solar:calendar-mark-bold' },
];

// ----------------------------------------------------------------------

type Props = {
  participant: IChatParticipant;
};

export function ChatRoomSingle({ participant }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('id') || '';

  const { startCall } = useCall();
  const { onlineUsers } = useSocket();
  const { user } = useMockedUser();
  const { user: currentUser, toggleBlockUser } = useAuthStore();
  const { conversations } = useGetConversations();
  const { contacts } = useGetContacts();
  const { groups } = useGetGroups();

  // ── Disappearing messages ─────────────────────────────────────────────
  const { data: rawConversationsData } = useSWR<any>('/api/v1/chats/conversations', fetcher);
  const rawConvEntry = (rawConversationsData?.data || []).find((c: any) => c._id === conversationId);
  const rawDisappearingMode: string = rawConvEntry?.disappearingMode || 'off';
  const [localDisappearingMode, setLocalDisappearingMode] = useState<string>('off');
  const activeDisappearingMode = localDisappearingMode !== 'off' ? localDisappearingMode : rawDisappearingMode;

  // ── UI toggles ────────────────────────────────────────────────────────
  const [showDisappearing, setShowDisappearing] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);

  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatarPreviewOpen(true);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────
  const isMe = user?.id === participant?.id;
  
  const isContact = contacts.some((c: any) => c.id === participant?.id || c._id === participant?.id);
  const lastSeenPrivacy = participant?.privacy?.lastSeen || 'everyone';
  const canSeeLastSeen = lastSeenPrivacy === 'everyone' || (lastSeenPrivacy === 'contacts' && isContact);
  
  const isOnline = canSeeLastSeen ? onlineUsers.has(participant?.id) : false;
  
  const isBlocked = currentUser?.blockedUsers?.includes(participant?.id) ?? false;
  const currentUserId = user?.id || (user as any)?._id || '';

  // isMuted from conversation list
  const currentConvMapped = conversations.byId[conversationId];
  const isMuted = currentConvMapped?.isMuted || false;

  // ── Shared groups — groups containing this participant ────────────────
  const sharedGroups = useMemo(() => groups.filter((g: any) => {
      const allIds = [
        ...(g.admins || []).map((a: any) => a._id || a.id || a),
        ...(g.members || []).map((m: any) => m._id || m.id || m),
      ];
      return allIds.includes(participant?.id);
    }), [groups, participant?.id]);

  // Groups where current user is admin/owner — for "Add to Group"
  const myAdminGroups = useMemo(() => groups.filter((g: any) => {
      const ownerId = g.owner?._id || g.owner?.id || g.owner;
      const adminIds = (g.admins || []).map((a: any) => a._id || a.id || a);
      const isAdminOrOwner = currentUserId === ownerId || adminIds.includes(currentUserId);
      if (!isAdminOrOwner) return false;
      // Only show groups participant is NOT already in
      const allMemberIds = [
        ...(g.admins || []).map((a: any) => a._id || a.id || a),
        ...(g.members || []).map((m: any) => m._id || m.id || m),
      ];
      return !allMemberIds.includes(participant?.id);
    }), [groups, currentUserId, participant?.id]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleMessage = useCallback(() => {
    const existingConv = conversations.allIds.find((convId) => {
      const conv = conversations.byId[convId];
      if (!conv || conv.type === 'GROUP' || conv.type === 'group') return false;
      return conv.participants.some((p: any) => p.id === participant?.id);
    });
    router.push(existingConv
      ? `${paths.dashboard.chat}?id=${existingConv}`
      : `${paths.dashboard.chat}?id=${participant?.id}`
    );
  }, [conversations, participant?.id, router]);

  const handleAudioCall = useCallback(() => {
    if (isMe || !participant?.id) return;
    startCall([participant.id], 'audio', participant.name, participant.avatarUrl);
  }, [isMe, participant?.id, participant?.name, participant?.avatarUrl, startCall]);

  const handleVideoCall = useCallback(() => {
    if (isMe || !participant?.id) return;
    startCall([participant.id], 'video', participant.name, participant.avatarUrl);
  }, [isMe, participant?.id, participant?.name, participant?.avatarUrl, startCall]);

  const handleToggleBlock = useCallback(async () => {
    if (!participant?.id || blockLoading) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await unblockUser(participant.id);
        toast.success(`Unblocked ${participant.name}`);
      } else {
        await blockUser(participant.id);
        toast.success(`Blocked ${participant.name}`);
      }
      toggleBlockUser(participant.id, !isBlocked);
    } catch {
      toast.error('Failed to update block status');
    } finally {
      setBlockLoading(false);
    }
  }, [participant?.id, participant?.name, isBlocked, blockLoading, toggleBlockUser]);

  const handleToggleMute = useCallback(async () => {
    if (!conversationId) return;
    setMuteLoading(true);
    try {
      await muteConversation(conversationId, !isMuted);
      toast.success(isMuted ? 'Notifications unmuted' : 'Notifications muted');
    } catch {
      toast.error('Failed to update mute status');
    } finally {
      setMuteLoading(false);
    }
  }, [conversationId, isMuted]);

  const handleDisappearingMode = useCallback(async (mode: string) => {
    if (!conversationId) return;
    try {
      await setConversationDisappearingMode(conversationId, mode);
      setLocalDisappearingMode(mode);
      toast.success(
        mode === 'off'
          ? 'Disappearing messages turned off'
          : `Messages will disappear after ${DISAPPEARING_OPTIONS.find((o) => o.value === mode)?.label}`
      );
    } catch {
      toast.error('Failed to update disappearing messages');
    } finally {
      setShowDisappearing(false);
    }
  }, [conversationId]);

  const handleAddToGroup = useCallback(async (groupId: string, groupName: string) => {
    if (!participant?.id) return;
    setAddingToGroupId(groupId);
    try {
      await addMembersToGroup(groupId, [participant.id]);
      toast.success(`${participant.name} added to ${groupName}`);
      setAddGroupOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add to group');
    } finally {
      setAddingToGroupId(null);
    }
  }, [participant?.id, participant?.name]);

  const handleViewGroup = useCallback((g: any) => {
    const convId = g.conversationId?._id || g.conversationId;
    if (convId) router.push(`${paths.dashboard.chat}?id=${convId}`);
  }, [router]);

  if (!participant) return null;

  // ── Action buttons (5: Message, Audio, Video, New Group, Add Group) ───
  const ACTION_BUTTONS = [
    {
      key: 'message',
      icon: 'solar:chat-round-dots-bold',
      label: 'Message',
      color: 'primary.main',
      bgColor: 'primary.soft',
      onClick: handleMessage,
      disabled: isMe,
    },
    {
      key: 'audio',
      icon: 'solar:phone-bold',
      label: 'Audio',
      color: 'success.main',
      bgColor: 'success.soft',
      onClick: handleAudioCall,
      disabled: isMe,
    },
    {
      key: 'video',
      icon: 'solar:videocamera-record-bold',
      label: 'Video',
      color: 'info.main',
      bgColor: 'info.soft',
      onClick: handleVideoCall,
      disabled: isMe,
    },
    {
      key: 'new-group',
      icon: 'solar:users-group-two-rounded-bold',
      label: 'New Group',
      color: 'warning.main',
      bgColor: 'warning.soft',
      onClick: () => setNewGroupOpen(true),
      disabled: isMe,
    },
    {
      key: 'add-group',
      icon: 'solar:user-plus-bold',
      label: 'Add Group',
      color: 'secondary.main',
      bgColor: 'secondary.soft',
      onClick: () => setAddGroupOpen(true),
      disabled: isMe || myAdminGroups.length === 0,
    },
  ];

  return (
    <Box>
      {/* ── Avatar & identity ────────────────────────────────────────── */}
      <Stack alignItems="center" sx={{ py: 4, px: 2, bgcolor: 'background.default' }}>
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: isOnline ? 'success.main' : 'text.disabled',
                border: '2px solid',
                borderColor: 'background.paper',
              }}
            />
          }
        >
          <Avatar
            src={participant.avatarUrl}
            alt={participant.name}
            onClick={handleAvatarClick}
            sx={{
              width: 80,
              height: 80,
              cursor: 'pointer',
              '&:hover': { opacity: 0.85 },
              border: (theme) => `3px solid ${theme.vars.palette.background.paper}`,
              boxShadow: (theme) => `0 0 0 3px ${theme.vars.palette.primary.main}22`,
            }}
          />
        </Badge>

        <Typography variant="subtitle1" sx={{ mt: 1.5, fontWeight: 700 }}>
          {participant.name}
        </Typography>

        {participant.username && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            @{participant.username}
          </Typography>
        )}

        {canSeeLastSeen && (
          <Typography
            variant="caption"
            sx={{ mt: 0.5, color: isOnline ? 'success.main' : 'text.disabled', fontWeight: 600 }}
          >
            {isOnline ? '● Online' : '● Offline'}
          </Typography>
        )}
      </Stack>

      <Divider />

      {/* ── Quick action buttons ─────────────────────────────────────── */}
      <Stack
        direction="row"
        justifyContent="center"
        flexWrap="wrap"
        gap={2}
        sx={{ py: 2.5, px: 2 }}
      >
        {ACTION_BUTTONS.map((btn) => (
          <Tooltip key={btn.key} title={btn.disabled && btn.key === 'add-group' && myAdminGroups.length === 0 ? 'No groups to add to' : btn.label} placement="top">
            <span>
              <Stack alignItems="center" spacing={0.75}>
                <IconButton
                  onClick={btn.onClick}
                  disabled={btn.disabled}
                  size="medium"
                  sx={{
                    bgcolor: btn.bgColor,
                    color: btn.color,
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    '&:hover': { filter: 'brightness(0.92)' },
                    '&.Mui-disabled': { opacity: 0.4 },
                  }}
                >
                  <Iconify icon={btn.icon} width={20} />
                </IconButton>
                <Typography
                  variant="caption"
                  sx={{
                    color: btn.disabled ? 'text.disabled' : 'text.secondary',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {btn.label}
                </Typography>
              </Stack>
            </span>
          </Tooltip>
        ))}
      </Stack>

      <Divider />

      {/* ── Shared Groups ────────────────────────────────────────────── */}
      {sharedGroups.length > 0 && (
        <>
          <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="overline" sx={{ color: 'text.disabled', fontSize: 10 }}>
                Shared Groups
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {sharedGroups.length} found
              </Typography>
            </Stack>
          </Box>
          <List disablePadding dense>
            {sharedGroups.map((g: any) => (
              <ListItemButton key={g._id} onClick={() => handleViewGroup(g)} sx={{ px: 2.5, py: 1 }}>
                <Avatar
                  src={g.groupAvatar}
                  alt={g.groupName}
                  sx={{ width: 36, height: 36, mr: 1.5, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}
                >
                  {g.groupName?.charAt(0)?.toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={g.groupName}
                  secondary={`${(g.members?.length || 0) + (g.admins?.length || 0)} members`}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                  secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>
          <Divider />
        </>
      )}

      {/* ── About ────────────────────────────────────────────────────── */}
      {participant.role && (
        <>
          <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
            <Typography variant="overline" sx={{ color: 'text.disabled', fontSize: 10 }}>
              About
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: 'text.primary' }}>
              {participant.role}
            </Typography>
          </Box>
          <Divider />
        </>
      )}

      {/* ── Action rows ─────────────────────────────────────────────── */}
      <List disablePadding>
        {/* Mute */}
        <ListItemButton
          onClick={handleToggleMute}
          disabled={muteLoading || !conversationId}
          sx={{ px: 2.5, py: 1.5 }}
        >
          <Iconify icon={isMuted ? 'solar:bell-bold' : 'solar:bell-off-bold'} width={20} sx={{ mr: 2, color: 'text.secondary', flexShrink: 0 }} />
          <ListItemText primary={isMuted ? 'Unmute Notifications' : 'Mute Notifications'} primaryTypographyProps={{ variant: 'body2' }} />
          <Iconify icon="eva:chevron-right-fill" width={18} sx={{ color: 'text.disabled' }} />
        </ListItemButton>

        <Divider component="li" sx={{ mx: 2.5 }} />

        {/* Disappearing Messages */}
        <ListItemButton
          onClick={() => setShowDisappearing((v) => !v)}
          disabled={!conversationId}
          sx={{ px: 2.5, py: 1.5 }}
        >
          <Iconify icon="solar:clock-circle-bold" width={20} sx={{ mr: 2, color: 'text.secondary', flexShrink: 0 }} />
          <ListItemText primary="Disappearing Messages" primaryTypographyProps={{ variant: 'body2' }} />
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {activeDisappearingMode !== 'off' && (
              <Box sx={{ fontSize: 10, fontWeight: 700, px: 0.75, py: 0.25, borderRadius: 0.75, bgcolor: 'primary.soft', color: 'primary.main' }}>
                {activeDisappearingMode}
              </Box>
            )}
            <Iconify icon={showDisappearing ? 'eva:chevron-down-fill' : 'eva:chevron-right-fill'} width={18} sx={{ color: 'text.disabled' }} />
          </Stack>
        </ListItemButton>

        <Collapse in={showDisappearing}>
          <Box sx={{ bgcolor: 'background.neutral', mx: 2, mb: 1, borderRadius: 1.5, overflow: 'hidden' }}>
            {DISAPPEARING_OPTIONS.map((opt) => {
              const isSelected = activeDisappearingMode === opt.value;
              return (
                <ListItemButton key={opt.value} onClick={() => handleDisappearingMode(opt.value)} sx={{ px: 2, py: 1, bgcolor: isSelected ? 'primary.soft' : 'transparent' }}>
                  <Iconify icon={opt.icon} width={18} sx={{ mr: 1.5, color: isSelected ? 'primary.main' : 'text.disabled', flexShrink: 0 }} />
                  <ListItemText primary={opt.label} primaryTypographyProps={{ variant: 'body2', fontWeight: isSelected ? 700 : 400, color: isSelected ? 'primary.main' : 'text.primary' }} />
                  {isSelected && <Iconify icon="solar:check-circle-bold" width={16} sx={{ color: 'primary.main' }} />}
                </ListItemButton>
              );
            })}
          </Box>
        </Collapse>

        <Divider component="li" sx={{ mx: 2.5 }} />

        {/* Block */}
        <ListItemButton onClick={handleToggleBlock} disabled={blockLoading || isMe} sx={{ px: 2.5, py: 1.5 }}>
          <Iconify icon="solar:forbidden-circle-bold" width={20} sx={{ mr: 2, color: isBlocked ? 'warning.main' : 'error.main', flexShrink: 0 }} />
          <ListItemText
            primary={blockLoading ? (isBlocked ? 'Unblocking...' : 'Blocking...') : isBlocked ? `Unblock ${participant.name}` : `Block ${participant.name}`}
            primaryTypographyProps={{ variant: 'body2', color: isBlocked ? 'warning.main' : 'error.main', fontWeight: 600 }}
          />
        </ListItemButton>
      </List>

      {/* ── New Group Dialog ─────────────────────────────────────────── */}
      <ChatGroupCreateDialog
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        chatContacts={contacts}
        preSelectedIds={participant?.id ? [participant.id] : []}
      />

      {/* ── Add to Group Dialog ──────────────────────────────────────── */}
      <Dialog
        open={addGroupOpen}
        onClose={() => setAddGroupOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Iconify icon="solar:user-plus-bold-duotone" width={24} sx={{ color: 'primary.main' }} />
          <Stack flex={1}>
            <Typography variant="h6">Add to Group</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Add {participant.name} to one of your groups
            </Typography>
          </Stack>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 0 }}>
          {myAdminGroups.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6, px: 3 }}>
              <Iconify icon="solar:users-group-two-rounded-bold" width={48} sx={{ color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                No groups available — either you&apos;re not an admin or {participant.name} is already in all your groups.
              </Typography>
            </Stack>
          ) : (
            <List disablePadding>
              {myAdminGroups.map((g: any) => {
                const memberCount = (g.members?.length || 0) + (g.admins?.length || 0);
                const isAdding = addingToGroupId === g._id;
                return (
                  <Box key={g._id}>
                    <ListItemButton
                      sx={{ px: 2.5, py: 1.5 }}
                      onClick={() => handleAddToGroup(g._id, g.groupName)}
                      disabled={!!addingToGroupId}
                    >
                      <Avatar
                        src={g.groupAvatar}
                        alt={g.groupName}
                        sx={{ width: 40, height: 40, mr: 1.5, bgcolor: 'primary.main', fontSize: 16, fontWeight: 700, flexShrink: 0 }}
                      >
                        {g.groupName?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <ListItemText
                        primary={g.groupName}
                        secondary={`${memberCount} member${memberCount !== 1 ? 's' : ''}`}
                        primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                        secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                      />
                      {isAdding ? (
                        <Iconify icon="svg-spinners:ring-resize" width={20} sx={{ color: 'primary.main', flexShrink: 0 }} />
                      ) : (
                        <Iconify icon="solar:user-plus-bold" width={20} sx={{ color: 'primary.main', flexShrink: 0 }} />
                      )}
                    </ListItemButton>
                    <Divider component="li" sx={{ mx: 2.5 }} />
                  </Box>
                );
              })}
            </List>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" color="inherit" onClick={() => setAddGroupOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <ChatAvatarPreviewDialog
        open={avatarPreviewOpen}
        onClose={() => setAvatarPreviewOpen(false)}
        name={participant.name}
        avatarUrl={participant.avatarUrl}
      />
    </Box>
  );
}
