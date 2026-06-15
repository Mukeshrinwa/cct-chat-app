import type { IChatMessage, IChatParticipant } from 'src/types/chat';

import { mutate } from 'swr';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { fToNow } from 'src/utils/format-time';
import { fData } from 'src/utils/format-number';
import { getMediaUrl } from 'src/utils/chat-utils';

import { joinGroupByLink } from 'src/actions/group';
import { useChatStore } from 'src/store/useChatStore';
import { editMessage, deleteMessage, reactToMessage, useGetMessageById, getMessageContext } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { FileThumbnail } from 'src/components/file-thumbnail';

import { useMockedUser } from 'src/auth/hooks';

import { useMessage } from './hooks/use-message';
import { ChatForwardDialog } from './chat-forward-dialog';
import { ChatGroupInviteDialog } from './chat-group-invite-dialog';

// ----------------------------------------------------------------------

type Props = {
  message: IChatMessage;
  participants: IChatParticipant[];
  onOpenLightbox: (value: string) => void;
};

const isSystemMessage = (message: IChatMessage) => {
  const body = message.body || '';
  const contentType = message.contentType || '';

  if (contentType === 'system' || contentType === 'notification') {
    return true;
  }

  const lowerBody = body.toLowerCase();

  return (
    lowerBody.includes('created by you') ||
    lowerBody.includes('created this group') ||
    (lowerBody.startsWith('group') && lowerBody.includes('created by')) ||
    (lowerBody.includes('added') && (lowerBody.includes('to the group') || lowerBody.includes('to group'))) ||
    (lowerBody.includes('removed') && (lowerBody.includes('from the group') || lowerBody.includes('from group'))) ||
    lowerBody.includes('joined the group') ||
    lowerBody.includes('left the group') ||
    lowerBody.includes('changed the group name') ||
    lowerBody.includes('changed the group icon') ||
    lowerBody.includes('changed the group description')
  );
};

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

export function ChatMessageItem({ message, participants, onOpenLightbox }: Props) {
  const { user } = useMockedUser();
  const theme = useTheme();
  const setReplyingToMessage = useChatStore((state) => state.setReplyingToMessage);

  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationId = searchParams.get('id') || '';
  const highlightedMessageId = searchParams.get('messageId') || '';
  const isHighlighted = highlightedMessageId === message.id;

  const { me, senderDetails, hasImage } = useMessage({
    message,
    participants,
    currentUserId: `${user?.id}`,
  });

  const { firstName, avatarUrl } = senderDetails;
  const { body, createdAt } = message;

  const imageUrl = message.attachments?.[0]?.preview || getMediaUrl(body);

  const getCaptionText = () => {
    if (!body || typeof body !== 'string') return '';
    const cleanBody = body.trim();
    if (cleanBody.startsWith('data:image/') || cleanBody.startsWith('data:audio/')) return '';
    if (cleanBody === 'gif') return '';
    if (cleanBody === imageUrl) return '';
    
    const att = message.attachments?.[0];
    if (att) {
      if (cleanBody === att.preview || cleanBody === att.url || cleanBody === att.path) return '';
    }
    
    if (/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)/i.test(cleanBody)) {
      return '';
    }
    
    return body;
  };

  const captionText = getCaptionText();

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        const inviteMatch = part.match(/\/group\/invite\/([^/]+)/);

        if (inviteMatch && inviteMatch[1]) {
          const code = inviteMatch[1];
          return (
            <Box
              component="span"
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setInviteModalCode(code);
              }}
              sx={{
                cursor: 'pointer',
                color: me ? 'inherit' : 'primary.main',
                textDecoration: 'underline',
                wordBreak: 'break-all',
                '&:hover': { opacity: 0.8 },
              }}
            >
              {part}
            </Box>
          );
        }

        return (
          <Box
            component="a"
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: me ? 'inherit' : 'primary.main',
              textDecoration: 'underline',
              wordBreak: 'break-all',
              '&:hover': { opacity: 0.8 },
            }}
          >
            {part}
          </Box>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const parentId =
    message.parentMessageId ||
    (message.parentMessage as any)?._id ||
    (message.parentMessage as any)?.messageId;

  const { message: parentMessageFromApi } = useGetMessageById(conversationId, parentId);

  // Prefer backend-provided populated parentMessage if available;
  // otherwise fall back to context/API fetched parent message.
  const parentMessage = (message as any).parentMessage || parentMessageFromApi;

  const handleJumpToParent = async () => {
    if (!message.parentMessageId) return;
    router.push(`${paths.dashboard.chat}?id=${conversationId}&messageId=${message.parentMessageId}`);
    try {
      const contextMessages = await getMessageContext(conversationId, message.parentMessageId);
      if (contextMessages && contextMessages.length > 0) {
        mutate(
          `/api/v1/chats/conversations/${conversationId}`,
          (currentData: any) => {
            if (!currentData) return currentData;
            return {
              ...currentData,
              conversation: {
                ...currentData.conversation,
                messages: contextMessages,
              },
            };
          },
          { revalidate: false }
        );
      }
    } catch (err) {
      console.error('Failed to load message context:', err);
    }
  };

  const isAudio =
    message.contentType === 'audio' ||
    (message as any).type === 'audio' ||
    (typeof body === 'string' && (body.startsWith('data:audio/') || /\.(mp3|wav|ogg|aac|webm)($|\?)/i.test(body))) ||
    message.attachments?.some(
      (att: any) =>
        att.type?.startsWith('audio/') ||
        /\.(mp3|wav|ogg|aac|webm)($|\?)/i.test(att.name || '') ||
        /\.(mp3|wav|ogg|aac|webm)($|\?)/i.test(att.preview || '')
    );

  const audioUrl = (() => {
    const attUrl = message.attachments?.find(
      (att: any) =>
        att.type?.startsWith('audio/') ||
        /\.(mp3|wav|ogg|aac|webm)($|\?)/i.test(att.name || '') ||
        /\.(mp3|wav|ogg|aac|webm)($|\?)/i.test(att.preview || '')
    )?.preview;
    if (attUrl) return attUrl;
    return getMediaUrl(body);
  })();

  const isGroupInvite =
    message.contentType === 'group_invite' ||
    (typeof body === 'string' && body.includes('"type":"group_invite"'));

  const groupInviteData = isGroupInvite ? (() => {
    try {
      if (typeof body === 'object') return body;
      return JSON.parse(body);
    } catch {
      return null;
    }
  })() : null;

  const isTextMsg =
    !hasImage &&
    !isAudio &&
    !isGroupInvite &&
    !(message.attachments && message.attachments.length > 0) &&
    !message.isDeleted;

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(body);
  const [isExpanded, setIsExpanded] = useState(false);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Forward Dialog State
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);

  // Reactions Popover State
  const [reactionAnchorEl, setReactionAnchorEl] = useState<HTMLButtonElement | null>(null);

  // Group Invite Modal State
  const [inviteModalCode, setInviteModalCode] = useState<string | null>(null);

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileActionsPosition, setMobileActionsPosition] = useState<{ top: number; left: number } | null>(null);

  const handleEditStart = () => {
    setIsEditing(true);
    setEditText(body);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditText(body);
  };

  const handleEditSave = async () => {
    if (!editText.trim()) return;
    if (editText.length > 4000) {
      toast.error('Message is too long (maximum 4000 characters)');
      return;
    }
    try {
      await editMessage(message._id || message.id, editText, [], conversationId);
      setIsEditing(false);
      toast.success('Message updated');
    } catch (error) {
      toast.error('Failed to edit message');
    }
  };

  const handleDeleteOpen = () => setDeleteDialogOpen(true);
  const handleDeleteClose = () => setDeleteDialogOpen(false);

  const handleDeleteConfirm = async (deleteType: 'everyone' | 'me') => {
    try {
      await deleteMessage(message._id || message.id, deleteType, conversationId);
      toast.success('Message deleted');
      handleDeleteClose();
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const handleOpenReactions = (event: React.MouseEvent<HTMLButtonElement>) => {
    setReactionAnchorEl(event.currentTarget);
  };

  const handleCloseReactions = () => {
    setReactionAnchorEl(null);
  };

  const handleReact = async (emoji: string) => {
    try {
      await reactToMessage(message.id, emoji, conversationId);
      handleCloseReactions();
    } catch (error) {
      toast.error('Failed to update reaction');
    }
  };

  const emojisList = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🎉', '🔥'];

  const handleCloseMobileActions = () => {
    setMobileActionsPosition(null);
  };

  const handleBubbleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (message.isDeleted || isEditing) return;

    const target = event.target as HTMLElement;
    if (
      target.closest('audio') ||
      target.closest('a') ||
      target.closest('button') ||
      target.closest('img')
    ) {
      return;
    }

    if (isMobile) {
      setMobileActionsPosition({
        top: event.clientY,
        left: event.clientX,
      });
    }
  };

  const handleBubbleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (message.isDeleted || isEditing) return;

    if (isMobile) {
      event.preventDefault();
      setMobileActionsPosition({
        top: event.clientY,
        left: event.clientX,
      });
    }
  };

  let tickIcon = 'eva:checkmark-fill';
  let tickColor = 'text.disabled';

  if (me) {
    if (message.status === 'read') {
      tickIcon = 'eva:done-all-fill';
      tickColor = '#34B7F1';
    } else if (message.status === 'delivered') {
      tickIcon = 'eva:done-all-fill';
      tickColor = 'text.disabled';
    } else if (message.status === 'sent') {
      tickIcon = 'eva:checkmark-fill';
      tickColor = 'text.disabled';
    } else {
      // Fallback if status is not explicitly set by backend yet
      const isOtherParticipantOnline = participants.some(
        (p) => p.id !== user?.id && p.status === 'online'
      );
      if (isOtherParticipantOnline) {
        tickIcon = 'eva:done-all-fill'; // Delivered
        tickColor = 'text.disabled';
      }
    }
  }

  const renderInfo = (
    <Typography
      noWrap
      variant="caption"
      sx={{
        mb: 1,
        color: 'text.disabled',
        display: 'flex',
        alignItems: 'center',
        ...(!me && { mr: 'auto' }),
        ...(me && { ml: 'auto', justifyContent: 'flex-end' }),
      }}
    >
      {!me && `${firstName}, `}
      {fToNow(createdAt)}
      {message.editedAt && (
        <Box component="span" sx={{ ml: 1, fontStyle: 'italic', opacity: 0.8 }}>
          (edited)
        </Box>
      )}
      {me && (
        <Iconify
          icon={tickIcon}
          width={16}
          sx={{ ml: 0.5, color: tickColor }}
        />
      )}
    </Typography>
  );

  const renderBody = (
    <Stack
      sx={{
        p: 1.5,
        minWidth: 48,
        maxWidth: 320,
        borderRadius: 1,
        typography: 'body2',
        bgcolor: 'background.neutral',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        ...(me && { color: 'grey.800', bgcolor: 'primary.lighter' }),
        ...(hasImage && !captionText && { p: 0, bgcolor: 'transparent' }),
        ...(hasImage && captionText && { p: 0.75 }),
        ...(message.isDeleted && {
          color: 'text.disabled',
          fontStyle: 'italic',
          bgcolor: 'background.neutral',
          border: (t) => `1px solid ${t.vars.palette.divider}`,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
        }),
        ...(isHighlighted && {
          animation: 'highlight-pulse 2s ease-in-out',
          '@keyframes highlight-pulse': {
            '0%': { bgcolor: 'primary.light' },
            '50%': { bgcolor: 'primary.main', color: 'primary.contrastText' },
            '100%': { bgcolor: me ? 'primary.lighter' : 'background.neutral' },
          },
        }),
      }}
    >
      {message.isDeleted ? (
        <>
          <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ color: 'text.disabled' }} />
          This message was deleted
        </>
      ) : isEditing ? (
        <Stack spacing={1} sx={{ width: '100%', minWidth: 240 }}>
          <TextField
            fullWidth
            multiline
            value={editText}
            onChange={(e) => {
              const val = e.target.value;
              if (val.length > 4000) {
                toast.error('Message is too long (maximum 4000 characters)');
                setEditText(val.substring(0, 4000));
              } else {
                setEditText(val);
              }
            }}
            size="small"
            variant="standard"
            autoFocus
            inputProps={{ maxLength: 4000 }}
            InputProps={{
              disableUnderline: true,
              sx: {
                typography: 'body2',
                color: 'inherit',
                p: 0,
              },
            }}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
            <IconButton size="small" onClick={handleEditCancel} sx={{ color: 'text.secondary' }}>
              <Iconify icon="eva:close-fill" width={16} />
            </IconButton>
            <IconButton size="small" onClick={handleEditSave} sx={{ color: 'primary.main' }}>
              <Iconify icon="eva:checkmark-fill" width={16} />
            </IconButton>
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={1} sx={{ width: '100%' }}>
          {(parentMessage || message.parentMessage) && (() => {
            const pm = parentMessage || message.parentMessage;
            const isImage = checkIsImage(pm);
            const imgUrl = getImageUrl(pm);
            return (
              <Box
                onClick={handleJumpToParent}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  bgcolor: me ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.04)',
                  borderLeft: (t) => `4px solid ${t.vars.palette.primary.main}`,
                  cursor: 'pointer',
                  opacity: 0.9,
                  '&:hover': { opacity: 1 },
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {isImage && imgUrl && (
                  <Box
                    component="img"
                    src={imgUrl}
                    alt="parent reply preview"
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 0.5,
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                )}
                <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {pm.senderId === user?.id ? 'You' : (participants.find(p => p.id === pm.senderId)?.name || 'User')}
                  </Typography>
                  <Typography variant="body2" noWrap sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                    {isImage
                      ? `📷 Photo${pm.body && !pm.body.startsWith('data:') && !pm.body.startsWith('http') ? `: ${pm.body}` : ''}`
                      : pm.body === 'gif'
                      ? '[GIF]'
                      : ((pm.body ?? pm.text ?? pm.message ?? '') || 'File')}
                  </Typography>
                </Stack>
              </Box>
            );
          })()}

          {isGroupInvite && groupInviteData ? (
            <Stack spacing={1.5} sx={{ width: 260 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar src={groupInviteData.groupAvatar} alt={groupInviteData.groupName} sx={{ width: 48, height: 48 }} />
                <Stack spacing={0}>
                  <Typography variant="subtitle2">{groupInviteData.groupName || 'Group Chat'}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {groupInviteData.memberCount || 0} members
                  </Typography>
                </Stack>
              </Stack>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="small"
                onClick={async () => {
                  try {
                    const res = await joinGroupByLink(groupInviteData.inviteLink);
                    if (res?.status === 'pending' || res?.message?.toLowerCase().includes('request') || res?.data?.needsApproval || res?.needsApproval) {
                      toast.success('Join request sent to group admins for approval.');
                    } else {
                      toast.success('Joined group successfully!');
                    }
                  } catch (err: any) {
                    toast.error(err.message || err.error || 'Failed to join group. You might already be a member, or the link requires approval.');
                  }
                }}
              >
                Join Group
              </Button>
            </Stack>
          ) : hasImage ? (
            <Stack spacing={1} sx={{ width: '100%' }}>
              <Box
                component="img"
                alt="attachment"
                src={imageUrl}
                onClick={() => onOpenLightbox(imageUrl)}
                sx={{
                  width: 1,
                  maxWidth: { xs: 240, sm: 320, md: 400 },
                  height: 'auto',
                  borderRadius: 1,
                  cursor: 'pointer',
                  objectFit: 'cover',
                  aspectRatio: '16/11',
                  '&:hover': { opacity: 0.9 },
                }}
              />
              {captionText && (
                <Typography
                  variant="body2"
                  sx={{
                    px: 0.5,
                    pb: 0.5,
                    color: me ? 'grey.800' : 'text.primary',
                  }}
                >
                  {renderTextWithLinks(captionText)}
                </Typography>
              )}
            </Stack>
          ) : isAudio ? (
            <Box sx={{ width: 280, pt: 1 }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={audioUrl} style={{ width: '100%', height: 40, outline: 'none' }} />
            </Box>
          ) : message.attachments && message.attachments.length > 0 ? (
            <Stack spacing={1} sx={{ width: 220, p: 0.5 }}>
              {message.attachments.map((att, idx) => (
                <Stack
                  key={att.name + idx}
                  spacing={1.5}
                  direction="row"
                  alignItems="center"
                  onClick={() => window.open(att.preview || att.path, '_blank')}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: me ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                    '&:hover': {
                      bgcolor: me ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.06)',
                    },
                  }}
                >
                  <FileThumbnail
                    file={att.name}
                    slotProps={{ icon: { width: 24, height: 24 } }}
                    sx={{ width: 40, height: 40 }}
                  />

                  <Stack spacing={0.25} sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="subtitle2" noWrap sx={{ fontSize: '13px', color: me ? 'inherit' : 'text.primary' }}>
                      {att.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: me ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary', fontSize: '11px' }}>
                      {fData(att.size)}
                    </Typography>
                  </Stack>

                  <Iconify icon="solar:download-minimalistic-bold" width={20} sx={{ color: me ? 'inherit' : 'text.secondary' }} />
                </Stack>
              ))}
              {captionText && (
                <Typography
                  variant="body2"
                  sx={{
                    px: 0.5,
                    pt: 0.5,
                    color: me ? 'grey.800' : 'text.primary',
                  }}
                >
                  {renderTextWithLinks(captionText)}
                </Typography>
              )}
            </Stack>
          ) : (
            <>
              {(() => {
                if (body.length > 300 && !isExpanded) {
                  return (
                    <>
                      {renderTextWithLinks(body.slice(0, 300))}...{' '}
                      <Box
                        component="span"
                        onClick={() => setIsExpanded(true)}
                        sx={{
                          color: me ? 'inherit' : 'primary.main',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        Read more
                      </Box>
                    </>
                  );
                }
                if (body.length > 300) {
                  return (
                    <>
                      {renderTextWithLinks(body)}{' '}
                      <Box
                        component="span"
                        onClick={() => setIsExpanded(false)}
                        sx={{
                          color: me ? 'inherit' : 'primary.main',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                          display: 'inline-block',
                          ml: 0.5,
                        }}
                      >
                        Read less
                      </Box>
                    </>
                  );
                }
                return renderTextWithLinks(body);
              })()}
            </>
          )}
        </Stack>
      )}
    </Stack>
  );

  const renderActions = !message.isDeleted && !isEditing && (
    <Stack
      direction="row"
      className="message-actions"
      sx={{
        top: '50%',
        opacity: 0,
        display: { xs: 'none', md: 'flex' },
        position: 'absolute',
        transform: 'translateY(-50%)',
        transition: (t) =>
          t.transitions.create(['opacity'], { duration: t.transitions.duration.shorter }),
        // Receiver: actions appear to the RIGHT of the bubble
        left: me ? 'unset' : '100%',
        marginLeft: me ? 0 : '12px',
        // Sender: actions appear to the LEFT of the bubble
        right: me ? '100%' : 'unset',
        marginRight: me ? '12px' : 0,
      }}
    >
      <IconButton size="small" onClick={() => setReplyingToMessage(message)}>
        <Iconify icon="solar:reply-bold" width={16} />
      </IconButton>

      <IconButton size="small" onClick={() => setForwardDialogOpen(true)}>
        <Iconify icon="solar:share-bold" width={16} />
      </IconButton>

      <IconButton size="small" onClick={handleOpenReactions}>
        <Iconify icon="eva:smiling-face-fill" width={16} />
      </IconButton>

      {me && isTextMsg && (
        <IconButton size="small" onClick={handleEditStart}>
          <Iconify icon="solar:pen-bold" width={16} />
        </IconButton>
      )}

      <IconButton size="small" onClick={handleDeleteOpen}>
        <Iconify icon="solar:trash-bin-trash-bold" width={16} />
      </IconButton>
    </Stack>
  );

  const renderReactions = message.reactions && message.reactions.length > 0 && (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        mt: 0.5,
        alignItems: 'center',
        ...(me && { justifyContent: 'flex-end' }),
      }}
    >
      {Object.entries(
        message.reactions.reduce((acc: Record<string, number>, curr) => {
          acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
          return acc;
        }, {})
      ).map(([emoji, count]) => {
        const hasReacted = message.reactions?.some(
          (r) => r.senderId === user?.id && r.emoji === emoji
        );
        return (
          <Box
            key={emoji}
            onClick={() => handleReact(emoji)}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: hasReacted ? 'primary.lighter' : 'background.neutral',
              border: (t) =>
                `1px solid ${hasReacted ? t.vars.palette.primary.light : t.vars.palette.divider}`,
              cursor: 'pointer',
              fontSize: 12,
              '&:hover': {
                bgcolor: hasReacted ? 'primary.light' : 'action.hover',
              },
            }}
          >
            <span>{emoji}</span>
            {count > 1 && (
              <Box
                component="span"
                sx={{
                  ml: 0.5,
                  fontWeight: 'fontWeightBold',
                  color: hasReacted ? 'primary.darker' : 'text.secondary',
                }}
              >
                {count}
              </Box>
            )}
          </Box>
        );
      })}
    </Stack>
  );

  const renderReactionPopover = (
    <Popover
      open={Boolean(reactionAnchorEl)}
      anchorEl={reactionAnchorEl}
      onClose={handleCloseReactions}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
      PaperProps={{
        sx: {
          p: 0.5,
          borderRadius: 1.5,
          boxShadow: (t) => t.customShadows.dropdown,
        },
      }}
    >
      <Stack direction="row" spacing={0.5}>
        {emojisList.map((emoji) => (
          <IconButton
            key={emoji}
            size="small"
            onClick={() => handleReact(emoji)}
            sx={{
              fontSize: 18,
              transition: 'transform 0.1s',
              '&:hover': {
                transform: 'scale(1.3)',
                backgroundColor: 'transparent',
              },
            }}
          >
            {emoji}
          </IconButton>
        ))}
      </Stack>
    </Popover>
  );

  const renderDeleteDialog = (
    <Dialog open={deleteDialogOpen} onClose={handleDeleteClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete message?</DialogTitle>
      <DialogContent sx={{ color: 'text.secondary' }}>
        Are you sure you want to delete this message? This action cannot be undone.
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDeleteClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={() => handleDeleteConfirm('me')} color="warning">
          Delete for me
        </Button>
        {me && (
          <Button onClick={() => handleDeleteConfirm('everyone')} variant="contained" color="error">
            Delete for everyone
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  const renderMobileActionsPopover = (
    <Popover
      open={Boolean(mobileActionsPosition)}
      anchorReference="anchorPosition"
      anchorPosition={mobileActionsPosition || undefined}
      onClose={handleCloseMobileActions}
      PaperProps={{
        sx: {
          p: 1.5,
          width: 260,
          borderRadius: 1,
          boxShadow: (t) => t.customShadows.dropdown,
        },
      }}
    >
      {/* Emoji Reactions Row */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          pb: 1,
          mb: 1.5,
          borderBottom: (t) => `1px solid ${t.vars.palette.divider}`,
          justifyContent: 'flex-start',
          flexWrap: 'wrap',
          gap: 0.5,
        }}
      >
        {emojisList.map((emoji) => (
          <IconButton
            key={emoji}
            size="small"
            onClick={() => {
              handleReact(emoji);
              handleCloseMobileActions();
            }}
            sx={{
              fontSize: 20,
              transition: 'transform 0.1s',
              '&:hover': {
                transform: 'scale(1.2)',
                backgroundColor: 'transparent',
              },
            }}
          >
            {emoji}
          </IconButton>
        ))}
      </Stack>

      <Stack spacing={0.5}>
        <Button
          fullWidth
          variant="text"
          color="inherit"
          startIcon={<Iconify icon="solar:reply-bold" width={20} />}
          onClick={() => {
            setReplyingToMessage(message);
            handleCloseMobileActions();
          }}
          sx={{ justifyContent: 'flex-start', py: 1 }}
        >
          Reply
        </Button>

        <Button
          fullWidth
          variant="text"
          color="inherit"
          startIcon={<Iconify icon="solar:share-bold" width={20} />}
          onClick={() => {
            setForwardDialogOpen(true);
            handleCloseMobileActions();
          }}
          sx={{ justifyContent: 'flex-start', py: 1 }}
        >
          Forward
        </Button>

        {me && isTextMsg && (
          <Button
            fullWidth
            variant="text"
            color="inherit"
            startIcon={<Iconify icon="solar:pen-bold" width={20} />}
            onClick={() => {
              handleEditStart();
              handleCloseMobileActions();
            }}
            sx={{ justifyContent: 'flex-start', py: 1 }}
          >
            Edit
          </Button>
        )}

        <Button
          fullWidth
          variant="text"
          color="error"
          startIcon={<Iconify icon="solar:trash-bin-trash-bold" width={20} />}
          onClick={() => {
            handleDeleteOpen();
            handleCloseMobileActions();
          }}
          sx={{ justifyContent: 'flex-start', py: 1 }}
        >
          Delete
        </Button>
      </Stack>
    </Popover>
  );

  const isSystem = isSystemMessage(message);

  if (isSystem) {
    return (
      <Stack
        id={`msg-${message.id}`}
        direction="row"
        justifyContent="center"
        sx={{ mb: 3, width: 1 }}
      >
        <Box
          sx={{
            py: 0.75,
            px: 2,
            borderRadius: 1.5,
            bgcolor: theme.vars.palette.background.neutral,
            color: theme.vars.palette.text.secondary,
            fontSize: '12px',
            fontWeight: 500,
            textAlign: 'center',
            maxWidth: '85%',
            wordBreak: 'break-word',
            border: `1px solid ${theme.vars.palette.divider}`,
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
          }}
        >
          {message.body}
        </Box>
      </Stack>
    );
  }

  return (
    <Stack id={`msg-${message.id}`} direction="row" justifyContent={me ? 'flex-end' : 'unset'} sx={{ mb: 3 }}>
      {!me && <Avatar alt={firstName} src={avatarUrl} sx={{ width: 32, height: 32, mr: 2 }} />}

      <Stack alignItems={me ? 'flex-end' : 'flex-start'}>
        {renderInfo}

        <Stack
          direction="row"
          alignItems="center"
          onClick={handleBubbleClick}
          onContextMenu={handleBubbleContextMenu}
          sx={{
            position: 'relative',
            overflow: 'visible',
            '&:hover': { '& .message-actions': { opacity: 1 } },
            cursor: isMobile ? 'pointer' : 'default',
          }}
        >
          {renderBody}
          {renderActions}
        </Stack>

        {renderReactions}
      </Stack>

      {renderReactionPopover}
      {renderMobileActionsPopover}
      {renderDeleteDialog}

      {forwardDialogOpen && (
        <ChatForwardDialog
          open={forwardDialogOpen}
          onClose={() => setForwardDialogOpen(false)}
          messageId={message.id}
        />
      )}

      {!!inviteModalCode && (
        <ChatGroupInviteDialog
          open={!!inviteModalCode}
          onClose={() => setInviteModalCode(null)}
          inviteCode={inviteModalCode}
        />
      )}
    </Stack>
  );
}
