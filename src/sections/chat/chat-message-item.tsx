import type { IChatMessage, IChatParticipant } from 'src/types/chat';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { useSearchParams } from 'src/routes/hooks';

import { fToNow } from 'src/utils/format-time';

import { editMessage, deleteMessage, reactToMessage } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

import { useMessage } from './hooks/use-message';
import { ChatForwardDialog } from './chat-forward-dialog';

// ----------------------------------------------------------------------

type Props = {
  message: IChatMessage;
  participants: IChatParticipant[];
  onOpenLightbox: (value: string) => void;
};

export function ChatMessageItem({ message, participants, onOpenLightbox }: Props) {
  const { user } = useMockedUser();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('id') || '';

  const { me, senderDetails, hasImage } = useMessage({
    message,
    participants,
    currentUserId: `${user?.id}`,
  });

  const { firstName, avatarUrl } = senderDetails;
  const { body, createdAt } = message;

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(body);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Forward Dialog State
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);

  // Reactions Popover State
  const [reactionAnchorEl, setReactionAnchorEl] = useState<HTMLButtonElement | null>(null);

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
    try {
      await editMessage(message.id, editText, [], conversationId);
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
      await deleteMessage(message.id, deleteType, conversationId);
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

  const renderInfo = (
    <Typography
      noWrap
      variant="caption"
      sx={{ mb: 1, color: 'text.disabled', ...(!me && { mr: 'auto' }) }}
    >
      {!me && `${firstName}, `}
      {fToNow(createdAt)}
      {message.editedAt && (
        <Box component="span" sx={{ ml: 1, fontStyle: 'italic', opacity: 0.8 }}>
          (edited)
        </Box>
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
        ...(me && { color: 'grey.800', bgcolor: 'primary.lighter' }),
        ...(hasImage && { p: 0, bgcolor: 'transparent' }),
        ...(message.isDeleted && {
          color: 'text.disabled',
          fontStyle: 'italic',
          bgcolor: 'background.neutral',
          border: (theme) => `1px solid ${theme.vars.palette.divider}`,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
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
            onChange={(e) => setEditText(e.target.value)}
            size="small"
            variant="standard"
            autoFocus
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
      ) : hasImage ? (
        <Box
          component="img"
          alt="attachment"
          src={body}
          onClick={() => onOpenLightbox(body)}
          sx={{
            width: 400,
            height: 'auto',
            borderRadius: 1.5,
            cursor: 'pointer',
            objectFit: 'cover',
            aspectRatio: '16/11',
            '&:hover': { opacity: 0.9 },
          }}
        />
      ) : (
        body
      )}
    </Stack>
  );

  const renderActions = !message.isDeleted && !isEditing && (
    <Stack
      direction="row"
      className="message-actions"
      sx={{
        pt: 0.5,
        left: 0,
        opacity: 0,
        top: '100%',
        position: 'absolute',
        transition: (theme) =>
          theme.transitions.create(['opacity'], { duration: theme.transitions.duration.shorter }),
        ...(me && { right: 0, left: 'unset' }),
      }}
    >
      <IconButton size="small" onClick={() => setForwardDialogOpen(true)}>
        <Iconify icon="solar:share-bold" width={16} />
      </IconButton>

      <IconButton size="small" onClick={handleOpenReactions}>
        <Iconify icon="eva:smiling-face-fill" width={16} />
      </IconButton>

      {me && (
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
              border: (theme) =>
                `1px solid ${hasReacted ? theme.vars.palette.primary.light : theme.vars.palette.divider}`,
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
          boxShadow: (theme) => theme.customShadows.dropdown,
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

  return (
    <Stack direction="row" justifyContent={me ? 'flex-end' : 'unset'} sx={{ mb: 5 }}>
      {!me && <Avatar alt={firstName} src={avatarUrl} sx={{ width: 32, height: 32, mr: 2 }} />}

      <Stack alignItems={me ? 'flex-end' : 'flex-start'}>
        {renderInfo}

        <Stack
          direction="row"
          alignItems="center"
          sx={{ position: 'relative', '&:hover': { '& .message-actions': { opacity: 1 } } }}
        >
          {renderBody}
          {renderActions}
        </Stack>

        {renderReactions}
      </Stack>

      {renderReactionPopover}
      {renderDeleteDialog}

      {forwardDialogOpen && (
        <ChatForwardDialog
          open={forwardDialogOpen}
          onClose={() => setForwardDialogOpen(false)}
          messageId={message.id}
        />
      )}
    </Stack>
  );
}
