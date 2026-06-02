import type { IChatMessage, IChatParticipant } from 'src/types/chat';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';

import { Scrollbar } from 'src/components/scrollbar';
import { Lightbox, useLightBox } from 'src/components/lightbox';

import { ChatMessageItem } from './chat-message-item';
import { useMessagesScroll } from './hooks/use-messages-scroll';

// ----------------------------------------------------------------------

type Props = {
  loading: boolean;
  messages: IChatMessage[];
  participants: IChatParticipant[];
};

export function ChatMessageList({ messages = [], participants, loading }: Props) {
  const { messagesEndRef } = useMessagesScroll(messages);

  const slides = messages
    .filter((message) => message.contentType === 'image')
    .map((message) => ({ src: message.body }));

  const lightbox = useLightBox(slides);

  if (loading) {
    return (
      <Stack sx={{ flex: '1 1 auto', position: 'relative' }}>
        <LinearProgress
          color="inherit"
          sx={{
            top: 0,
            left: 0,
            width: 1,
            height: 2,
            borderRadius: 0,
            position: 'absolute',
          }}
        />
      </Stack>
    );
  }

  return (
    <>
      {/* Chat background with logo watermark */}
      <Box sx={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden' }}>
        {/* Logo watermark */}
        <Box
          component="img"
          src="/logo/logo.png"
          alt="watermark"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: 360, sm: 220, md: 690 },
            height: 'auto',
            opacity: 0.05,
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
            // filter: 'grayscale(100%)',
          }}
        />

        <Scrollbar ref={messagesEndRef} sx={{ px: 3, pt: 5, pb: 3, height: '100%', position: 'relative', zIndex: 1 }}>
          {messages.map((message) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              participants={participants}
              onOpenLightbox={() => lightbox.onOpen(message.body)}
            />
          ))}
        </Scrollbar>
      </Box>

      <Lightbox
        slides={slides}
        open={lightbox.open}
        close={lightbox.onClose}
        index={lightbox.selected}
      />
    </>
  );
}
