import type { IChatMessage, IChatParticipant } from 'src/types/chat';

import { useRef, useMemo,useState , useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { useSearchParams } from 'src/routes/hooks';

import { getMediaUrl } from 'src/utils/chat-utils';

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

function getMessageImageUrl(message: IChatMessage): string | null {
  const firstAttachment = message.attachments?.[0];
  const firstAttachmentUrl = firstAttachment?.url || firstAttachment?.preview || firstAttachment?.path || '';
  const firstAttachmentType = firstAttachment?.type || '';

  const hasImage =
    message.contentType === 'image' ||
    firstAttachmentType.startsWith('image/') ||
    (typeof firstAttachmentUrl === 'string' &&
      (/\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(firstAttachmentUrl) || firstAttachmentUrl.includes('giphy.com'))) ||
    (typeof message.body === 'string' &&
      (message.body.startsWith('data:image/') ||
        /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(message.body) || message.body.includes('giphy.com')));

  if (!hasImage) return null;

  return firstAttachmentUrl || getMediaUrl(message.body);
}

export function ChatMessageList({ messages = [], participants, loading }: Props) {
  const searchParams = useSearchParams();
  const targetMessageId = searchParams.get('messageId') || '';
  const [isDragOver, setIsDragOver] = useState(false);

  const { messagesEndRef } = useMessagesScroll(messages, targetMessageId);

  const slides = useMemo(() => {
    const list: { src: string }[] = [];
    messages.forEach((message) => {
      const imgUrl = getMessageImageUrl(message);
      if (imgUrl) {
        list.push({ src: imgUrl });
      }
    });
    return list;
  }, [messages]);

  const lightbox = useLightBox(slides);

  const hasScrolledToMessage = useRef<string | null>(null);

  useEffect(() => {
    if (targetMessageId && !loading) {
      if (hasScrolledToMessage.current === targetMessageId) {
        return undefined;
      }

      const timer = setTimeout(() => {
        const element = document.getElementById(`msg-${targetMessageId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          hasScrolledToMessage.current = targetMessageId;
        }
      }, 300);
      return () => clearTimeout(timer);
    }

    if (!targetMessageId) {
      hasScrolledToMessage.current = null;
    }

    return undefined;
  }, [targetMessageId, messages, loading]);

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
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) {
            window.dispatchEvent(new CustomEvent('chat-file-drop', { detail: { file } }));
          }
        }}
        sx={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden' }}
      >
        {isDragOver && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(213, 215, 243, 0.14)',
              border: '3px dashed',
              borderColor: 'primary.main',
              m: 0,
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" sx={{ color: 'orange' }}>
              Drop Your File Here
            </Typography>
          </Box>
        )}
        
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
              onOpenLightbox={(url) => lightbox.onOpen(url)}
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
