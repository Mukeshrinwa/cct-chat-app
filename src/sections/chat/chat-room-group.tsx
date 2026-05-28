import type { IChatParticipant } from 'src/types/chat';

import { useState, useCallback } from 'react';

import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { useSearchParams } from 'src/routes/hooks';

import { useBoolean } from 'src/hooks/use-boolean';

import { useGetGroups } from 'src/actions/group';

import { Iconify } from 'src/components/iconify';

import { CollapseButton } from './styles';
import { ChatGroupEditDialog } from './chat-group-edit-dialog';
import { ChatRoomParticipantDialog } from './chat-room-participant-dialog';

// ----------------------------------------------------------------------

type Props = {
  participants: IChatParticipant[];
};

export function ChatRoomGroup({ participants }: Props) {
  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get('id') || '';

  const { groups } = useGetGroups();

  const currentGroup = groups.find(
    (g: any) =>
      g.conversationId?._id === selectedConversationId ||
      g.conversationId === selectedConversationId
  );

  const collapse = useBoolean(true);
  const [selected, setSelected] = useState<IChatParticipant | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpen = useCallback((participant: IChatParticipant) => {
    setSelected(participant);
  }, []);

  const handleClose = useCallback(() => {
    setSelected(null);
  }, []);

  const totalParticipants = participants.length;

  const renderGroupInfo = currentGroup && (
    <Stack alignItems="center" sx={{ py: 4, px: 2, position: 'relative' }}>
      <IconButton
        onClick={() => setSettingsOpen(true)}
        sx={{ position: 'absolute', top: 10, right: 10 }}
      >
        <Iconify icon="solar:settings-bold" width={20} />
      </IconButton>

      <Avatar
        alt={currentGroup.groupName}
        src={currentGroup.groupAvatar}
        sx={{ width: 88, height: 88, mb: 2 }}
      />
      <Typography variant="subtitle1" noWrap>
        {currentGroup.groupName}
      </Typography>
      {currentGroup.description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, textAlign: 'center' }}>
          {currentGroup.description}
        </Typography>
      )}
    </Stack>
  );

  const renderList = (
    <>
      {participants.map((participant) => (
        <ListItemButton key={participant.id} onClick={() => handleOpen(participant)}>
          <Badge
            variant={participant.status}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Avatar alt={participant.name} src={participant.avatarUrl} />
          </Badge>

          <ListItemText
            sx={{ ml: 2 }}
            primary={participant.name}
            secondary={participant.role}
            primaryTypographyProps={{ noWrap: true, typography: 'subtitle2' }}
            secondaryTypographyProps={{ noWrap: true, component: 'span', typography: 'caption' }}
          />
        </ListItemButton>
      ))}
    </>
  );

  return (
    <>
      {renderGroupInfo}

      <CollapseButton
        selected={collapse.value}
        disabled={!totalParticipants}
        onClick={collapse.onToggle}
      >
        {`In room (${totalParticipants})`}
      </CollapseButton>

      <Collapse in={collapse.value}>{renderList}</Collapse>

      {selected && (
        <ChatRoomParticipantDialog participant={selected} open={!!selected} onClose={handleClose} />
      )}

      {currentGroup && (
        <ChatGroupEditDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          group={currentGroup}
        />
      )}
    </>
  );
}
