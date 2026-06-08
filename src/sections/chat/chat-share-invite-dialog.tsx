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

import { uuidv4 } from 'src/utils/uuidv4';

import { sendMessage, useGetConversations } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  groupData: any;
  inviteLink: string;
};

export function ChatShareInviteDialog({ open, onClose, groupData, inviteLink }: Props) {
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

  const handleShare = async () => {
    if (selectedIds.length === 0 || loading) return;
    try {
      setLoading(true);
      
      const payload = {
        type: 'group_invite',
        groupId: groupData._id || groupData.id,
        groupName: groupData.groupName,
        groupAvatar: groupData.groupAvatar,
        memberCount: (groupData.members?.length || 0) + (groupData.admins?.length || 0),
        inviteLink,
      };
      
      const messageData: any = {
        id: uuidv4(),
        body: JSON.stringify(payload),
        contentType: 'group_invite',
        senderId: user?.id || '',
        createdAt: new Date().toISOString(),
        attachments: [],
      };
      
      // Send message to all selected conversations
      await Promise.all(
        selectedIds.map(convId => sendMessage(convId, messageData))
      );
      
      toast.success('Invite link shared successfully');
      setSelectedIds([]);
      onClose();
    } catch (error) {
      toast.error('Failed to share invite link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Iconify icon="solar:share-bold" width={24} sx={{ color: 'primary.main' }} />
        <Typography variant="h6">Share Invite Link</Typography>
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
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading...</Typography>
            </Stack>
          ) : filteredConversations.length === 0 ? (
            <Stack sx={{ py: 5 }} alignItems="center" justifyContent="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>No conversations found</Typography>
            </Stack>
          ) : (
            filteredConversations.map((conv) => {
              const selected = selectedIds.includes(conv.id);
              const singleParticipant = conv.participantsInConversation[0];

              return (
                <ListItemButton
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  sx={{ borderRadius: 1, mb: 0.5, px: 1.5, py: 1 }}
                >
                  {conv.isGroup ? (
                    <AvatarGroup variant="compact" sx={{ width: 40, height: 40 }}>
                      {conv.participantsInConversation.slice(0, 2).map((p) => (
                        <Avatar key={p.id} alt={p.name} src={p.avatarUrl} sx={{ width: 24, height: 24 }} />
                      ))}
                    </AvatarGroup>
                  ) : (
                    <Avatar alt={singleParticipant?.name} src={singleParticipant?.avatarUrl} sx={{ width: 40, height: 40 }} />
                  )}
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
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={loading}>Cancel</Button>
        <LoadingButton variant="contained" color="primary" onClick={handleShare} loading={loading} disabled={selectedIds.length === 0 || loading}>
          Share {selectedIds.length > 0 && `(${selectedIds.length})`}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
