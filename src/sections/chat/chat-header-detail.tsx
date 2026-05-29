import type { IChatParticipant } from 'src/types/chat';

import { useCallback } from 'react';

import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import AvatarGroup, { avatarGroupClasses } from '@mui/material/AvatarGroup';

import { useSearchParams } from 'src/routes/hooks';

import { useResponsive } from 'src/hooks/use-responsive';

import { fToNow } from 'src/utils/format-time';

import { useCall } from 'src/call';
import { useSocket } from 'src/socket';

import { Iconify } from 'src/components/iconify';
import { usePopover, CustomPopover } from 'src/components/custom-popover';

import { ChatHeaderSkeleton } from './chat-skeleton';

import type { UseNavCollapseReturn } from './hooks/use-collapse-nav';

// ----------------------------------------------------------------------

type Props = {
  loading: boolean;
  participants: IChatParticipant[];
  collapseNav: UseNavCollapseReturn;
};

export function ChatHeaderDetail({ collapseNav, participants, loading }: Props) {
  const popover = usePopover();
  const { startCall } = useCall();

  const searchParams = useSearchParams();
  const conversationId = searchParams.get('id') || '';
  const { recordingUsers, typingUsers, onlineUsers } = useSocket();

  const lgUp = useResponsive('up', 'lg');

  const group = participants.length > 1;

  const singleParticipant = participants[0];
  
  const isRecording = (recordingUsers[conversationId] || []).includes(singleParticipant?.id);
  const isTyping = (typingUsers[conversationId] || []).includes(singleParticipant?.id);
  const isRealtimeOnline = onlineUsers.has(singleParticipant?.id);
  
  const statusToDisplay = isRealtimeOnline ? 'online' : singleParticipant?.status;

  const { collapseDesktop, onCollapseDesktop, onOpenMobile } = collapseNav;

  const handleToggleNav = useCallback(() => {
    if (lgUp) {
      onCollapseDesktop();
    } else {
      onOpenMobile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lgUp]);

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

      <Stack direction="row" flexGrow={1} justifyContent="flex-end">
        <IconButton onClick={handleAudioCall} title="Start audio call">
          <Iconify icon="solar:phone-bold" />
        </IconButton>

        <IconButton onClick={handleVideoCall} title="Start video call">
          <Iconify icon="solar:videocamera-record-bold" />
        </IconButton>

        <IconButton onClick={handleToggleNav}>
          <Iconify icon={!collapseDesktop ? 'ri:sidebar-unfold-fill' : 'ri:sidebar-fold-fill'} />
        </IconButton>

        <IconButton onClick={popover.onOpen}>
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
            onClick={() => {
              popover.onClose();
            }}
          >
            <Iconify icon="solar:forbidden-circle-bold" />
            Block
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
