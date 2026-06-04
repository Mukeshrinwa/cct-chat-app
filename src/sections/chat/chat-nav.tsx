import type { IChatMessage, IChatParticipant, IChatConversations } from 'src/types/chat';

import { mutate } from 'swr';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import ClickAwayListener from '@mui/material/ClickAwayListener';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useResponsive } from 'src/hooks/use-responsive';

import { globalSearch, getMessageContext, archiveConversation } from 'src/actions/chat';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import { useMockedUser } from 'src/auth/hooks';

import { ToggleButton } from './styles';
import { ChatNavItem } from './chat-nav-item';
import { ChatNavAccount } from './chat-nav-account';
import { ChatNavItemSkeleton } from './chat-skeleton';
import { ChatNavSearchResults } from './chat-nav-search-results';
import { ChatGroupCreateDialog } from './chat-group-create-dialog';

import type { UseNavCollapseReturn } from './hooks/use-collapse-nav';

// ----------------------------------------------------------------------

const NAV_WIDTH = 320;

const NAV_COLLAPSE_WIDTH = 96;

type Props = {
  loading: boolean;
  selectedConversationId: string;
  contacts: IChatParticipant[];
  collapseNav: UseNavCollapseReturn;
  conversations: IChatConversations;
  onSelectContact?: (contact: IChatParticipant) => void;
};

export function ChatNav({
  loading,
  contacts,
  conversations,
  collapseNav,
  selectedConversationId,
  onSelectContact,
}: Props) {
  const theme = useTheme();

  const router = useRouter();

  const { user } = useMockedUser();

  const mdUp = useResponsive('up', 'md');

  const {
    openMobile,
    onOpenMobile,
    onCloseMobile,
    onCloseDesktop,
    collapseDesktop,
    onCollapseDesktop,
  } = collapseNav;

  const [groupCreateOpen, setGroupCreateOpen] = useState(false);

  const [showArchived, setShowArchived] = useState(false);

  const [archivedIds, setArchivedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cct_archived_conversations');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    const handleArchiveChange = () => {
      try {
        const saved = localStorage.getItem('cct_archived_conversations');
        setArchivedIds(saved ? JSON.parse(saved) : []);
      } catch (e) {
        console.error('Failed to load archived conversations on change:', e);
      }
    };

    window.addEventListener('cct_archive_changed', handleArchiveChange);
    return () => {
      window.removeEventListener('cct_archive_changed', handleArchiveChange);
    };
  }, []);

  const handleArchive = useCallback(async (id: string) => {
    try {
      await archiveConversation(id);
    } catch (err) {
      console.error('Failed to archive on server:', err);
    }
    setArchivedIds((prev) => {
      const updated = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem('cct_archived_conversations', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleUnarchive = useCallback(async (id: string) => {
    try {
      await archiveConversation(id);
    } catch (err) {
      console.error('Failed to unarchive on server:', err);
    }
    setArchivedIds((prev) => {
      const updated = prev.filter((item) => item !== id);
      localStorage.setItem('cct_archived_conversations', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Unique participants from all existing conversations (excluding self)
  const chatContacts = useMemo(() => {
    const seen = new Set<string>();
    const result: IChatParticipant[] = [];
    conversations.allIds.forEach((convId) => {
      const conv = conversations.byId[convId];
      if (!conv) return;
      
      // Exclude group conversations so we only show users we have chatted with directly
      const isGroup = conv.type === 'GROUP' || conv.type === 'group';
      if (isGroup) return;

      conv.participants.forEach((p) => {
        if (p.id === user?.id) return;
        if (seen.has(p.id)) return;
        seen.add(p.id);
        result.push(p);
      });
    });
    return result;
  }, [conversations, user]);

  const [searchContacts, setSearchContacts] = useState<{
    query: string;
    users: IChatParticipant[];
    messages: IChatMessage[];
    loading: boolean;
  }>({ query: '', users: [], messages: [], loading: false });

  useEffect(() => {
    if (!mdUp) {
      onCloseDesktop();
    }
  }, [onCloseDesktop, mdUp]);

  const handleToggleNav = useCallback(() => {
    if (mdUp) {
      onCollapseDesktop();
    } else {
      onCloseMobile();
    }
  }, [mdUp, onCloseMobile, onCollapseDesktop]);

  const handleClickCompose = useCallback(() => {
    if (!mdUp) {
      onCloseMobile();
    }
    router.push(paths.dashboard.chat);
  }, [mdUp, onCloseMobile, router]);

  // Search using globalSearch API
  const handleSearchContacts = useCallback(async (inputValue: string) => {
    setSearchContacts((prevState) => ({ ...prevState, query: inputValue, loading: !!inputValue }));

    if (!inputValue) {
      setSearchContacts({ query: '', users: [], messages: [], loading: false });
      return;
    }

    try {
      const { users, messages } = await globalSearch(inputValue);
      setSearchContacts((prevState) => {
        if (prevState.query !== inputValue) return prevState;
        return {
          query: inputValue,
          users,
          messages,
          loading: false,
        };
      });
    } catch (err) {
      console.error('Failed to search globally:', err);
      setSearchContacts((prevState) => (prevState.query === inputValue ? { ...prevState, loading: false } : prevState));
    }
  }, []);

  const handleClickAwaySearch = useCallback(() => {
    setSearchContacts({ query: '', users: [], messages: [], loading: false });
  }, []);

  const handleClickResult = useCallback(
    (result: IChatParticipant) => {
      handleClickAwaySearch();

      // Check if we already have a direct conversation with this user
      const existingConv = conversations.allIds.find((convId) => {
        const conv = conversations.byId[convId];
        if (!conv || conv.type === 'GROUP' || conv.type === 'group') return false;
        return conv.participants.some((p) => p.id === result.id);
      });

      if (existingConv) {
        // Navigate to the existing conversation
        router.push(`${paths.dashboard.chat}?id=${existingConv}`);
      } else {
        // Navigate to the conversation (backend will resolve recipient ID check)
        router.push(`${paths.dashboard.chat}?id=${result.id}`);
      }
    },
    [handleClickAwaySearch, router, conversations]
  );

  const handleClickMessage = useCallback(
    async (message: IChatMessage) => {
      handleClickAwaySearch();

      const msgAny = message as any;
      const convId = typeof msgAny.conversationId === 'object'
        ? (msgAny.conversationId._id || msgAny.conversationId.id)
        : msgAny.conversationId;

      if (!convId) return;

      router.push(`${paths.dashboard.chat}?id=${convId}&messageId=${message.id}`);

      try {
        const contextMessages = await getMessageContext(convId, message.id);
        if (contextMessages && contextMessages.length > 0) {
          mutate(
            `/api/v1/chats/conversations/${convId}`,
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
    },
    [handleClickAwaySearch, router]
  );

  const renderLoading = <ChatNavItemSkeleton />;

  const renderList = (
    <nav>
      <Box component="ul">
        {conversations.allIds
          .filter((conversationId) => {
            const isIncluded = archivedIds.includes(conversationId);
            return showArchived ? isIncluded : !isIncluded;
          })
          .map((conversationId) => (
            <ChatNavItem
              key={conversationId}
              collapse={collapseDesktop}
              conversation={conversations.byId[conversationId]}
              selected={conversationId === selectedConversationId}
              onCloseMobile={onCloseMobile}
              isArchived={archivedIds.includes(conversationId)}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
            />
          ))}
      </Box>
    </nav>
  );

  const renderListResults = (
    <ChatNavSearchResults
      query={searchContacts.query}
      users={searchContacts.users}
      messages={searchContacts.messages}
      loading={searchContacts.loading}
      onClickUser={handleClickResult}
      onClickMessage={handleClickMessage}
    />
  );

  const renderArchivedHeader = !collapseDesktop && (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, pb: 1 }}>
      <IconButton onClick={() => setShowArchived(false)}>
        <Iconify icon="eva:arrow-back-fill" />
      </IconButton>
      <Typography variant="subtitle1">Archived Chats</Typography>
    </Stack>
  );

  const renderArchivedBar = !collapseDesktop && !searchContacts.query && (
    <Box
      onClick={() => setShowArchived(true)}
      sx={{
        py: 1.75,
        px: 2,
        mx: 1.5,
        my: 0.5,
        borderRadius: 1,
        bgcolor: 'background.neutral',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 2.5,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Iconify icon="solar:archive-down-minimlistic-bold" sx={{ width: 20, height: 20, color: 'text.secondary' }} />
      <Typography variant="subtitle2" sx={{ color: 'text.primary', flexGrow: 1 }}>
        Archived Chats
      </Typography>
      {archivedIds.length > 0 && (
        <Badge
          badgeContent={archivedIds.length}
          color="primary"
          sx={{
            '& .MuiBadge-badge': {
              position: 'static',
              transform: 'none',
            },
          }}
        />
      )}
    </Box>
  );

  const renderSearchInput = (
    <TextField
      fullWidth
      value={searchContacts.query}
      onChange={(event) => handleSearchContacts(event.target.value)}
      placeholder="Search by username..."
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
          </InputAdornment>
        ),
      }}
      sx={{ mt: 2.5 }}
    />
  );

  const renderContent = (
    <ClickAwayListener onClickAway={handleClickAwaySearch}>
      <Stack sx={{ height: 1, minHeight: 0 }}>
        {showArchived ? (
          renderArchivedHeader
        ) : (
          <Stack direction="row" alignItems="center" justifyContent="center" sx={{ p: 2.5, pb: 0 }}>
            {!collapseDesktop && (
              <>
                <ChatNavAccount />
                <Box sx={{ flexGrow: 1 }} />
              </>
            )}

            <IconButton onClick={handleToggleNav}>
              <Iconify
                icon={collapseDesktop ? 'eva:arrow-ios-forward-fill' : 'eva:arrow-ios-back-fill'}
              />
            </IconButton>

            {!collapseDesktop && (
              <Stack direction="row" spacing={0.5}>
                <IconButton onClick={() => setGroupCreateOpen(true)} title="Create Group">
                  <Iconify width={24} icon="solar:users-group-two-rounded-bold" />
                </IconButton>
                <IconButton onClick={handleClickCompose} title="New Chat">
                  <Iconify width={24} icon="solar:user-plus-bold" />
                </IconButton>
              </Stack>
            )}
          </Stack>
        )}

        <Box sx={{ px: 1.5, pt: 0, pb: 1 }}>{!collapseDesktop && !showArchived && renderSearchInput}</Box>

        {!showArchived && renderArchivedBar}

        {loading ? (
          renderLoading
        ) : (
          <Scrollbar sx={{ pb: 1 }}>
            {searchContacts.query ? renderListResults : renderList}
          </Scrollbar>
        )}
      </Stack>
    </ClickAwayListener>
  );

  return (
    <>
      <ToggleButton onClick={onOpenMobile} sx={{ display: { md: 'none' } }}>
        <Iconify width={16} icon="solar:users-group-rounded-bold" />
      </ToggleButton>

      <Stack
        sx={{
          minHeight: 0,
          flex: '1 1 auto',
          width: NAV_WIDTH,
          display: { xs: 'none', md: 'flex' },
          borderRight: `solid 1px ${theme.vars.palette.divider}`,
          transition: theme.transitions.create(['width'], {
            duration: theme.transitions.duration.shorter,
          }),
          ...(collapseDesktop && { width: NAV_COLLAPSE_WIDTH }),
        }}
      >
        {renderContent}
      </Stack>

      <Drawer
        open={openMobile}
        onClose={onCloseMobile}
        slotProps={{ backdrop: { invisible: true } }}
        PaperProps={{ sx: { width: NAV_WIDTH } }}
      >
        {renderContent}
      </Drawer>

      {groupCreateOpen && (
        <ChatGroupCreateDialog
          open={groupCreateOpen}
          onClose={() => setGroupCreateOpen(false)}
          chatContacts={chatContacts}
        />
      )}
    </>
  );
}
