import type { IChatParticipant } from 'src/types/chat';

import { mutate } from 'swr';
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
import { useGroupStore } from 'src/store/useGroupStore';
import {
  useGetGroups,
  leaveGroupById,
  addMembersToGroup,
  removeMemberFromGroup,
} from 'src/actions/group';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useMockedUser } from 'src/auth/hooks';

import { CollapseButton } from './styles';
import { ChatGroupEditDialog } from './chat-group-edit-dialog';
import { ChatRoomParticipantDialog } from './chat-room-participant-dialog';

// ----------------------------------------------------------------------

type Props = {
  participants: IChatParticipant[];
  isUserMember?: boolean;
};

export function ChatRoomGroup({ participants, isUserMember = true }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get('id') || '';
  const { user } = useMockedUser();

  const { groups } = useGetGroups();
  const { contacts } = useGetContacts();
  const groupStoreGroups = useGroupStore((state) => state.groups);

  // Primary: match from SWR list (REST)
  const currentGroupFromList = groups.find(
    (g: any) =>
      g.conversationId?._id === selectedConversationId ||
      g.conversationId === selectedConversationId
  );

  // Secondary: match from Zustand store (populated by socket events)
  const currentGroupFromStore = groupStoreGroups[selectedConversationId];

  const currentGroup = currentGroupFromList || currentGroupFromStore || null;

  // groupId: prefer explicit _id, fallback to conversationId so add_members still works
  const groupId = currentGroup?._id || currentGroup?.id || selectedConversationId;

  const collapse = useBoolean(true);
  const [selected, setSelected] = useState<IChatParticipant | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState<IChatParticipant[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Custom Confirmation Modals State
  const confirmRemove = useBoolean();
  const [memberToRemove, setMemberToRemove] = useState<IChatParticipant | null>(null);
  const confirmLeave = useBoolean();

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

      // ─── Optimistic update ──────────────────────────────────────────
      // Immediately patch the conversation SWR cache so the
      // "In room" participant list refreshes without a page reload.
      // We set revalidate: false to prevent a race condition where the
      // refetch completes before the database write is fully committed.
      // The subsequent socket event will handle final safe revalidation.
      const convCacheKey = `/api/v1/chats/conversations/${selectedConversationId}`;
      mutate(
        convCacheKey,
        (current: any) => {
          if (!current?.conversation) return current;
          const existingIds = new Set(
            current.conversation.participants.map((p: IChatParticipant) => p.id)
          );
          const freshParticipants = membersToAdd.filter((m) => !existingIds.has(m.id));
          if (!freshParticipants.length) return current;
          return {
            ...current,
            conversation: {
              ...current.conversation,
              participants: [...current.conversation.participants, ...freshParticipants],
            },
          };
        },
        { revalidate: false }
      );
      // ────────────────────────────────────────────────────────────────

      toast.success('Member(s) added successfully');
      setAddMembersOpen(false);
      setMembersToAdd([]);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add members');
    } finally {
      setIsAddingMembers(false);
    }
  }, [groupId, membersToAdd, selectedConversationId]);

  const handleRemoveMember = useCallback(
    (member: IChatParticipant) => {
      setMemberToRemove(member);
      confirmRemove.onTrue();
    },
    [confirmRemove]
  );

  const handleConfirmRemove = useCallback(async () => {
    if (!groupId || !memberToRemove) {
      toast.error('Group or member not found');
      return;
    }

    try {
      setRemovingMemberId(memberToRemove.id);
      confirmRemove.onFalse();
      await removeMemberFromGroup(groupId, memberToRemove.id);

      // Optimistic update — remove participant from conversation cache instantly
      mutate(
        `/api/v1/chats/conversations/${selectedConversationId}`,
        (current: any) => {
          if (!current?.conversation) return current;
          return {
            ...current,
            conversation: {
              ...current.conversation,
              participants: current.conversation.participants.filter(
                (p: IChatParticipant) => p.id !== memberToRemove.id
              ),
            },
          };
        },
        { revalidate: false }
      );

      toast.success(`${memberToRemove.name} removed from group`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
      setMemberToRemove(null);
    }
  }, [groupId, memberToRemove, selectedConversationId, confirmRemove]);

  const handleLeaveGroup = useCallback(async () => {
    confirmLeave.onTrue();
  }, [confirmLeave]);

  const handleConfirmLeave = useCallback(async () => {
    if (!groupId) {
      toast.error('Group not found');
      return;
    }

    try {
      setIsLeavingGroup(true);
      confirmLeave.onFalse();
      await leaveGroupById(groupId);
      toast.success('You left the group');
      router.push(paths.dashboard.chat);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to leave group');
    } finally {
      setIsLeavingGroup(false);
    }
  }, [groupId, router, confirmLeave]);

  const totalParticipants = participants.length;

  const renderGroupInfo = (
    <Stack alignItems="center" sx={{ py: 3, px: 2, position: 'relative', width: '100%' }}>
      {/* Settings gear — only if we have group metadata */}
      {currentGroup && isUserMember && (
        <IconButton
          onClick={() => setSettingsOpen(true)}
          size="small"
          sx={{ position: 'absolute', top: 8, right: 8 }}
          title="Group settings"
        >
          <Iconify icon="solar:settings-bold" width={18} />
        </IconButton>
      )}

      {/* Avatar */}
      <Avatar
        alt={currentGroup?.groupName || 'Group'}
        src={currentGroup?.groupAvatar || ''}
        sx={{ width: 72, height: 72, mb: 1.5 }}
      />

      {/* Group name — bounded, no overflow */}
      <Typography
        variant="subtitle1"
        noWrap
        sx={{ maxWidth: '100%', px: 4, textAlign: 'center', fontWeight: 600 }}
      >
        {currentGroup?.groupName || 'Group Chat'}
      </Typography>

      {/* Description — max 2 lines */}
      {currentGroup?.description && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            mt: 0.5,
            textAlign: 'center',
            px: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {currentGroup.description}
        </Typography>
      )}

      {/* Member count badge */}
      <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5 }}>
        {participants.length} member{participants.length !== 1 ? 's' : ''}
      </Typography>

      {/* Action buttons — icon-only with tooltip to prevent overflow */}
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <IconButton
          onClick={handleOpenAddMembers}
          disabled={!isUserMember}
          size="small"
          title="Add member"
          sx={{
            bgcolor: 'primary.soft',
            color: 'primary.main',
            border: '1px solid',
            borderColor: 'primary.light',
            borderRadius: 1.5,
            px: 1.5,
            py: 0.75,
            gap: 0.75,
            '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' },
            '&.Mui-disabled': { opacity: 0.5 },
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Iconify icon="solar:user-plus-bold" width={16} />
          <Box component="span" sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            Add member
          </Box>
        </IconButton>

        <IconButton
          onClick={handleLeaveGroup}
          disabled={isLeavingGroup || !isUserMember}
          size="small"
          title={isUserMember ? "Leave group" : "Already left group"}
          sx={{
            bgcolor: 'error.soft',
            color: 'error.main',
            border: '1px solid',
            borderColor: 'error.light',
            borderRadius: 1.5,
            px: 1.5,
            py: 0.75,
            gap: 0.75,
            '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' },
            '&.Mui-disabled': { opacity: 0.5 },
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Iconify icon="solar:logout-3-bold" width={16} />
          <Box component="span" sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {isUserMember ? 'Leave' : 'Left'}
          </Box>
        </IconButton>
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

          {isUserMember && participant.id !== user?.id && (
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

      {memberToRemove && (
        <ConfirmDialog
          open={confirmRemove.value}
          onClose={() => {
            confirmRemove.onFalse();
            setMemberToRemove(null);
          }}
          title="Remove Member"
          content={`Are you sure you want to remove ${memberToRemove.name} from this group?`}
          action={
            <Button variant="contained" color="error" onClick={handleConfirmRemove}>
              Remove
            </Button>
          }
        />
      )}

      <ConfirmDialog
        open={confirmLeave.value}
        onClose={confirmLeave.onFalse}
        title="Leave Group"
        content="Are you sure you want to leave this group?"
        action={
          <Button variant="contained" color="error" onClick={handleConfirmLeave}>
            Leave
          </Button>
        }
      />
    </>
  );
}
