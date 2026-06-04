import type { IChatConversation } from 'src/types/chat';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AvatarGroup from '@mui/material/AvatarGroup';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useResponsive } from 'src/hooks/use-responsive';

import { fToNow } from 'src/utils/format-time';

import { useGetGroups } from 'src/actions/group';
import { clickConversation } from 'src/actions/chat';
import { useGroupStore } from 'src/store/useGroupStore';

import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

import { useNavItem } from './hooks/use-nav-item';

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

  const mdUp = useResponsive('up', 'md');

  const router = useRouter();

  const { group, displayName, displayText, participants, lastActivity, hasOnlineInGroup } =
    useNavItem({ conversation, currentUserId: `${user?.id}` });

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
  const status = singleParticipant?.status ?? 'invisible';

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

  const renderGroup = (
    <Badge
      variant={hasOnlineInGroup ? 'online' : 'invisible'}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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
    <Badge key={status} variant={status} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <Avatar alt={name} src={avatarUrl} sx={{ width: 48, height: 48 }} />
    </Badge>
  );

  return (
    <Box component="li" sx={{ display: 'flex' }}>
      <ListItemButton
        onClick={handleClickConversation}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          py: 1.5,
          px: 2.5,
          gap: 2,
          ...(selected && { bgcolor: 'action.selected' }),
        }}
      >
        <Badge
          color="error"
          overlap="circular"
          badgeContent={collapse ? conversation.unreadCount : 0}
        >
          {isGroup ? renderGroup : renderSingle}
        </Badge>

        {!collapse && (
          <>
            <ListItemText
              primary={currentGroup?.groupName || displayName}
              primaryTypographyProps={{ noWrap: true, component: 'span', variant: 'subtitle2' }}
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

                    {!!conversation.unreadCount && (
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          bgcolor: 'info.main',
                          borderRadius: '50%',
                        }}
                      />
                    )}
                  </Stack>
                </>
              )}
            </Stack>
          </>
        )}
      </ListItemButton>
    </Box>
  );
}
