import type { IChatParticipant } from 'src/types/chat';

import { mutate } from 'swr';
import { useRef, useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Collapse from '@mui/material/Collapse';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import axios from 'src/utils/axios';
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

const GIPHY_API_KEY = 'SB758rkq1nNFUmjlVkwo6jAbtTkWfP0M';

const POPULAR_GIFS = [
  { id: '1', title: 'Thumbs Up', url: 'https://media.giphy.com/media/tIeCLkB8geYtW/giphy.gif' },
  { id: '2', title: 'Clapping', url: 'https://media.giphy.com/media/3o7qE1YN7aBOFPRw8E/giphy.gif' },
  { id: '3', title: 'LOL', url: 'https://media.giphy.com/media/26n6Gx9moCgs1pUUk/giphy.gif' },
  { id: '4', title: 'Dance', url: 'https://media.giphy.com/media/l3V0lsGtTMSB5YNgc/giphy.gif' },
  { id: '5', title: 'Mind Blown', url: 'https://media.giphy.com/media/l0IxYWDltdHEqujnO/giphy.gif' },
  { id: '6', title: 'Party', url: 'https://media.giphy.com/media/kyLYXonQYYfwYDIeZl/giphy.gif' },
  { id: '7', title: 'Cat Jam', url: 'https://media.giphy.com/media/GeimqsH0TLDt4tAqyY/giphy.gif' },
  { id: '8', title: 'Excited', url: 'https://media.giphy.com/media/1n4iuWZFnTeN6qvdpD/giphy.gif' },
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

  const [gifAnchor, setGifAnchor] = useState<HTMLButtonElement | null>(null);
  const [gifSearch, setGifSearch] = useState('');
  const [gifLoading, setGifLoading] = useState(false);
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [giphyApiKey, setGiphyApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const handleOpenGif = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setGifAnchor(event.currentTarget);
    const apiKey = giphyApiKey || import.meta.env.VITE_GIPHY_API_KEY || GIPHY_API_KEY;
    if (apiKey && gifResults.length === 0) {
      setGifLoading(true);
      fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=16`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) {
            setGifResults(
              json.data.map((item: any) => ({
                id: item.id,
                title: item.title,
                url: item.images.fixed_height.url,
              }))
            );
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setGifLoading(false));
    }
  }, [giphyApiKey, gifResults.length]);

  const handleCloseGif = useCallback(() => {
    setGifAnchor(null);
  }, []);

  const handleGifSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setGifSearch(value);
    const apiKey = giphyApiKey || import.meta.env.VITE_GIPHY_API_KEY || GIPHY_API_KEY;
    if (!apiKey) return;

    if (!value.trim()) {
      setGifLoading(true);
      fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=16`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) {
            setGifResults(
              json.data.map((item: any) => ({
                id: item.id,
                title: item.title,
                url: item.images.fixed_height.url,
              }))
            );
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setGifLoading(false));
      return;
    }

    setGifLoading(true);
    fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(value)}&limit=16`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setGifResults(
            json.data.map((item: any) => ({
              id: item.id,
              title: item.title,
              url: item.images.fixed_height.url,
            }))
          );
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setGifLoading(false));
  }, [giphyApiKey]);

  const handleSelectGif = useCallback(async (gifUrl: string) => {
    if (!selectedConversationId) return;
    try {
      const gifMessageData = {
        id: uuidv4(),
        attachments: [],
        body: gifUrl,
        contentType: 'gif',
        createdAt: fSub({ minutes: 1 }),
        senderId: myContact.id,
      };
      await sendMessage(selectedConversationId, gifMessageData);
      setGifAnchor(null);
    } catch (error) {
      console.error('Failed to send GIF:', error);
    }
  }, [selectedConversationId, myContact.id]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversationId) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', selectedConversationId);
      formData.append('messageId', uuidv4());

      await axios.post('/api/v1/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('[IMAGE_UPLOAD] File uploaded via FormData');
    } catch (error) {
      console.error('Failed to send file:', error);
    }

    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }, [selectedConversationId]);




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
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCancelledRef = useRef(false);

  const formatDuration = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!selectedConversationId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isCancelledRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());

        if (isCancelledRef.current) {
          isCancelledRef.current = false;
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 100) {
          console.log('[AUDIO_UPLOAD] Audio recording too small, skipping.');
          return;
        }

        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('conversationId', selectedConversationId);
        formData.append('messageId', uuidv4());

        axios
          .post('/api/v1/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          .then(() => {
            console.log('[AUDIO_UPLOAD] Voice note uploaded successfully');
            mutate(`/api/v1/chats/conversations/${selectedConversationId}`);
            mutate('/api/v1/chats/conversations');
          })
          .catch((err) => console.error('[AUDIO_UPLOAD] Failed to upload voice note:', err));
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      startRecording({
        conversationId: selectedConversationId,
        recipientId: recipients[0]?.id || '',
      });
    } catch (error) {
      console.error('Microphone access denied or error:', error);
      alert('Please allow microphone permissions to record audio.');
    }
  }, [selectedConversationId, recipients, startRecording]);

  const handleStopRecording = useCallback(() => {
    if (!selectedConversationId || !isRecording) return;
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    stopRecording({
      conversationId: selectedConversationId,
      recipientId: recipients[0]?.id || '',
    });
  }, [selectedConversationId, recipients, stopRecording, isRecording]);

  const handleCancelRecording = useCallback(() => {
    if (!selectedConversationId || !isRecording) return;
    isCancelledRef.current = true;
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

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
      {isRecording ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{
            px: 2,
            height: 56,
            flexShrink: 0,
            borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
            bgcolor: 'background.neutral',
            borderRadius: 1,
            mx: 1,
            mb: 1,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: 'error.main',
                animation: 'pulse 1.5s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 0.4 },
                  '50%': { opacity: 1 },
                  '100%': { opacity: 0.4 },
                },
              }}
            />
            <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 600 }}>
              Recording ({formatDuration(recordingDuration)})
            </Typography>
          </Stack>

          <IconButton color="error" onClick={handleCancelRecording} title="Cancel recording">
            <Iconify icon="solar:trash-bin-trash-bold" width={22} />
          </IconButton>

          <IconButton
            onClick={handleStopRecording}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
            title="Send voice note"
          >
            <Iconify icon="iconamoon:send-fill" width={20} />
          </IconButton>
        </Stack>
      ) : (
        <InputBase
          name="chat-message"
          id="chat-message-input"
          value={message}
          onKeyUp={handleSendMessage}
          onChange={handleChangeMessage}
          placeholder="Type a message"
          disabled={disabled}
          startAdornment={
            <Stack direction="row" sx={{ flexShrink: 0 }}>
              <IconButton onClick={handleOpenEmoji} disabled={isRecording}>
                <Iconify icon="eva:smiling-face-fill" />
              </IconButton>
              <IconButton onClick={handleOpenGif} disabled={isRecording}>
                <Iconify icon="mdi:gif" />
              </IconButton>
            </Stack>
          }
          endAdornment={
            <Stack direction="row" sx={{ flexShrink: 0 }}>
              <IconButton onClick={handleAttach}>
                <Iconify icon="solar:gallery-add-bold" />
              </IconButton>
              <IconButton onClick={handleAttach}>
                <Iconify icon="eva:attach-2-fill" />
              </IconButton>
              <IconButton
                onClick={handleStartRecording}
                color="default"
                title="Click to record voice note"
              >
                <Iconify icon="solar:microphone-bold" />
              </IconButton>
              <IconButton onClick={handleSendClick} disabled={!message.trim()}>
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
      )}

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

      <Popover
        open={Boolean(gifAnchor)}
        anchorEl={gifAnchor}
        onClose={handleCloseGif}
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
              maxHeight: 380,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            },
          },
        }}
      >
        <InputBase
          placeholder="Search GIFs..."
          value={gifSearch}
          onChange={handleGifSearchChange}
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'background.neutral',
            typography: 'body2',
          }}
        />

        {gifLoading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: 200 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading...</Typography>
          </Stack>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1,
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            {((gifSearch.trim() && (giphyApiKey || import.meta.env.VITE_GIPHY_API_KEY || GIPHY_API_KEY)) ? gifResults : POPULAR_GIFS).map((gif) => (
              <Box
                key={gif.id}
                component="img"
                src={gif.url}
                alt={gif.title}
                onClick={() => handleSelectGif(gif.url)}
                sx={{
                  width: '100%',
                  height: 100,
                  borderRadius: 1,
                  cursor: 'pointer',
                  objectFit: 'cover',
                  bgcolor: 'background.neutral',
                  '&:hover': {
                    opacity: 0.8,
                  },
                }}
              />
            ))}
          </Box>
        )}

        {!(giphyApiKey || import.meta.env.VITE_GIPHY_API_KEY || GIPHY_API_KEY) && (
          <Stack spacing={1}>
            <Typography
              variant="caption"
              align="center"
              sx={{ color: 'text.secondary', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setShowApiKeyInput(prev => !prev)}
            >
              Configure Giphy Search
            </Typography>
            <Collapse in={showApiKeyInput}>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <InputBase
                  placeholder="Paste Giphy API Key"
                  value={giphyApiKey}
                  onChange={(e) => setGiphyApiKey(e.target.value)}
                  sx={{
                    flexGrow: 1,
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.5,
                    border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                    fontSize: '11px',
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    if (giphyApiKey) {
                      setShowApiKeyInput(false);
                      // Trigger a search if there is a search term
                      if (gifSearch.trim()) {
                        handleGifSearchChange({ target: { value: gifSearch } } as any);
                      } else {
                        // Trigger trending loading
                        setGifLoading(true);
                        fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${giphyApiKey}&limit=16`)
                          .then((res) => res.json())
                          .then((json) => {
                            if (json.data) {
                              setGifResults(
                                json.data.map((item: any) => ({
                                  id: item.id,
                                  title: item.title,
                                  url: item.images.fixed_height.url,
                                }))
                              );
                            }
                          })
                          .catch((err) => console.error(err))
                          .finally(() => setGifLoading(false));
                      }
                    }
                  }}
                  sx={{ fontSize: '10px', p: 0.5 }}
                >
                  Apply
                </Button>
              </Stack>
            </Collapse>
          </Stack>
        )}
      </Popover>
    </>
  );
}
