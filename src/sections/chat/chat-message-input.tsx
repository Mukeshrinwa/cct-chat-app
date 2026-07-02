import type { IChatParticipant } from 'src/types/chat';

import useSWR, { mutate } from 'swr';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Popover from '@mui/material/Popover';
import Collapse from '@mui/material/Collapse';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { uuidv4 } from 'src/utils/uuidv4';
import { fData } from 'src/utils/format-number';
import axios, { fetcher } from 'src/utils/axios';
import { fSub, today } from 'src/utils/format-time';

import { useSocket } from 'src/socket';
import { unblockUser } from 'src/api/user';
import { useChatStore } from 'src/store/useChatStore';
import { useAuthStore } from 'src/store/useAuthStore';
import { sendMessage, createConversation } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { FileThumbnail } from 'src/components/file-thumbnail';

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

const checkIsImage = (msg: any) => {
  if (!msg) return false;
  const body = msg.body || msg.text || '';
  const contentType = msg.contentType || msg.type || '';
  const firstAttachmentUrl = msg.attachments?.[0]?.url || msg.attachments?.[0]?.preview || msg.attachments?.[0]?.path || '';
  const firstAttachmentType = msg.attachments?.[0]?.type || '';

  return (
    contentType === 'image' ||
    firstAttachmentType.startsWith('image/') ||
    (typeof firstAttachmentUrl === 'string' &&
      (/\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(firstAttachmentUrl) || firstAttachmentUrl.includes('giphy.com'))) ||
    (typeof body === 'string' &&
      (body.startsWith('data:image/') ||
        /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(body) || body.includes('giphy.com')))
  );
};

const getImageUrl = (msg: any) => {
  if (!msg) return '';
  return (
    msg.attachments?.[0]?.preview ||
    msg.attachments?.[0]?.url ||
    msg.attachments?.[0]?.path ||
    (typeof msg.body === 'string' && (msg.body.startsWith('data:') || msg.body.startsWith('http')) ? msg.body : '')
  );
};

type Props = {
  disabled: boolean;
  recipients: IChatParticipant[];
  selectedConversationId: string;
  onAddRecipients: (recipients: IChatParticipant[]) => void;
  isUserMember?: boolean;
};

export function ChatMessageInput({
  disabled,
  recipients,
  onAddRecipients,
  selectedConversationId,
  isUserMember = true,
}: Props) {
  const router = useRouter();

  const { startTyping, stopTyping, startRecording, stopRecording } = useSocket();

  const replyingToMessage = useChatStore((state) => state.replyingToMessage);
  const setReplyingToMessage = useChatStore((state) => state.setReplyingToMessage);

  const lastTypingTimeRef = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useMockedUser();

  const { user: currentUser, toggleBlockUser } = useAuthStore();

  const { data: rawConversationsData } = useSWR<any>('/api/v1/chats/conversations', fetcher);

  const rawConversationEntry = useMemo(() => {
    if (!selectedConversationId || !rawConversationsData?.data) return null;
    return rawConversationsData.data.find((c: any) => c._id === selectedConversationId);
  }, [rawConversationsData, selectedConversationId]);

  const isBlockedByOther = useMemo(() => {
    if (!selectedConversationId || !rawConversationEntry || rawConversationEntry.type !== 'direct') return false;
    const { otherUser } = rawConversationEntry;
    if (!otherUser || !currentUser) return false;
    const currentUserIdStr = (currentUser.id || currentUser._id || '').toString();
    return (otherUser.blockedUsers || []).some((id: any) => id.toString() === currentUserIdStr);
  }, [rawConversationEntry, currentUser, selectedConversationId]);

  const isBlocked = useMemo(() => {
    if (recipients.length !== 1) return false;
    const recipient = recipients[0];
    const rId = recipient?.id || (recipient as any)?._id;
    if (!rId) return false;
    return currentUser?.blockedUsers?.includes(rId) ?? false;
  }, [recipients, currentUser?.blockedUsers]);

  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const checkBlockAndExecute = useCallback((action: () => void) => {
    if (isBlocked) {
      pendingActionRef.current = action;
      setUnblockDialogOpen(true);
    } else {
      action();
    }
  }, [isBlocked]);

  const handleConfirmUnblock = useCallback(async () => {
    if (recipients.length !== 1) return;
    const recipient = recipients[0];
    const rId = recipient?.id || (recipient as any)?._id;
    if (!rId) return;

    setUnblocking(true);
    try {
      await unblockUser(rId);
      toggleBlockUser(rId, false);
      toast.success(`Unblocked ${recipient.name || 'user'}`);
      setUnblockDialogOpen(false);

      // Execute the pending action if any
      if (pendingActionRef.current) {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action();
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
      toast.error('Failed to unblock user');
    } finally {
      setUnblocking(false);
    }
  }, [recipients, toggleBlockUser]);

  const handleOpenUnblockDialogOnly = useCallback(() => {
    pendingActionRef.current = null;
    setUnblockDialogOpen(true);
  }, []);

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
  const docRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<string>('');
  const [pendingFileType, setPendingFileType] = useState<'image' | 'video' | 'document' | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (recipients.length > 0 && !selectedConversationId) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [recipients, selectedConversationId]);

  useEffect(() => {
    const handleChatFileDrop = (e: any) => {
      const {file} = e.detail;
      if (!file || !selectedConversationId) return;

      let type: 'image' | 'video' | 'document' = 'document';
      if (file.type.startsWith('image/')) {
        type = 'image';
      } else if (file.type.startsWith('video/')) {
        type = 'video';
      }

      setPendingFile(file);
      setPendingFileType(type);
      if (type === 'image' || type === 'video') {
        setPendingFilePreview(URL.createObjectURL(file));
      } else {
        setPendingFilePreview('');
      }
    };

    window.addEventListener('chat-file-drop', handleChatFileDrop);
    return () => window.removeEventListener('chat-file-drop', handleChatFileDrop);
  }, [selectedConversationId]);

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

  const handleRemoveAttachment = useCallback(() => {
    setPendingFile(null);
    if (pendingFilePreview) {
      URL.revokeObjectURL(pendingFilePreview);
      setPendingFilePreview('');
    }
    setPendingFileType(null);
  }, [pendingFilePreview]);

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
    checkBlockAndExecute(async () => {
      try {
        const gifMessageData = {
          id: uuidv4(),
          attachments: [
            {
              name: 'giphy.gif',
              size: 0,
              type: 'image/gif',
              url: gifUrl,
              path: gifUrl,
              preview: gifUrl,
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
            }
          ],
          body: 'gif',
          contentType: 'document',
          createdAt: fSub({ minutes: 1 }),
          senderId: myContact.id,
          ...(replyingToMessage && {
            parentMessageId: replyingToMessage._id || replyingToMessage.id || replyingToMessage.messageId,
            parentId: replyingToMessage._id || replyingToMessage.id || replyingToMessage.messageId
          }),
        };
        await sendMessage(selectedConversationId, gifMessageData);
        setGifAnchor(null);
        setReplyingToMessage(null);
      } catch (error) {
        console.error('Failed to send GIF:', error);
      }
    });
  }, [selectedConversationId, myContact.id, replyingToMessage, setReplyingToMessage, checkBlockAndExecute]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversationId) return;

    let type: 'image' | 'video' | 'document' = 'document';
    if (file.type.startsWith('image/')) {
      type = 'image';
    } else if (file.type.startsWith('video/')) {
      type = 'video';
    }

    setPendingFile(file);
    setPendingFileType(type);
    if (type === 'image' || type === 'video') {
      setPendingFilePreview(URL.createObjectURL(file));
    } else {
      setPendingFilePreview('');
    }

    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }, [selectedConversationId]);

  const handleDocChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversationId) return;

    let type: 'image' | 'video' | 'document' = 'document';
    if (file.type.startsWith('image/')) {
      type = 'image';
    } else if (file.type.startsWith('video/')) {
      type = 'video';
    }

    setPendingFile(file);
    setPendingFileType(type);
    if (type === 'image' || type === 'video') {
      setPendingFilePreview(URL.createObjectURL(file));
    } else {
      setPendingFilePreview('');
    }

    if (docRef.current) {
      docRef.current.value = '';
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
      ...(replyingToMessage && {
        parentMessageId: replyingToMessage._id || replyingToMessage.id || replyingToMessage.messageId,
        parentId: replyingToMessage._id || replyingToMessage.id || replyingToMessage.messageId
      }),
    }),
    [message, myContact.id, replyingToMessage]
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
    checkBlockAndExecute(() => {
      if (fileRef.current) {
        fileRef.current.click();
      }
    });
  }, [checkBlockAndExecute]);

  const handleAttachDoc = useCallback(() => {
    checkBlockAndExecute(() => {
      if (docRef.current) {
        docRef.current.click();
      }
    });
  }, [checkBlockAndExecute]);

  const handleChangeMessage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    if (val.length > 4000) {
      toast.error('Message is too long (maximum 4000 characters)');
      setMessage(val.substring(0, 4000));
      return;
    }
    setMessage(val);

    if (selectedConversationId) {
      const now = Date.now();
      // Typing shuru — agar 3s se nahi bheja to dobara true bhejo
      if (now - lastTypingTimeRef.current > 3000) {
        startTyping({ conversationId: selectedConversationId });
        lastTypingTimeRef.current = now;
      }

      // Pichla timeout clear karo
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      // 2s ke baad typing: false bhejo
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping({ conversationId: selectedConversationId });
        lastTypingTimeRef.current = 0;
        typingTimeoutRef.current = null;
      }, 2000);
    }
  }, [selectedConversationId, startTyping, stopTyping]);

  const onSubmitMessage = useCallback(async () => {
    try {
      if (pendingFile) {
        if (message.length > 4000) {
          toast.error('Caption is too long (maximum 4000 characters)');
          return;
        }

        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', pendingFile);
          formData.append('conversationId', selectedConversationId);
          formData.append('messageId', uuidv4());

          formData.append('text', message);
          formData.append('body', message);

          if (replyingToMessage) {
            const pId = replyingToMessage._id || replyingToMessage.id || replyingToMessage.messageId;
            formData.append('parentMessageId', pId);
            formData.append('parentId', pId);
          }

          await axios.post('/api/v1/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          console.log('[FILE_UPLOAD_INLINE_WITH_CAPTION] File uploaded via FormData');

          setPendingFile(null);
          if (pendingFilePreview) {
            URL.revokeObjectURL(pendingFilePreview);
            setPendingFilePreview('');
          }
          setPendingFileType(null);
          setMessage('');
          setReplyingToMessage(null);

          mutate(`/api/v1/chats/conversations/${selectedConversationId}`);
          mutate('/api/v1/chats/conversations');
        } catch (error) {
          console.error('Failed to send file with caption:', error);
          toast.error('Failed to upload attachment');
        } finally {
          setIsUploading(false);
        }
        return;
      }

      if (message.trim()) {
        if (message.length > 4000) {
          toast.error('Message is too long (maximum 4000 characters)');
          return;
        }
        if (selectedConversationId) {
          await sendMessage(selectedConversationId, messageData);
        } else {
          const res = await createConversation(conversationData);

          router.push(`${paths.dashboard.chat}?id=${res.conversation.id}`);

          onAddRecipients([]);
        }
        setMessage('');
        setReplyingToMessage(null);
      }
    } catch (error) {
      console.error(error);
    }
  }, [
    conversationData,
    message,
    messageData,
    onAddRecipients,
    router,
    selectedConversationId,
    setReplyingToMessage,
    pendingFile,
    pendingFilePreview,
    replyingToMessage,
  ]);

  const handleSendMessage = useCallback(
    async (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        checkBlockAndExecute(onSubmitMessage);
      }
    },
    [onSubmitMessage, checkBlockAndExecute]
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

        const audioFile = new File([audioBlob], `voice_${Date.now()}.mp3`, { type: 'audio/mp3' });
        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('conversationId', selectedConversationId);
        formData.append('messageId', uuidv4());

        if (replyingToMessage) {
          const pId = replyingToMessage._id || replyingToMessage.id || replyingToMessage.messageId;
          formData.append('parentMessageId', pId);
          formData.append('parentId', pId);
        }

        axios
          .post('/api/v1/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          .then(() => {
            console.log('[AUDIO_UPLOAD] Voice note uploaded successfully');
            mutate(`/api/v1/chats/conversations/${selectedConversationId}`);
            mutate('/api/v1/chats/conversations');
            setReplyingToMessage(null);
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
  }, [selectedConversationId, recipients, startRecording, replyingToMessage, setReplyingToMessage]);

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
    checkBlockAndExecute(onSubmitMessage);
  }, [onSubmitMessage, checkBlockAndExecute]);

  const handleCancelReply = useCallback(() => {
    setReplyingToMessage(null);
  }, [setReplyingToMessage]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (!file || !selectedConversationId) return;

    let type: 'image' | 'video' | 'document' = 'document';
    if (file.type.startsWith('image/')) {
      type = 'image';
    } else if (file.type.startsWith('video/')) {
      type = 'video';
    }

    setPendingFile(file);
    setPendingFileType(type);
    if (type === 'image' || type === 'video') {
      setPendingFilePreview(URL.createObjectURL(file));
    } else {
      setPendingFilePreview('');
    }
  }, [selectedConversationId]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return (
    <Stack sx={{ position: 'relative' }} onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Block Warning Banner (WhatsApp style) */}
      {isBlocked && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          spacing={1.5}
          sx={{
            py: 1.25,
            px: 2,
            bgcolor: (theme) => theme.palette.mode === 'light' ? '#FFF9EB' : '#2A1F00',
            borderBottom: (theme) => `solid 1px ${theme.vars.palette.divider}`,
            borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
          }}
        >
          <Iconify icon="solar:forbidden-circle-bold" sx={{ color: '#FFAB00' }} />
          <Typography variant="body2" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#7A4F01' : '#FFE5B4', fontWeight: 500 }}>
            You blocked this contact.
          </Typography>
          <Button
            size="small"
            onClick={handleOpenUnblockDialogOnly}
            sx={{
              color: '#FFAB00',
              fontWeight: 700,
              p: 0,
              minWidth: 0,
              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
            }}
          >
            Tap to unblock
          </Button>
        </Stack>
      )}
      {replyingToMessage && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            p: 1.5,
            borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
            bgcolor: 'background.neutral',
            mx: 1,
            mt: 1,
            borderRadius: 1,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="solar:reply-bold" sx={{ color: 'text.secondary' }} />
            {checkIsImage(replyingToMessage) && getImageUrl(replyingToMessage) && (
              <Box
                component="img"
                src={getImageUrl(replyingToMessage)}
                alt="reply preview"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 0.5,
                  objectFit: 'cover',
                  mr: 0.5,
                }}
              />
            )}
            <Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
                Replying to {replyingToMessage.senderId === myContact.id ? 'yourself' : 'message'}
              </Typography>
              <Typography
                variant="body2"
                noWrap
                sx={{ color: 'text.primary', maxWidth: 300 }}
              >
                {checkIsImage(replyingToMessage)
                  ? `📷 Photo${replyingToMessage.body && !replyingToMessage.body.startsWith('data:') && !replyingToMessage.body.startsWith('http') ? `: ${replyingToMessage.body}` : ''}`
                  : replyingToMessage.body === 'gif' ? '[GIF]' : (replyingToMessage.body || 'File')}
              </Typography>
            </Stack>
          </Stack>
          <IconButton size="small" onClick={handleCancelReply}>
            <Iconify icon="mingcute:close-line" width={16} />
          </IconButton>
        </Stack>
      )}

      {/* Attachment Preview (displayed directly above the input box) */}
      {pendingFile && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{
            p: 1.5,
            mx: 1,
            mt: 1,
            borderRadius: 1,
            borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
            bgcolor: 'background.neutral',
            position: 'relative',
          }}
        >
          {/* Preview Thumbnail */}
          {pendingFileType === 'image' && pendingFilePreview && (
            <Box
              component="img"
              src={pendingFilePreview}
              alt="Preview"
              sx={{
                width: 60,
                height: 60,
                borderRadius: 1,
                objectFit: 'cover',
                boxShadow: (theme) => theme.customShadows.z4,
              }}
            />
          )}

          {pendingFileType === 'video' && pendingFilePreview && (
            <Box
              component="video"
              src={pendingFilePreview}
              sx={{
                width: 60,
                height: 60,
                borderRadius: 1,
                objectFit: 'cover',
                boxShadow: (theme) => theme.customShadows.z4,
              }}
            />
          )}

          {pendingFileType === 'document' && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: 'background.paper',
                border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
                maxWidth: 240,
              }}
            >
              <FileThumbnail
                file={pendingFile.name}
                slotProps={{ icon: { width: 20, height: 20 } }}
                sx={{ width: 32, height: 32 }}
              />
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography variant="caption" noWrap sx={{ fontWeight: 600, fontSize: '12px', color: 'text.primary' }}>
                  {pendingFile.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>
                  {fData(pendingFile.size)}
                </Typography>
              </Stack>
            </Stack>
          )}

          <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
              Attachment
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: 'text.primary' }}>
              {pendingFile.name}
            </Typography>
          </Stack>

          {isUploading ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', mr: 2 }}>
              Uploading...
            </Typography>
          ) : (
            <IconButton size="small" onClick={handleRemoveAttachment}>
              <Iconify icon="mingcute:close-line" width={18} />
            </IconButton>
          )}
        </Stack>
      )}

      {(!isUserMember || isBlockedByOther ) ? (
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            py: 2,
            px: 3,
            minHeight: 56,
            bgcolor: 'background.neutral',
            borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
            textAlign: 'center',
            width: '100%',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify
              icon={!isUserMember ? "solar:info-circle-bold" : "solar:forbidden-circle-bold"}
              sx={{ color: 'text.secondary', flexShrink: 0 }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {!isUserMember
                ? "You can't send messages to this group because you're no longer a participant."
                : "You cannot send messages to this contact because they blocked you."}
            </Typography>
          </Stack>
        </Stack>
      ) : isRecording ? (
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
          inputRef={inputRef}
          name="chat-message"
          id="chat-message-input"
          value={message}
          onKeyUp={handleSendMessage}
          onChange={handleChangeMessage}
          placeholder="Type a message"
          disabled={disabled}
          inputProps={{ maxLength: 4000 }}
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
              <IconButton onClick={handleAttachDoc}>
                <Iconify icon="eva:attach-2-fill" />
              </IconButton>
              <IconButton
                onClick={() => checkBlockAndExecute(handleStartRecording)}
                color="default"
                title="Click to record voice note"
              >
                <Iconify icon="solar:microphone-bold" />
              </IconButton>
              <IconButton onClick={handleSendClick} disabled={(!message.trim() && !pendingFile) || isUploading}>
                <Iconify
                  icon="iconamoon:send-fill"
                  sx={{
                    color: (message.trim() || pendingFile) ? 'primary.main' : 'text.disabled',
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
            width: '100%',
            '& .MuiInputBase-input': {
              minWidth: 0,
            },
          }}
        />
      )}

      <input
        type="file"
        ref={fileRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept="image/*,video/*"
      />

      <input
        type="file"
        ref={docRef}
        onChange={handleDocChange}
        style={{ display: 'none' }}
        accept="*/*"
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
      {/* modern confirmation dialog to unblock user */}
      <Dialog
        open={unblockDialogOpen}
        onClose={() => setUnblockDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 1,
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Iconify icon="solar:forbidden-circle-bold" width={28} sx={{ color: 'warning.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Unblock {recipients[0]?.name || 'User'}?
          </Typography>
        </DialogTitle>

        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary', fontSize: 14 }}>
            To send this message, you need to unblock {recipients[0]?.name || 'this contact'}. Unblocking will also allow them to message and call you.
          </DialogContentText>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setUnblockDialogOpen(false)}
            disabled={unblocking}
            sx={{ borderRadius: 1 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmUnblock}
            disabled={unblocking}
            sx={{
              borderRadius: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            {unblocking ? 'Unblocking...' : 'Unblock'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
