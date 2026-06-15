import type { IChatParticipant } from 'src/types/chat';

import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useCall } from 'src/call';
import { varAlpha } from 'src/theme/styles';
import { useGetConversations } from 'src/actions/chat';

import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  participant: IChatParticipant;
};

export function ChatRoomParticipantDialog({ participant, open, onClose }: Props) {
  const router = useRouter();
  const { conversations } = useGetConversations();
  const { startCall } = useCall();
  const { user } = useMockedUser();

  const isMe = user?.id === participant.id;

  const handleMessage = () => {
    onClose();

    // Check if we already have a direct conversation with this user
    const existingConv = conversations.allIds.find((convId) => {
      const conv = conversations.byId[convId];
      if (!conv || conv.type === 'GROUP' || conv.type === 'group') return false;
      return conv.participants.some((p) => p.id === participant.id);
    });

    if (existingConv) {
      router.push(`${paths.dashboard.chat}?id=${existingConv}`);
    } else {
      router.push(`${paths.dashboard.chat}?id=${participant.id}`);
    }
  };

  const handleAudioCall = () => {
    if (isMe) return;
    onClose();
    startCall([participant.id], 'audio', participant.name, participant.avatarUrl);
  };

  const handleVideoCall = () => {
    if (isMe) return;
    onClose();
    startCall([participant.id], 'video', participant.name, participant.avatarUrl);
  };

  const handleEmail = () => {
    if (participant.email) {
      window.open(`mailto:${participant.email}`);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
        <Iconify icon="mingcute:close-line" />
      </IconButton>

      <DialogContent sx={{ py: 5, px: 3, display: 'flex' }}>
        <Avatar
          alt={participant.name}
          src={participant.avatarUrl}
          sx={{ width: 96, height: 96, mr: 3 }}
        />

        <Stack spacing={1}>
          <Typography variant="caption" sx={{ color: 'primary.main' }}>
            {participant.role}
          </Typography>

          <Typography variant="subtitle1">{participant.name}</Typography>

          <Stack direction="row" sx={{ typography: 'caption', color: 'text.disabled' }}>
            <Iconify
              icon="mingcute:location-fill"
              width={16}
              sx={{ flexShrink: 0, mr: 0.5, mt: '2px' }}
            />
            {participant.address}
          </Stack>

          <Stack spacing={1} direction="row" sx={{ pt: 1.5 }}>
            <IconButton
              size="small"
              color="error"
              onClick={handleAudioCall}
              disabled={isMe}
              title="Start audio call"
              sx={{
                borderRadius: 1,
                bgcolor: (theme) => varAlpha(theme.vars.palette.error.mainChannel, 0.08),
                '&:hover': {
                  bgcolor: (theme) => varAlpha(theme.vars.palette.error.mainChannel, 0.16),
                },
              }}
            >
              <Iconify width={18} icon="solar:phone-bold" />
            </IconButton>

            <IconButton
              size="small"
              color="info"
              onClick={handleMessage}
              disabled={isMe}
              title="Send message"
              sx={{
                borderRadius: 1,
                bgcolor: (theme) => varAlpha(theme.vars.palette.info.mainChannel, 0.08),
                '&:hover': {
                  bgcolor: (theme) => varAlpha(theme.vars.palette.info.mainChannel, 0.16),
                },
              }}
            >
              <Iconify width={18} icon="solar:chat-round-dots-bold" />
            </IconButton>

            <IconButton
              size="small"
              color="primary"
              onClick={handleEmail}
              disabled={!participant.email}
              title={participant.email ? `Email: ${participant.email}` : 'No email address'}
              sx={{
                borderRadius: 1,
                bgcolor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                '&:hover': {
                  bgcolor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.16),
                },
              }}
            >
              <Iconify width={18} icon="fluent:mail-24-filled" />
            </IconButton>

            <IconButton
              size="small"
              color="secondary"
              onClick={handleVideoCall}
              disabled={isMe}
              title="Start video call"
              sx={{
                borderRadius: 1,
                bgcolor: (theme) => varAlpha(theme.vars.palette.secondary.mainChannel, 0.08),
                '&:hover': {
                  bgcolor: (theme) => varAlpha(theme.vars.palette.secondary.mainChannel, 0.16),
                },
              }}
            >
              <Iconify width={18} icon="solar:videocamera-record-bold" />
            </IconButton>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

