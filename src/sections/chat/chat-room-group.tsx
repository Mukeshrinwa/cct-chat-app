// Trigger HMR
import type { IChatParticipant } from 'src/types/chat';

import { mutate } from 'swr';
import { useRef, useMemo, useState, useCallback } from 'react';

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
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ListItemButton from '@mui/material/ListItemButton';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useBoolean } from 'src/hooks/use-boolean';

import { searchUsers } from 'src/api/user';
import { useGroupStore } from 'src/store/useGroupStore';
import { socketManager } from 'src/socket/socket-service';
import {
  useGetGroups,
  leaveGroupById,
  rejectJoinRequest,
  useGetJoinRequests,
  approveJoinRequest,
  removeMemberFromGroup,
  bulkHandleJoinRequests,
} from 'src/actions/group';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { useMockedUser } from 'src/auth/hooks';

import { CollapseButton } from './styles';
import { ChatGroupEditDialog } from './chat-group-edit-dialog';
import { ChatAvatarPreviewDialog } from './chat-avatar-preview-dialog';
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

  // ── Derive "In room" participants directly from group API data ──────────
  // Group API returns full user objects in members[] + admins[].
  // We merge them (dedup by id) so the list is always up-to-date without refresh.
  const groupParticipants: IChatParticipant[] = useMemo(() => {
    if (!currentGroup) return participants; // fallback while group data loads

    const mapGroupUser = (u: any): IChatParticipant => ({
      id: u.id || u._id || '',
      name: u.name || u.displayName || 'User',
      username: u.username || '',
      role: u.role || 'user',
      email: u.email || '',
      address: u.address || '',
      avatarUrl: u.avatar || u.avatarUrl || u.photoURL || '',
      phoneNumber: u.phoneNumber || '',
      lastActivity: u.lastActivity || new Date().toISOString(),
      status: (u.status as any) || 'offline',
    });

    const seen = new Set<string>();
    const result: IChatParticipant[] = [];

    const addUnique = (u: any) => {
      const id = u.id || u._id || '';
      if (id && !seen.has(id)) {
        seen.add(id);
        result.push(mapGroupUser(u));
      }
    };

    // admins first, then remaining members
    (currentGroup.admins || []).forEach(addUnique);
    (currentGroup.members || []).forEach(addUnique);

    return result.length > 0 ? result : participants;
  }, [currentGroup, participants]);
  // ────────────────────────────────────────────────────────────────────────

  const collapse = useBoolean(true);
  const [selected, setSelected] = useState<IChatParticipant | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState<IChatParticipant[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatarPreviewOpen(true);
  }, []);

  // Custom Confirmation Modals State
  const confirmRemove = useBoolean();
  const [memberToRemove, setMemberToRemove] = useState<IChatParticipant | null>(null);
  const confirmLeave = useBoolean();
  const requestsCollapse = useBoolean(true);

  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [bulkActioning, setBulkActioning] = useState<'approve' | 'reject' | null>(null);

  const existingParticipantIds = useMemo(() => new Set(groupParticipants.map((participant) => participant.id)), [groupParticipants]);

  const [searchRecipients, setSearchRecipients] = useState('');
  const [options, setOptions] = useState<IChatParticipant[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = useCallback(
    (event: any, newValue: string) => {
      setSearchRecipients(newValue);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!newValue.trim()) {
        setOptions([]);
        setLoadingSearch(false);
        return;
      }

      setLoadingSearch(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const users = await searchUsers(newValue);
          const mapped = users.map((u: any) => ({
            id: u._id,
            name: u.name,
            username: u.username,
            role: u.role || 'user',
            email: '',
            address: '',
            avatarUrl: u.avatar || '',
            phoneNumber: '',
            lastActivity: u.lastSeen || new Date().toISOString(),
            status: u.isOnline ? ('online' as const) : ('offline' as const),
          }));
          setOptions(mapped.filter((opt: any) => !existingParticipantIds.has(opt.id) && opt.id !== user?.id));
        } catch (error) {
          console.error('Failed to search users globally:', error);
          setOptions([]);
        } finally {
          setLoadingSearch(false);
        }
      }, 400);
    },
    [existingParticipantIds, user?.id]
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
    setSearchRecipients('');
    setOptions([]);
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
      const newMemberIds = membersToAdd.map((member) => member.id);
      
      // Emit socket event to notify backend and other clients
      socketManager.addMembers({ groupId, members: newMemberIds });

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

  const totalParticipants = groupParticipants.length;

  const actualGroupId = currentGroup?._id || currentGroup?.id || '';
  const { requests } = useGetJoinRequests(actualGroupId);

  const handleApproveRequest = async (reqId: string) => {
    try {
      setApproving(reqId);
      await approveJoinRequest(groupId, reqId);
      toast.success('Request approved');
    } catch {
      toast.error('Failed to approve request');
    } finally {
      setApproving(null);
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    try {
      setRejecting(reqId);
      await rejectJoinRequest(groupId, reqId);
      toast.success('Request rejected');
    } catch {
      toast.error('Failed to reject request');
    } finally {
      setRejecting(null);
    }
  };

  const handleBulkRequests = async (action: 'approve' | 'reject') => {
    try {
      setBulkActioning(action);
      const reqIds = requests.map((req: any) => req._id || req.id);
      await bulkHandleJoinRequests(groupId, action, reqIds);
      toast.success(`All requests ${action}d`);
    } catch {
      toast.error(`Failed to bulk ${action} requests`);
    } finally {
      setBulkActioning(null);
    }
  };

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
        onClick={handleAvatarClick}
        sx={{ width: 72, height: 72, mb: 1.5, cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
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
        {groupParticipants.length} member{groupParticipants.length !== 1 ? 's' : ''}
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


  // Derive owner id and admin ids from currentGroup
  const rawOwnerId = currentGroup?.owner?.id || currentGroup?.owner?._id || currentGroup?.owner || '';
  const ownerId = String(rawOwnerId);
  const adminIds = new Set<string>(
    (currentGroup?.admins || []).map((a: any) => String(a.id || a._id || a))
  );

  const renderList = (
    <>
      {groupParticipants.map((participant) => {
        const isOwner = !!ownerId && participant.id === ownerId;
        const isAdmin = !isOwner && adminIds.has(participant.id);

        return (
          <Box key={participant.id} sx={{ display: 'flex', alignItems: 'center' }}>
            <ListItemButton sx={{ flexGrow: 1, minWidth: 0 }} onClick={() => handleOpen(participant)}>
              <Badge
                variant={participant.status}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              >
                <Avatar alt={participant.name} src={participant.avatarUrl} />
              </Badge>

              <Box sx={{ ml: 2, minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    noWrap
                    sx={{ maxWidth: isOwner || isAdmin ? 'calc(100% - 64px)' : '100%' }}
                  >
                    {participant.name}
                  </Typography>

                  {isOwner && (
                    <Box
                      component="span"
                      sx={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1,
                        px: 0.75,
                        py: 0.35,
                        borderRadius: 0.75,
                        bgcolor: 'warning.soft',
                        color: 'warning.dark',
                        border: '1px solid',
                        borderColor: 'warning.light',
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                      }}
                    >
                      Owner
                    </Box>
                  )}

                  {isAdmin && (
                    <Box
                      component="span"
                      sx={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1,
                        px: 0.75,
                        py: 0.35,
                        borderRadius: 0.75,
                        bgcolor: 'info.soft',
                        color: 'info.dark',
                        border: '1px solid',
                        borderColor: 'info.light',
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                      }}
                    >
                      Admin
                    </Box>
                  )}
                </Box>

                <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
                  {participant.username ? `@${participant.username}` : participant.role}
                </Typography>
              </Box>
            </ListItemButton>

            {isUserMember &&
              participant.id !== user?.id &&
              (user?.id === ownerId || adminIds.has(user?.id ?? '')) && (
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
        );
      })}
    </>
  );

  const rawUserId = user?.id || (user as any)?._id || '';
  const userId = String(rawUserId);
  const isAdminOrOwner = !!rawUserId && (userId === ownerId || adminIds.has(userId));

  const renderRequestsList = (
    <Box sx={{ mt: 1 }}>
      {requests.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ px: 2, mb: 1, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            color="error"
            variant="soft"
            disabled={!!bulkActioning}
            onClick={() => handleBulkRequests('reject')}
            sx={{ fontSize: 11, py: 0.25, px: 1 }}
          >
            {bulkActioning === 'reject' ? 'Rejecting...' : 'Reject All'}
          </Button>
          <Button
            size="small"
            color="primary"
            variant="soft"
            disabled={!!bulkActioning}
            onClick={() => handleBulkRequests('approve')}
            sx={{ fontSize: 11, py: 0.25, px: 1 }}
          >
            {bulkActioning === 'approve' ? 'Approving...' : 'Approve All'}
          </Button>
        </Stack>
      )}

      {requests.map((req: any) => {
        const reqId = req._id || req.id;
        const u = req.userId || req.user || {};
        const isApproving = approving === reqId || bulkActioning === 'approve';
        const isRejecting = rejecting === reqId || bulkActioning === 'reject';
        
        return (
          <Box key={reqId} sx={{ display: 'flex', alignItems: 'center', py: 1, px: 2 }}>
            <Avatar src={u.avatar || u.avatarUrl || ''} alt={u.name} sx={{ width: 36, height: 36, mr: 1.5 }} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>{u.name || 'Unknown User'}</Typography>
              <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                {u.username ? `@${u.username}` : ''}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
              <IconButton
                size="small"
                color="primary"
                disabled={isRejecting || isApproving}
                onClick={() => handleApproveRequest(reqId)}
                sx={{ bgcolor: 'primary.soft', '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' } }}
              >
                <Iconify icon="solar:check-circle-bold" width={20} />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                disabled={isRejecting || isApproving}
                onClick={() => handleRejectRequest(reqId)}
                sx={{ bgcolor: 'error.soft', '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' } }}
              >
                <Iconify icon="solar:close-circle-bold" width={20} />
              </IconButton>
            </Stack>
          </Box>
        );
      })}
    </Box>
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

      {isAdminOrOwner && requests?.length > 0 && (
        <>
          <CollapseButton
            selected={requestsCollapse.value}
            onClick={requestsCollapse.onToggle}
            sx={{ mt: 2 }}
          >
            {`Requests (${requests.length})`}
          </CollapseButton>
          <Collapse in={requestsCollapse.value}>{renderRequestsList}</Collapse>
        </>
      )}

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
            options={options}
            value={membersToAdd}
            onInputChange={handleInputChange}
            onChange={(event, value) => setMembersToAdd(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={loadingSearch}
            noOptionsText={loadingSearch ? 'Searching...' : (searchRecipients ? 'No users found' : 'Type to search users')}
            renderInput={(params) => (
              <TextField 
                {...params} 
                placeholder="Search to add users..." 
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingSearch ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Stack direction="row" alignItems="center" spacing={1.2}>
                  <Avatar src={option.avatarUrl} alt={option.name} sx={{ width: 26, height: 26 }} />
                  <Stack>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      @{option.username || option.name}
                    </Typography>
                  </Stack>
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

      <ChatAvatarPreviewDialog
        open={avatarPreviewOpen}
        onClose={() => setAvatarPreviewOpen(false)}
        name={currentGroup?.groupName || 'Group Chat'}
        avatarUrl={currentGroup?.groupAvatar || ''}
      />
    </>
  );
}
