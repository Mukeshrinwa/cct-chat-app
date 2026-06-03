import type { IChatParticipant, IChatConversations } from 'src/types/chat';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ClickAwayListener from '@mui/material/ClickAwayListener';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useResponsive } from 'src/hooks/use-responsive';

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
    results: IChatParticipant[];
  }>({ query: '', results: [] });

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

  // Search only within users who are already in our conversations
  const handleSearchContacts = useCallback((inputValue: string) => {
    setSearchContacts((prevState) => ({ ...prevState, query: inputValue }));

    if (!inputValue) {
      setSearchContacts({ query: '', results: [] });
      return;
    }

    const queryLower = inputValue.toLowerCase();
    const results: IChatParticipant[] = [];
    const seenIds = new Set<string>();

    conversations.allIds.forEach((convId) => {
      const conv = conversations.byId[convId];
      if (conv && conv.participants) {
        conv.participants.forEach((p) => {
          if (p.id === user?.id) return; // exclude current user
          if (seenIds.has(p.id)) return;

          const nameMatch = p.name?.toLowerCase().includes(queryLower);
          const usernameMatch = p.username?.toLowerCase().includes(queryLower);

          if (nameMatch || usernameMatch) {
            seenIds.add(p.id);
            results.push(p);
          }
        });
      }
    });

    setSearchContacts((prevState) => ({ ...prevState, results }));
  }, [conversations, user]);

  const handleClickAwaySearch = useCallback(() => {
    setSearchContacts({ query: '', results: [] });
  }, []);

  const handleClickResult = useCallback(
    (result: IChatParticipant) => {
      handleClickAwaySearch();

      // Check if we already have a direct conversation with this user
      const existingConv = conversations.allIds.find((convId) => {
        const conv = conversations.byId[convId];
        if (!conv || conv.type === 'GROUP') return false;
        return conv.participants.some((p) => p.id === result.id);
      });

      if (existingConv) {
        // Navigate to the existing conversation
        router.push(`${paths.dashboard.chat}?id=${existingConv}`);
      } else if (onSelectContact) {
        // New conversation: set as recipient via compose header
        router.push(paths.dashboard.chat);
        onSelectContact(result);
      } else {
        // Fallback: navigate with user ID (backend will handle)
        router.push(`${paths.dashboard.chat}?id=${result.id}`);
      }
    },
    [handleClickAwaySearch, router, conversations, onSelectContact]
  );

  const renderLoading = <ChatNavItemSkeleton />;

  const renderList = (
    <nav>
      <Box component="ul">
        {conversations.allIds.map((conversationId) => (
          <ChatNavItem
            key={conversationId}
            collapse={collapseDesktop}
            conversation={conversations.byId[conversationId]}
            selected={conversationId === selectedConversationId}
            onCloseMobile={onCloseMobile}
          />
        ))}
      </Box>
    </nav>
  );

  const renderListResults = (
    <ChatNavSearchResults
      query={searchContacts.query}
      results={searchContacts.results}
      onClickResult={handleClickResult}
    />
  );

  const renderSearchInput = (
    <ClickAwayListener onClickAway={handleClickAwaySearch}>
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
    </ClickAwayListener>
  );

  const renderContent = (
    <>
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

      <Box sx={{ p: 2.5, pt: 0 }}>{!collapseDesktop && renderSearchInput}</Box>

      {loading ? (
        renderLoading
      ) : (
        <Scrollbar sx={{ pb: 1 }}>
          {searchContacts.query ? renderListResults : renderList}
        </Scrollbar>
      )}
    </>
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
