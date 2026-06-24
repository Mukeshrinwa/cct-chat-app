import type { IChatConversation } from 'src/types/chat';

import { useRef, useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AvatarGroup from '@mui/material/AvatarGroup';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useResponsive } from 'src/hooks/use-responsive';

import { fToNow } from 'src/utils/format-time';

import { useSocket } from 'src/socket';
import { useGetGroups } from 'src/actions/group';
import { useGroupStore } from 'src/store/useGroupStore';
import {
  useGetContacts,
  pinConversation,
  muteConversation,
  clickConversation,
  archiveConversation,
} from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

import { useNavItem } from './hooks/use-nav-item';
import { ChatAvatarPreviewDialog } from './chat-avatar-preview-dialog';

// ----------------------------------------------------------------------

type Props = {
  selected: boolean;
  collapse: boolean;
  onCloseMobile: () => void;
  conversation: IChatConversation;
  isArchived?: boolean;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
};

export function ChatNavItem({
  selected,
  collapse,
  conversation,
  onCloseMobile,
  isArchived,
  onArchive,
  onUnarchive
}: Props) {
  const [hovered, setHovered] = useState(false);
  const { user } = useMockedUser();
  const { onlineUsers } = useSocket();

  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAvatarPreviewOpen(true);
  }, []);

  const [menuAnchorPosition, setMenuAnchorPosition] = useState<{ x: number; y: number } | null>(null);

  const longPressTimerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);

  const startLongPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isLongPressRef.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setMenuAnchorPosition({ x: clientX, y: clientY });
    }, 600);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuAnchorPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMenuClose = () => {
    setMenuAnchorPosition(null);
  };

  const handleTogglePin = useCallback(async () => {
    try {
      const newPinned = !conversation.isPinned;
      await pinConversation(conversation.id, newPinned);
      toast.success(newPinned ? 'Chat pinned' : 'Chat unpinned');
    } catch (error) {
      console.error(error);
      toast.error('Failed to pin/unpin chat');
    }
  }, [conversation.id, conversation.isPinned]);

  const handleToggleMute = useCallback(async () => {
    try {
      const newMuted = !conversation.isMuted;
      await muteConversation(conversation.id, newMuted);
      toast.success(newMuted ? 'Chat muted' : 'Chat unmuted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to mute/unmute chat');
    }
  }, [conversation.id, conversation.isMuted]);

  const handleToggleArchive = useCallback(async () => {
    try {
      if (isArchived) {
        if (onUnarchive) {
          onUnarchive(conversation.id);
        } else {
          await archiveConversation(conversation.id, false);
        }
        toast.success('Chat unarchived');
      } else {
        if (onArchive) {
          onArchive(conversation.id);
        } else {
          await archiveConversation(conversation.id, true);
        }
        toast.success('Chat archived');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to archive/unarchive chat');
    }
  }, [conversation.id, isArchived, onArchive, onUnarchive]);

  const mdUp = useResponsive('up', 'md');

  const router = useRouter();

  const { group, displayName, displayText, participants, lastActivity } =
    useNavItem({ conversation, currentUserId: `${user?.id}` });

  const hasOnlineInGroup = group
    ? participants.some((item) => item.status === 'online' || onlineUsers.has(item.id))
    : false;

  const { groups } = useGetGroups();
  const groupStoreGroups = useGroupStore((state) => state.groups);

  const currentGroupFromList = groups.find(
    (g: any) =>
      g.conversationId?._id === conversation.id ||
      g.conversationId === conversation.id
  );

  const currentGroupFromStore = groupStoreGroups[conversation.id];

  const currentGroup = currentGroupFromList || currentGroupFromStore || null;

  const isGroup = conversation.type === 'GROUP' || conversation.type === 'group' || group || currentGroup !== null;

  const singleParticipant = participants[0];

  const name = singleParticipant?.name ?? '';
  const avatarUrl = singleParticipant?.avatarUrl ?? '';

  const { contacts } = useGetContacts();
  const isContact = useMemo(() => contacts.some((c: any) => c.id === singleParticipant?.id || c._id === singleParticipant?.id), [contacts, singleParticipant?.id]);

  const lastSeenPrivacy = singleParticipant?.privacy?.lastSeen || 'everyone';
  const canSeeLastSeen = lastSeenPrivacy === 'everyone' || (lastSeenPrivacy === 'contacts' && isContact);

  const isRealtimeOnline = singleParticipant ? onlineUsers.has(singleParticipant.id) : false;
  const actualStatus = isRealtimeOnline ? 'online' : (singleParticipant?.status ?? 'invisible');
  const status = canSeeLastSeen ? actualStatus : 'invisible';

  const handleClickConversation = useCallback(async () => {
    try {
      if (!mdUp) {
        onCloseMobile();
      }

      await clickConversation(conversation.id);

      router.push(`${paths.dashboard.chat}?id=${conversation.id}`);
    } catch (error) {
      console.error(error);
    }
  }, [conversation.id, mdUp, onCloseMobile, router]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    handleClickConversation();
  }, [handleClickConversation]);

  const renderGroup = (
    <Badge
      variant={hasOnlineInGroup ? 'online' : 'invisible'}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      onClick={handleAvatarClick}
      sx={{ cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
    >
      {currentGroup?.groupAvatar ? (
        <Avatar alt={currentGroup.groupName || 'Group'} src={currentGroup.groupAvatar} sx={{ width: 48, height: 48 }} />
      ) : (
        <AvatarGroup variant="compact" sx={{ width: 48, height: 48 }}>
          {participants.slice(0, 2).map((participant) => (
            <Avatar key={participant.id} alt={participant.name} src={participant.avatarUrl} />
          ))}
        </AvatarGroup>
      )}
    </Badge>
  );

  const renderSingle = (
    <Badge
      key={status}
      variant={status}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      onClick={handleAvatarClick}
      sx={{ cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
    >
      <Avatar alt={name} src={avatarUrl} sx={{ width: 48, height: 48 }} />
    </Badge>
  );

  return (
    <Box component="li" sx={{ display: 'flex' }}>
      <ListItemButton
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          cancelLongPress();
        }}
        sx={{
          py: 1.5,
          px: 2.5,
          gap: 2,
          ...(selected && { bgcolor: 'action.selected' }),
        }}
      >
        <Badge
          color="success"
          overlap="circular"
          badgeContent={conversation.unreadCount > 0 ? (conversation.unreadCount > 99 ? '99+' : conversation.unreadCount) : 0}
          max={999}
        >
          {isGroup ? renderGroup : renderSingle}
        </Badge>

        {!collapse && (
          <>
            <ListItemText
              primary={
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ maxWidth: 1 }}>
                  <Box component="span" sx={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {currentGroup?.groupName || displayName}
                  </Box>
                  {conversation.isMuted && (
                    <Iconify
                      icon="solar:bell-off-bold"
                      sx={{
                        width: 14,
                        height: 14,
                        color: 'text.disabled',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Stack>
              }
              primaryTypographyProps={{ component: 'div', variant: 'subtitle2' }}
              secondary={displayText}
              secondaryTypographyProps={{
                noWrap: true,
                component: 'span',
                variant: conversation.unreadCount ? 'subtitle2' : 'body2',
                color: conversation.unreadCount ? 'text.primary' : 'text.secondary',
              }}
            />

            <Stack alignItems="flex-end" sx={{ alignSelf: 'stretch', justifyContent: 'center', minWidth: 40 }}>
              {hovered ? (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isArchived) {
                      onUnarchive?.(conversation.id);
                    } else {
                      onArchive?.(conversation.id);
                    }
                  }}
                  sx={{
                    bgcolor: 'background.neutral',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Iconify
                    icon={isArchived ? 'solar:archive-up-minimlistic-bold' : 'solar:archive-down-minimlistic-bold'}
                    sx={{ width: 18, height: 18 }}
                  />
                </IconButton>
              ) : (
                <>
                  <Typography
                    noWrap
                    variant="body2"
                    component="span"
                    sx={{ mb: 1.5, fontSize: 12, color: 'text.disabled' }}
                  >
                    {fToNow(lastActivity)}
                  </Typography>

                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                    {conversation.isPinned && (
                      <Iconify
                        icon="solar:pin-bold"
                        sx={{
                          width: 16,
                          height: 16,
                          color: 'text.disabled',
                          transform: 'rotate(45deg)',
                        }}
                      />
                    )}

                    {conversation.isMuted && (
                      <Iconify
                        icon="solar:bell-off-bold"
                        sx={{
                          width: 16,
                          height: 16,
                          color: 'text.disabled',
                        }}
                      />
                    )}

                    {!!conversation.unreadCount && (
                      <Box
                        sx={{
                          minWidth: 18,
                          height: 18,
                          px: 0.5,
                          bgcolor: 'success.main',
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography
                          component="span"
                          sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'common.white',
                            lineHeight: 1,
                          }}
                        >
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </>
              )}
            </Stack>
          </>
        )}
      </ListItemButton>

      <Menu
        open={!!menuAnchorPosition}
        onClose={handleMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          menuAnchorPosition
            ? { top: menuAnchorPosition.y, left: menuAnchorPosition.x }
            : undefined
        }
        PaperProps={{
          sx: {
            width: 180,
            boxShadow: (theme) => theme.customShadows?.z16 || 6,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleTogglePin();
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <Iconify
              icon="solar:pin-bold"
              sx={{
                width: 20,
                height: 20,
                color: conversation.isPinned ? 'primary.main' : 'inherit',
                transform: conversation.isPinned ? 'rotate(0deg)' : 'rotate(45deg)',
              }}
            />
          </ListItemIcon>
          <ListItemText primary={conversation.isPinned ? 'Unpin' : 'Pin'} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleToggleMute();
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <Iconify
              icon={conversation.isMuted ? 'solar:bell-bold' : 'solar:bell-off-bold'}
              sx={{
                width: 20,
                height: 20,
                color: conversation.isMuted ? 'warning.main' : 'inherit',
              }}
            />
          </ListItemIcon>
          <ListItemText primary={conversation.isMuted ? 'Unmute' : 'Mute'} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleToggleArchive();
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <Iconify
              icon={isArchived ? 'solar:archive-up-minimlistic-bold' : 'solar:archive-down-minimlistic-bold'}
              sx={{
                width: 20,
                height: 20,
                color: isArchived ? 'info.main' : 'inherit',
              }}
            />
          </ListItemIcon>
          <ListItemText primary={isArchived ? 'Unarchive' : 'Archive'} />
        </MenuItem>
      </Menu>

      <ChatAvatarPreviewDialog
        open={avatarPreviewOpen}
        onClose={() => setAvatarPreviewOpen(false)}
        name={currentGroup?.groupName || displayName}
        avatarUrl={currentGroup?.groupAvatar || avatarUrl}
      />
    </Box>
  );
}
