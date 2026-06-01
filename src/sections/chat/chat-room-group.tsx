import type { IChatParticipant } from 'src/types/chat';

import { toast } from 'sonner';
import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ListItemButton from '@mui/material/ListItemButton';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useBoolean } from 'src/hooks/use-boolean';

import { useGetContacts } from 'src/actions/chat';
import {
  useGetGroups,
  leaveGroupById,
  addMembersToGroup,
  removeMemberFromGroup,
} from 'src/actions/group';

import { Iconify } from 'src/components/iconify';

import { useMockedUser } from 'src/auth/hooks';

import { CollapseButton } from './styles';
import { ChatGroupEditDialog } from './chat-group-edit-dialog';
import { ChatRoomParticipantDialog } from './chat-room-participant-dialog';

// ----------------------------------------------------------------------

type Props = {
  participants: IChatParticipant[];
};

export function ChatRoomGroup({ participants }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get('id') || '';
  const { user } = useMockedUser();

  const { groups } = useGetGroups();
  const { contacts } = useGetContacts();

  const currentGroup = groups.find(
    (g: any) =>
      g.conversationId?._id === selectedConversationId ||
      g.conversationId === selectedConversationId
  );

  // Debug: why `currentGroup` may be undefined (helps locate the Add member button)
  // eslint-disable-next-line no-console
  console.debug('[ChatRoomGroup] groups count:', groups?.length, 'selectedConversationId:', selectedConversationId, 'currentGroup:', currentGroup);

  const collapse = useBoolean(true);
  const [selected, setSelected] = useState<IChatParticipant | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState<IChatParticipant[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const groupId = currentGroup?._id || currentGroup?.id;

  const existingParticipantIds = new Set(participants.map((participant) => participant.id));

  const addableContacts = contacts.filter(
    (contact) => !existingParticipantIds.has(contact.id) && contact.id !== user?.id
  );

  const handleOpen = useCallback((participant: IChatParticipant) => {
    setSelected(participant);
  }, []);

  const handleClose = useCallback(() => {
    setSelected(null);
  }, []);

  const handleOpenAddMembers = useCallback(() => {
    setMembersToAdd([]);
    setAddMembersOpen(true);
  }, []);

  const handleCloseAddMembers = useCallback(() => {
    if (isAddingMembers) return;
    setAddMembersOpen(false);
    setMembersToAdd([]);
  }, [isAddingMembers]);

  const handleAddMembers = useCallback(async () => {
    if (!groupId) {
      toast.error('Group not found');
      return;
    }

    if (!membersToAdd.length) {
      toast.error('Please select at least one member');
      return;
    }

    try {
      setIsAddingMembers(true);
      await addMembersToGroup(
        groupId,
        membersToAdd.map((member) => member.id)
      );
      toast.success('Member(s) added successfully');
      setAddMembersOpen(false);
      setMembersToAdd([]);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add members');
    } finally {
      setIsAddingMembers(false);
    }
  }, [groupId, membersToAdd]);

  const handleRemoveMember = useCallback(
    async (member: IChatParticipant) => {
      if (!groupId) {
        toast.error('Group not found');
        return;
      }

      const confirmRemove = window.confirm(`Remove ${member.name} from this group?`);
      if (!confirmRemove) return;

      try {
        setRemovingMemberId(member.id);
        await removeMemberFromGroup(groupId, member.id);
        toast.success(`${member.name} removed from group`);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to remove member');
      } finally {
        setRemovingMemberId(null);
      }
    },
    [groupId]
  );

  const handleLeaveGroup = useCallback(async () => {
    if (!groupId) {
      toast.error('Group not found');
      return;
    }

    const confirmLeave = window.confirm('Are you sure you want to leave this group?');
    if (!confirmLeave) return;

    try {
      setIsLeavingGroup(true);
      await leaveGroupById(groupId);
      toast.success('You left the group');
      router.push(paths.dashboard.chat);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to leave group');
    } finally {
      setIsLeavingGroup(false);
    }
  }, [groupId, router]);

  const totalParticipants = participants.length;

  const renderGroupInfo = currentGroup && (
    <Stack alignItems="center" sx={{ py: 4, px: 2, position: 'relative' }}>
      <IconButton
        onClick={() => setSettingsOpen(true)}
        sx={{ position: 'absolute', top: 10, right: 10 }}
      >
        <Iconify icon="solar:settings-bold" width={20} />
      </IconButton>

      <Avatar
        alt={currentGroup.groupName}
        src={currentGroup.groupAvatar}
        sx={{ width: 88, height: 88, mb: 2 }}
      />
      <Typography variant="subtitle1" noWrap>
        {currentGroup.groupName}
      </Typography>
      {currentGroup.description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, textAlign: 'center' }}>
          {currentGroup.description}
        </Typography>
      )}

      <Stack direction="row" spacing={1.2} sx={{ mt: 2 }}>
        <Button
          size="small"
          variant="soft"
          color="primary"
          onClick={handleOpenAddMembers}
          startIcon={<Iconify icon="solar:user-plus-bold" />}
        >
          Add member
        </Button>

        <Button
          size="small"
          variant="soft"
          color="error"
          disabled={isLeavingGroup}
          onClick={handleLeaveGroup}
          startIcon={<Iconify icon="solar:logout-3-bold" />}
        >
          Leave group
        </Button>
      </Stack>
    </Stack>
  );

  const renderList = (
    <>
      {participants.map((participant) => (
        <Box key={participant.id} sx={{ display: 'flex', alignItems: 'center' }}>
          <ListItemButton sx={{ flexGrow: 1, minWidth: 0 }} onClick={() => handleOpen(participant)}>
            <Badge
              variant={participant.status}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <Avatar alt={participant.name} src={participant.avatarUrl} />
            </Badge>

            <ListItemText
              sx={{ ml: 2 }}
              primary={participant.name}
              secondary={participant.role}
              primaryTypographyProps={{ noWrap: true, typography: 'subtitle2' }}
              secondaryTypographyProps={{ noWrap: true, component: 'span', typography: 'caption' }}
            />
          </ListItemButton>

          {participant.id !== user?.id && (
            <IconButton
              size="small"
              color="error"
              disabled={removingMemberId === participant.id}
              onClick={(event) => {
                event.stopPropagation();
                handleRemoveMember(participant);
              }}
              sx={{ mr: 1 }}
              title="Remove member"
            >
              <Iconify icon="solar:user-minus-bold" width={18} />
            </IconButton>
          )}
        </Box>
      ))}
    </>
  );

  return (
    <>
      {renderGroupInfo}

      {process.env.NODE_ENV !== 'production' && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {currentGroup
              ? `Group: ${currentGroup.groupName || currentGroup.id}`
              : `No group for conversation: ${selectedConversationId || 'none'}`}
          </Typography>
        </Box>
      )}

      <CollapseButton
        selected={collapse.value}
        disabled={!totalParticipants}
        onClick={collapse.onToggle}
      >
        {`In room (${totalParticipants})`}
      </CollapseButton>

      <Collapse in={collapse.value}>{renderList}</Collapse>

      {selected && (
        <ChatRoomParticipantDialog participant={selected} open={!!selected} onClose={handleClose} />
      )}

      {currentGroup && (
        <ChatGroupEditDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          group={currentGroup}
        />
      )}

      <Dialog fullWidth maxWidth="sm" open={addMembersOpen} onClose={handleCloseAddMembers}>
        <DialogTitle>Add members</DialogTitle>

        <DialogContent>
          <Autocomplete
            multiple
            options={addableContacts}
            value={membersToAdd}
            onChange={(event, value) => setMembersToAdd(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} placeholder="Select users" />}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack direction="row" alignItems="center" spacing={1.2}>
                  <Avatar src={option.avatarUrl} alt={option.name} sx={{ width: 26, height: 26 }} />
                  <span>{option.name}</span>
                </Stack>
              </li>
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  label={option.name}
                  size="small"
                  avatar={<Avatar alt={option.name} src={option.avatarUrl} />}
                />
              ))
            }
            noOptionsText="No users available to add"
            sx={{ mt: 1 }}
          />
        </DialogContent>

        <DialogActions>
          <Button color="inherit" onClick={handleCloseAddMembers} disabled={isAddingMembers}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddMembers}
            disabled={isAddingMembers || !membersToAdd.length}
            startIcon={<Iconify icon="solar:user-plus-bold" />}
          >
            {isAddingMembers ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
