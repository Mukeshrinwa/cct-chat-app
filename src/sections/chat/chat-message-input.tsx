import type { IChatParticipant } from 'src/types/chat';

import { useRef, useMemo, useState, useCallback } from 'react';

import Stack from '@mui/material/Stack';
import Popover from '@mui/material/Popover';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { uuidv4 } from 'src/utils/uuidv4';
import { fSub, today } from 'src/utils/format-time';

import { useSocket } from 'src/socket';
import { sendMessage, createConversation } from 'src/actions/chat';

import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
  '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
  '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
  '😾', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤙', '👈', '👉',
  '👆', '👇', '👍', '👎', '👊', '👏', '🙌', '🙏', '❤️', '💔'
];

// ----------------------------------------------------------------------

type Props = {
  disabled: boolean;
  recipients: IChatParticipant[];
  selectedConversationId: string;
  onAddRecipients: (recipients: IChatParticipant[]) => void;
};

export function ChatMessageInput({
  disabled,
  recipients,
  onAddRecipients,
  selectedConversationId,
}: Props) {
  const router = useRouter();

  const { startTyping, startRecording, stopRecording } = useSocket();

  const lastTypingTimeRef = useRef<number>(0);

  const { user } = useMockedUser();

  const myContact = useMemo(
    () => ({
      id: `${user?.id}`,
      role: `${user?.role}`,
      email: `${user?.email}`,
      address: `${user?.address}`,
      name: `${user?.displayName}`,
      lastActivity: today(),
      avatarUrl: `${user?.photoURL}`,
      phoneNumber: `${user?.phoneNumber}`,
      status: 'online' as 'online' | 'offline' | 'alway' | 'busy',
    }),
    [user]
  );

  const fileRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState('');

  const [emojiAnchor, setEmojiAnchor] = useState<HTMLButtonElement | null>(null);

  const handleOpenEmoji = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setEmojiAnchor(event.currentTarget);
  }, []);

  const handleCloseEmoji = useCallback(() => {
    setEmojiAnchor(null);
  }, []);

  const handleSelectEmoji = useCallback((emoji: string) => {
    setMessage((prev) => prev + emoji);
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = reader.result as string;
      
      const fileMessageData = {
        id: uuidv4(),
        attachments: [],
        body: base64String,
        contentType: 'image',
        createdAt: fSub({ minutes: 1 }),
        senderId: myContact.id,
      };

      try {
        if (selectedConversationId) {
          await sendMessage(selectedConversationId, fileMessageData);
        } else {
          const fileConversationData = {
            id: uuidv4(),
            messages: [fileMessageData],
            participants: [...recipients, myContact],
            type: recipients.length > 1 ? 'GROUP' : 'ONE_TO_ONE',
            unreadCount: 0,
          };
          const res = await createConversation(fileConversationData);
          router.push(`${paths.dashboard.chat}?id=${res.conversation.id}`);
          onAddRecipients([]);
        }
      } catch (error) {
        console.error('Failed to send file:', error);
      }
    };
    reader.readAsDataURL(file);

    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }, [myContact, recipients, router, selectedConversationId, onAddRecipients]);



  const messageData = useMemo(
    () => ({
      id: uuidv4(),
      attachments: [],
      body: message,
      contentType: 'text',
      createdAt: fSub({ minutes: 1 }),
      senderId: myContact.id,
    }),
    [message, myContact.id]
  );

  const conversationData = useMemo(
    () => ({
      id: uuidv4(),
      messages: [messageData],
      participants: [...recipients, myContact],
      type: recipients.length > 1 ? 'GROUP' : 'ONE_TO_ONE',
      unreadCount: 0,
    }),
    [messageData, myContact, recipients]
  );

  const handleAttach = useCallback(() => {
    if (fileRef.current) {
      fileRef.current.click();
    }
  }, []);

  const handleChangeMessage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(event.target.value);

    if (selectedConversationId) {
      const now = Date.now();
      if (now - lastTypingTimeRef.current > 3000) {
        startTyping({ conversationId: selectedConversationId });
        lastTypingTimeRef.current = now;
      }
    }
  }, [selectedConversationId, startTyping]);

  const onSubmitMessage = useCallback(async () => {
    try {
      if (message.trim()) {
        if (selectedConversationId) {
          await sendMessage(selectedConversationId, messageData);
        } else {
          const res = await createConversation(conversationData);

          router.push(`${paths.dashboard.chat}?id=${res.conversation.id}`);

          onAddRecipients([]);
        }
        setMessage('');
      }
    } catch (error) {
      console.error(error);
    }
  }, [conversationData, message, messageData, onAddRecipients, router, selectedConversationId]);

  const handleSendMessage = useCallback(
    async (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        onSubmitMessage();
      }
    },
    [onSubmitMessage]
  );

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStartRecording = useCallback(async () => {
    if (!selectedConversationId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());

        // Convert to base64 to send
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;

          const audioMessageData = {
            id: uuidv4(),
            attachments: [],
            body: base64Audio,
            contentType: 'audio',
            createdAt: new Date().toISOString(),
            senderId: myContact.id,
          };

          try {
            await sendMessage(selectedConversationId, audioMessageData);
          } catch (error) {
            console.error('Failed to send audio message:', error);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      startRecording({
        conversationId: selectedConversationId,
        recipientId: recipients[0]?.id || '',
      });
    } catch (error) {
      console.error('Microphone access denied or error:', error);
      alert('Please allow microphone permissions to record audio.');
    }
  }, [selectedConversationId, recipients, startRecording, myContact.id]);

  const handleStopRecording = useCallback(() => {
    if (!selectedConversationId || !isRecording) return;
    setIsRecording(false);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    stopRecording({
      conversationId: selectedConversationId,
      recipientId: recipients[0]?.id || '',
    });
  }, [selectedConversationId, recipients, stopRecording, isRecording]);

  const handleSendClick = useCallback(async () => {
    onSubmitMessage();
  }, [onSubmitMessage]);

  return (
    <>
      <InputBase
        name="chat-message"
        id="chat-message-input"
        value={message}
        onKeyUp={handleSendMessage}
        onChange={handleChangeMessage}
        placeholder={isRecording ? 'Recording audio...' : 'Type a message'}
        disabled={disabled || isRecording}
        startAdornment={
          <IconButton onClick={handleOpenEmoji} disabled={isRecording}>
            <Iconify icon="eva:smiling-face-fill" />
          </IconButton>
        }
        endAdornment={
          <Stack direction="row" sx={{ flexShrink: 0 }}>
            <IconButton onClick={handleAttach} disabled={isRecording}>
              <Iconify icon="solar:gallery-add-bold" />
            </IconButton>
            <IconButton onClick={handleAttach} disabled={isRecording}>
              <Iconify icon="eva:attach-2-fill" />
            </IconButton>
            <IconButton
              onMouseDown={handleStartRecording}
              onMouseUp={handleStopRecording}
              onMouseLeave={isRecording ? handleStopRecording : undefined}
              onTouchStart={handleStartRecording}
              onTouchEnd={handleStopRecording}
              color={isRecording ? 'error' : 'default'}
              sx={{
                ...(isRecording && {
                  animation: 'pulse 1.5s infinite',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.2)' },
                    '100%': { transform: 'scale(1)' },
                  },
                }),
              }}
            >
              <Iconify icon="solar:microphone-bold" />
            </IconButton>
            <IconButton onClick={handleSendClick} disabled={!message.trim() || isRecording}>
              <Iconify
                icon="iconamoon:send-fill"
                sx={{
                  color: message.trim() ? 'primary.main' : 'text.disabled',
                  transition: 'color 0.2s',
                }}
              />
            </IconButton>
          </Stack>
        }
        sx={{
          px: 1,
          height: 56,
          flexShrink: 0,
          borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
        }}
      />

      <input
        type="file"
        ref={fileRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept="image/*"
      />

      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={handleCloseEmoji}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              width: 320,
              maxHeight: 240,
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 0.75,
              overflowY: 'auto',
            },
          },
        }}
      >
        {EMOJIS.map((emoji) => (
          <IconButton
            key={emoji}
            onClick={() => handleSelectEmoji(emoji)}
            sx={{
              fontSize: 20,
              p: 0.5,
              borderRadius: 1,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            {emoji}
          </IconButton>
        ))}
      </Popover>
    </>
  );
}
