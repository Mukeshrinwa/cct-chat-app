import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import AvatarGroup from '@mui/material/AvatarGroup';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';
import InputAdornment from '@mui/material/InputAdornment';

import { forwardMessage, useGetConversations } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  messageId: string;
};

export function ChatForwardDialog({ open, onClose, messageId }: Props) {
  const { user } = useMockedUser();
  const { conversations, conversationsLoading } = useGetConversations();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const conversationList = useMemo(() => {
    if (!conversations || !conversations.allIds) return [];
    return conversations.allIds.map((id) => conversations.byId[id]);
  }, [conversations]);

  const resolvedConversations = useMemo(() => {
    if (!user?.id) return [];
    return conversationList.map((conv) => {
      const participantsInConversation = conv.participants.filter(
        (p) => p.id !== user.id
      );
      const isGroup = participantsInConversation.length > 1;
      const displayName = participantsInConversation.map((p) => p.name).join(', ');
      return {
        ...conv,
        isGroup,
        displayName,
        participantsInConversation,
      };
    });
  }, [conversationList, user?.id]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return resolvedConversations;
    return resolvedConversations.filter((conv) =>
      conv.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [resolvedConversations, searchQuery]);

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedIds.length === 0) return;
    try {
      setLoading(true);
      await forwardMessage(messageId, selectedIds);
      toast.success('Message forwarded successfully');
      setSelectedIds([]);
      onClose();
    } catch (error) {
      toast.error('Failed to forward message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Iconify icon="solar:share-bold" width={24} sx={{ color: 'primary.main' }} />
        <Typography variant="h6">Forward message</Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ px: 3, pt: 1, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" width={18} sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <List sx={{ px: 2, maxHeight: 320, overflow: 'auto', minHeight: 180 }}>
          {conversationsLoading ? (
            <Stack sx={{ py: 5 }} alignItems="center" justifyContent="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Loading conversations...
              </Typography>
            </Stack>
          ) : filteredConversations.length === 0 ? (
            <Stack sx={{ py: 5 }} alignItems="center" justifyContent="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No conversations found
              </Typography>
            </Stack>
          ) : (
            filteredConversations.map((conv) => {
              const selected = selectedIds.includes(conv.id);
              const singleParticipant = conv.participantsInConversation[0];

              const renderAvatar = conv.isGroup ? (
                <AvatarGroup variant="compact" sx={{ width: 40, height: 40 }}>
                  {conv.participantsInConversation.slice(0, 2).map((p) => (
                    <Avatar key={p.id} alt={p.name} src={p.avatarUrl} sx={{ width: 24, height: 24 }} />
                  ))}
                </AvatarGroup>
              ) : (
                <Avatar
                  alt={singleParticipant?.name}
                  src={singleParticipant?.avatarUrl}
                  sx={{ width: 40, height: 40 }}
                />
              );

              return (
                <ListItemButton
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  {renderAvatar}
                  <ListItemText
                    primary={conv.displayName}
                    primaryTypographyProps={{ variant: 'subtitle2', noWrap: true }}
                    sx={{ ml: 2 }}
                  />
                  <Checkbox checked={selected} color="primary" />
                </ListItemButton>
              );
            })
          )}
        </List>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          color="primary"
          onClick={handleForward}
          loading={loading}
          disabled={selectedIds.length === 0}
        >
          Forward {selectedIds.length > 0 && `(${selectedIds.length})`}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
