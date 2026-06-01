import type { IChatParticipant } from 'src/types/chat';

import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type Props = {
  participant: IChatParticipant;
};

export function ChatRoomSingle({ participant }: Props) {
  return (
    <Stack alignItems="center" sx={{ py: 5 }}>
      <Avatar
        alt={participant?.name}
        src={participant?.avatarUrl}
        sx={{ width: 96, height: 96, mb: 2 }}
      />
      <Typography variant="subtitle1">{participant?.name}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {participant?.role}
      </Typography>
    </Stack>
  );
}
