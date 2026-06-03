import type { IChatParticipant } from 'src/types/chat';

import { useState, useCallback } from 'react';

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

import { useSearchParams } from 'src/routes/hooks';

import { useResponsive } from 'src/hooks/use-responsive';

import { fToNow } from 'src/utils/format-time';

import { useCall } from 'src/call';
import { useSocket } from 'src/socket';
import { useAuthStore } from 'src/store/useAuthStore';
import { blockUser, unblockUser } from 'src/api/user';

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
  const { startCall } = useCall();

  const searchParams = useSearchParams();
  const conversationId = searchParams.get('id') || '';
  const { recordingUsers, typingUsers, onlineUsers } = useSocket();

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


  const group = participants.length > 1;

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

  const renderGroup = (
    <AvatarGroup max={3} sx={{ [`& .${avatarGroupClasses.avatar}`]: { width: 32, height: 32 } }}>
      {participants.map((participant) => (
        <Avatar key={participant.id} alt={participant.name} src={participant.avatarUrl} />
      ))}
    </AvatarGroup>
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

        <IconButton onClick={handleToggleNav} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
          <Iconify icon={!collapseDesktop ? 'ri:sidebar-unfold-fill' : 'ri:sidebar-fold-fill'} />
        </IconButton>

        <IconButton onClick={popover.onOpen} disabled={!isUserMember}>
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </Stack>

      <CustomPopover open={popover.open} anchorEl={popover.anchorEl} onClose={popover.onClose}>
        <MenuList>
          <MenuItem
            onClick={() => {
              popover.onClose();
            }}
          >
            <Iconify icon="solar:bell-off-bold" />
            Hide notifications
          </MenuItem>

          <MenuItem
            onClick={handleToggleBlock}
            disabled={blockLoading || group}
            sx={isBlocked ? { color: 'warning.main' } : {}}
          >
            <Iconify icon={isBlocked ? 'solar:forbidden-circle-bold' : 'solar:forbidden-circle-bold'} />
            {blockLoading ? (isBlocked ? 'Unblocking...' : 'Blocking...') : isBlocked ? 'Unblock' : 'Block'}
          </MenuItem>

          <MenuItem
            onClick={() => {
              popover.onClose();
            }}
          >
            <Iconify icon="solar:danger-triangle-bold" />
            Report
          </MenuItem>

          <Divider sx={{ borderStyle: 'dashed' }} />

          <MenuItem
            onClick={() => {
              popover.onClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
            Delete
          </MenuItem>
        </MenuList>
      </CustomPopover>
    </>
  );
}
