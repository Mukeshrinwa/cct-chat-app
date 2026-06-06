import type { IChatParticipant } from 'src/types/chat';

import useSWR from 'swr';
import { useRef, useState, useCallback } from 'react';

import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import AvatarGroup, { avatarGroupClasses } from '@mui/material/AvatarGroup';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useResponsive } from 'src/hooks/use-responsive';

import { fetcher } from 'src/utils/axios';
import { fToNow } from 'src/utils/format-time';

import { useCall } from 'src/call';
import { useSocket } from 'src/socket';
import { useGetGroups } from 'src/actions/group';
import { useAuthStore } from 'src/store/useAuthStore';
import { blockUser, unblockUser } from 'src/api/user';
import { useGroupStore } from 'src/store/useGroupStore';
import { 
  clearChat, 
  pinConversation, 
  muteConversation, 
  deleteConversation,
  useGetConversation, 
  archiveConversation,
  setConversationDisappearingMode,
} from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { usePopover, CustomPopover } from 'src/components/custom-popover';

import { ChatHeaderSkeleton } from './chat-skeleton';

import type { UseNavCollapseReturn } from './hooks/use-collapse-nav';

// ----------------------------------------------------------------------

type Props = {
  loading: boolean;
  participants: IChatParticipant[];
  collapseNav: UseNavCollapseReturn;
  isUserMember?: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
};

export function ChatHeaderDetail({
  collapseNav,
  participants,
  loading,
  isUserMember = true,
  searchQuery,
  onSearchQueryChange,
}: Props) {
  const popover = usePopover();
  const disappearingPopover = usePopover();
  const disappearingAnchorRef = useRef<HTMLLIElement>(null);
  const { startCall } = useCall();

  const router = useRouter();

  const searchParams = useSearchParams();
  const conversationId = searchParams.get('id') || '';
  const { recordingUsers, typingUsers, onlineUsers } = useSocket();

  const { conversation } = useGetConversation(conversationId);

  const isMuted = conversation?.isMuted || false;
  const isPinned = conversation?.isPinned || false;
  const isArchived = conversation?.isArchived || false;

  // Read disappearingMode directly from the raw conversations-list SWR cache
  // (the mapped IChatConversation strips unknown fields, but raw data has it)
  const { data: rawConversationsData } = useSWR<any>('/api/v1/chats/conversations', fetcher);
  const rawConversationEntry = (rawConversationsData?.data || []).find(
    (c: any) => c._id === conversationId
  );
  const rawDisappearingMode: string = rawConversationEntry?.disappearingMode || 'off';

  // Local state tracks changes the user just made (before SWR revalidates)
  const [disappearingMode, setDisappearingModeLocal] = useState<string>('off');

  const { user: currentUser, toggleBlockUser } = useAuthStore();
  const [blockLoading, setBlockLoading] = useState(false);

  const lgUp = useResponsive('up', 'lg');

  const { collapseDesktop, onCollapseDesktop, onOpenMobile } = collapseNav;

  const handleToggleNav = useCallback(() => {
    if (lgUp) {
      onCollapseDesktop();
    } else {
      onOpenMobile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lgUp]);

  const { groups } = useGetGroups();
  const groupStoreGroups = useGroupStore((state) => state.groups);

  const currentGroupFromList = groups.find(
    (g: any) =>
      g.conversationId?._id === conversationId ||
      g.conversationId === conversationId
  );

  const currentGroupFromStore = groupStoreGroups[conversationId];

  const currentGroup = currentGroupFromList || currentGroupFromStore || null;

  const group = currentGroup !== null || participants.length > 1;

  const singleParticipant = participants[0];

  const isBlocked = currentUser?.blockedUsers?.includes(singleParticipant?.id) ?? false;

  const isRecording = (recordingUsers[conversationId] || []).includes(singleParticipant?.id);
  const isTyping = (typingUsers[conversationId] || []).includes(singleParticipant?.id);
  const isRealtimeOnline = onlineUsers.has(singleParticipant?.id);
  
  const statusToDisplay = isRealtimeOnline ? 'online' : singleParticipant?.status;



  // Collect participant IDs — matches `id` field on IChatParticipant
  const participantIds = participants.map((p) => p.id);

  const handleAudioCall = useCallback(() => {
    if (!participantIds.length) return;
    startCall(participantIds, 'audio');
  }, [participantIds, startCall]);

  const handleVideoCall = useCallback(() => {
    if (!participantIds.length) return;
    startCall(participantIds, 'video');
  }, [participantIds, startCall]);

  const handleToggleBlock = useCallback(async () => {
    if (!singleParticipant?.id || blockLoading) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await unblockUser(singleParticipant.id);
      } else {
        await blockUser(singleParticipant.id);
      }
      toggleBlockUser(singleParticipant.id, !isBlocked);
    } catch (err) {
      console.error('[Block] toggle failed:', err);
    } finally {
      setBlockLoading(false);
      popover.onClose();
    }
  }, [singleParticipant?.id, isBlocked, blockLoading, toggleBlockUser, popover]);

  const handleMute = useCallback(async () => {
    try {
      await muteConversation(conversationId, !isMuted);
      toast.success(isMuted ? 'Chat unmuted' : 'Chat muted');
      popover.onClose();
    } catch (err) {
      toast.error('Failed to update mute status');
      console.error(err);
    }
  }, [conversationId, isMuted, popover]);

  const handlePin = useCallback(async () => {
    try {
      await pinConversation(conversationId, !isPinned);
      toast.success(isPinned ? 'Chat unpinned' : 'Chat pinned');
      popover.onClose();
    } catch (err) {
      toast.error('Failed to update pin status');
      console.error(err);
    }
  }, [conversationId, isPinned, popover]);

  const handleArchive = useCallback(async () => {
    try {
      await archiveConversation(conversationId, !isArchived);
      
      // Update local storage for client-side filtering compatibility
      try {
        const archivedStr = localStorage.getItem('cct_archived_conversations');
        let archived = archivedStr ? JSON.parse(archivedStr) : [];
        if (!Array.isArray(archived)) archived = [];
        
        const isCurrentlyArchived = archived.includes(conversationId);
        const updated = isCurrentlyArchived
          ? archived.filter((id: string) => id !== conversationId)
          : [...archived, conversationId];
          
        localStorage.setItem('cct_archived_conversations', JSON.stringify(updated));
        window.dispatchEvent(new Event('cct_archive_changed'));
      } catch (e) {
        console.error(e);
      }
      
      toast.success(isArchived ? 'Chat unarchived' : 'Chat archived');
      popover.onClose();
    } catch (err) {
      toast.error('Failed to update archive status');
      console.error(err);
    }
  }, [conversationId, isArchived, popover]);

  const handleClearChat = useCallback(async () => {
    try {
      await clearChat(conversationId);
      toast.success('Chat cleared');
      popover.onClose();
    } catch (err) {
      toast.error('Failed to clear chat');
      console.error(err);
    }
  }, [conversationId, popover]);

  const handleDeleteChat = useCallback(async () => {
    try {
      await deleteConversation(conversationId);
      toast.success('Chat deleted');
      popover.onClose();
      router.push(paths.dashboard.chat);
    } catch (err) {
      toast.error('Failed to delete chat');
      console.error(err);
    }
  }, [conversationId, popover, router]);

  const DISAPPEARING_OPTIONS = [
    { value: 'off', label: 'Off', icon: 'solar:close-circle-bold' },
    { value: '24h', label: '24 Hours', icon: 'solar:clock-circle-bold' },
    { value: '7d', label: '7 Days', icon: 'solar:calendar-bold' },
    { value: '30d', label: '30 Days', icon: 'solar:calendar-mark-bold' },
  ];

  const handleDisappearingMode = useCallback(async (mode: string) => {
    try {
      await setConversationDisappearingMode(conversationId, mode);
      setDisappearingModeLocal(mode);
      toast.success(
        mode === 'off'
          ? 'Disappearing messages turned off'
          : `Messages will disappear after ${DISAPPEARING_OPTIONS.find((o) => o.value === mode)?.label}`
      );
    } catch {
      toast.error('Failed to update disappearing messages');
    } finally {
      disappearingPopover.onClose();
      popover.onClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const renderGroup = (
    <Stack direction="row" alignItems="center" spacing={2}>
      {currentGroup?.groupAvatar ? (
        <Avatar
          src={currentGroup.groupAvatar}
          alt={currentGroup.groupName || 'Group'}
          sx={{ width: 40, height: 40 }}
        />
      ) : (
        <AvatarGroup max={3} sx={{ [`& .${avatarGroupClasses.avatar}`]: { width: 32, height: 32 } }}>
          {participants.map((participant) => (
            <Avatar key={participant.id} alt={participant.name} src={participant.avatarUrl} />
          ))}
        </AvatarGroup>
      )}

      <ListItemText
        primary={currentGroup?.groupName || 'Group Chat'}
        secondary={`${participants.length + (isUserMember ? 1 : 0)} members`}
        secondaryTypographyProps={{
          component: 'span',
          color: 'text.secondary',
        }}
      />
    </Stack>
  );

  const renderSingle = (
    <Stack direction="row" alignItems="center" spacing={2}>
      <Badge
        variant={statusToDisplay}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Avatar src={singleParticipant?.avatarUrl} alt={singleParticipant?.name} />
      </Badge>

      <ListItemText
        primary={singleParticipant?.name}
        secondary={
          isRecording ? (
            <span style={{ color: '#00a884', fontWeight: 600 }}>Recording audio... 🎙️</span>
          ) : isTyping ? (
            <span style={{ color: '#00a884', fontWeight: 600 }}>typing...</span>
          ) : statusToDisplay === 'offline' ? (
            fToNow(singleParticipant?.lastActivity)
          ) : (
            statusToDisplay
          )
        }
        secondaryTypographyProps={{
          component: 'span',
          ...(statusToDisplay !== 'offline' && !isRecording && !isTyping && { textTransform: 'capitalize' }),
        }}
      />
    </Stack>
  );

  if (loading) {
    return <ChatHeaderSkeleton />;
  }

  return (
    <>
      {group ? renderGroup : renderSingle}

      <Stack direction="row" flexGrow={1} justifyContent="flex-end" alignItems="center">
        <TextField
          size="small"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search chats..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled', width: 18, height: 18 }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearchQueryChange('')}>
                  <Iconify icon="eva:close-fill" sx={{ width: 18, height: 18 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            mr: 2,
            display: { xs: 'none', sm: 'inline-flex' },
            width: { xs: 120, sm: 180, md: 220 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
              bgcolor: 'background.neutral',
              '& fieldset': { border: 'none' },
            },
          }}
        />

        <IconButton onClick={handleAudioCall} disabled={!isUserMember} title="Start audio call">
          <Iconify icon="solar:phone-bold" />
        </IconButton>

        <IconButton onClick={handleVideoCall} disabled={!isUserMember} title="Start video call">
          <Iconify icon="solar:videocamera-record-bold" />
        </IconButton>

        <IconButton onClick={handleToggleNav}>
          <Iconify icon={!collapseDesktop ? 'ri:sidebar-unfold-fill' : 'ri:sidebar-fold-fill'} />
        </IconButton>

        <IconButton onClick={popover.onOpen} disabled={!isUserMember}>
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </Stack>

      <CustomPopover open={popover.open} anchorEl={popover.anchorEl} onClose={popover.onClose}>
        <MenuList>
          <MenuItem onClick={handleMute}>
            <Iconify icon={isMuted ? 'solar:bell-bold' : 'solar:bell-off-bold'} />
            {isMuted ? 'Unmute' : 'Mute'}
          </MenuItem>

          <MenuItem onClick={handlePin}>
            <Iconify icon={isPinned ? 'solar:pin-slash-bold' : 'solar:pin-bold'} />
            {isPinned ? 'Unpin' : 'Pin'}
          </MenuItem>

          <MenuItem onClick={handleArchive}>
            <Iconify icon={isArchived ? 'solar:archive-up-minimlistic-bold' : 'solar:archive-down-minimlistic-bold'} />
            {isArchived ? 'Unarchive' : 'Archive'}
          </MenuItem>

          {/* Disappearing Messages — for both direct and group chats */}
          <MenuItem
            ref={disappearingAnchorRef}
            onClick={disappearingPopover.onOpen}
            sx={{ justifyContent: 'space-between' }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:clock-circle-bold" />
              <span>Disappearing</span>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {(disappearingMode !== 'off' && disappearingMode !== rawDisappearingMode
                ? disappearingMode
                : rawDisappearingMode) !== 'off' && (
                <Stack
                  component="span"
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                    bgcolor: 'primary.soft',
                    color: 'primary.main',
                  }}
                >
                  {disappearingMode !== 'off' ? disappearingMode : rawDisappearingMode}
                </Stack>
              )}
              <Iconify icon="eva:chevron-right-fill" width={16} sx={{ color: 'text.disabled' }} />
            </Stack>
          </MenuItem>

          <MenuItem
            onClick={handleToggleBlock}
            disabled={blockLoading || !!group}
            sx={isBlocked ? { color: 'warning.main' } : {}}
          >
            <Iconify icon="solar:forbidden-circle-bold" />
            {blockLoading ? (isBlocked ? 'Unblocking...' : 'Blocking...') : isBlocked ? 'Unblock' : 'Block'}
          </MenuItem>

          <Divider sx={{ borderStyle: 'dashed' }} />

          <MenuItem onClick={handleClearChat} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" />
            Clear Chat
          </MenuItem>

          <MenuItem onClick={handleDeleteChat} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" />
            Delete Chat
          </MenuItem>
        </MenuList>
      </CustomPopover>

      {/* Disappearing messages sub-popover */}
      <CustomPopover
        open={disappearingPopover.open}
        anchorEl={disappearingAnchorRef.current}
        onClose={disappearingPopover.onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuList sx={{ minWidth: 160 }}>
          {[
            { value: 'off', label: 'Off', icon: 'solar:close-circle-bold' },
            { value: '24h', label: '24 Hours', icon: 'solar:clock-circle-bold' },
            { value: '7d', label: '7 Days', icon: 'solar:calendar-bold' },
            { value: '30d', label: '30 Days', icon: 'solar:calendar-mark-bold' },
          ].map((opt) => {
            const currentActive = disappearingMode !== 'off' ? disappearingMode : rawDisappearingMode;
            return (
              <MenuItem
                key={opt.value}
                onClick={() => handleDisappearingMode(opt.value)}
                selected={currentActive === opt.value}
                sx={currentActive === opt.value ? { color: 'primary.main', fontWeight: 700 } : {}}
              >
                <Iconify icon={opt.icon} sx={{ mr: 1.5, color: currentActive === opt.value ? 'primary.main' : 'text.disabled' }} />
                {opt.label}
                {currentActive === opt.value && (
                  <Iconify icon="solar:check-circle-bold" width={16} sx={{ ml: 'auto', color: 'primary.main' }} />
                )}
              </MenuItem>
            );
          })}
        </MenuList>
      </CustomPopover>
    </>
  );
}
