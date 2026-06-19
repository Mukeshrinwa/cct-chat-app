import type { IChatMessage, IChatParticipant } from 'src/types/chat';

import { mutate } from 'swr';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useGroupSockets } from 'src/hooks/use-group-sockets';

import { fToNow } from 'src/utils/format-time';

import { CONFIG } from 'src/config-global';
import { useGetGroups } from 'src/actions/group';
import { useChatStore } from 'src/store/useChatStore';
import { 
  useGetContacts,
  clickConversation,
  getMessageContext, 
  useGetConversation, 
  createConversation,
  useGetConversations,
  searchConversationMessages
} from 'src/actions/chat';

import { EmptyContent } from 'src/components/empty-content';

import { useMockedUser } from 'src/auth/hooks';

import { Layout } from '../layout';
import { ChatNav } from '../chat-nav';
import { ChatRoom } from '../chat-room';
import { ChatMessageList } from '../chat-message-list';
import { ChatMessageInput } from '../chat-message-input';
import { ChatHeaderDetail } from '../chat-header-detail';
import { ChatHeaderCompose } from '../chat-header-compose';
import { useCollapseNav } from '../hooks/use-collapse-nav';

// ----------------------------------------------------------------------

export function ChatView() {
  const router = useRouter();

  const { user } = useMockedUser();

  const { setActiveConversation } = useChatStore();

  const getGreeting = useCallback(() => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) {
      return 'Good morning!';
    }
    if (hours >= 12 && hours < 17) {
      return 'Good afternoon!';
    }
    if (hours >= 17 && hours < 22) {
      return 'Good evening!';
    }
    return 'Good night!';
  }, []);

  // Group socket events sun-ta hai — group create/delete/call sab handle karta hai
  useGroupSockets(user?.id);

  const { contacts } = useGetContacts();

  const searchParams = useSearchParams();

  const selectedConversationId = searchParams.get('id') || '';

  const [recipients, setRecipients] = useState<IChatParticipant[]>([]);

  const [searchMessageQuery, setSearchMessageQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IChatMessage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!searchMessageQuery.trim() || !selectedConversationId) {
      setSearchResults([]);
      return () => {};
    }

    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchConversationMessages(selectedConversationId, searchMessageQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to search conversation messages:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchMessageQuery, selectedConversationId]);

  const handleSelectSearchedMessage = useCallback(
    async (msgId: string) => {
      setSearchMessageQuery('');
      router.push(`${paths.dashboard.chat}?id=${selectedConversationId}&messageId=${msgId}`);
      try {
        const contextMessages = await getMessageContext(selectedConversationId, msgId);
        if (contextMessages && contextMessages.length > 0) {
          mutate(
            `/api/v1/chats/conversations/${selectedConversationId}`,
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
    [selectedConversationId, router]
  );



  const { conversations, conversationsLoading } = useGetConversations();

  const { conversation, conversationError, conversationLoading } = useGetConversation(
    `${selectedConversationId}`
  );

  const roomNav = useCollapseNav();

  const conversationsNav = useCollapseNav();

  const participants: IChatParticipant[] = conversation
    ? conversation.participants.filter(
      (participant: IChatParticipant) => participant.id !== `${user?.id}`
    )
    : [];

  const { groups, groupsLoading } = useGetGroups();

  const isUserMember = useMemo(() => {
    if (!conversation) return true;
    
    const inParticipants = conversation.participants.some(
      (participant: any) => (participant.id || participant._id) === `${user?.id}`
    );

    const convType = conversation.type?.toLowerCase() || '';
    const isGroupConv = 
      convType === 'group' || 
      conversation.participants.length > 2 ||
      groups.some((g: any) => 
        g.conversationId?._id === selectedConversationId || 
        g.conversationId === selectedConversationId ||
        g._id === selectedConversationId ||
        g.id === selectedConversationId
      );

    if (isGroupConv) {
      if (groupsLoading && inParticipants) {
        return true; // Prevent flicker while loading
      }
      
      const currentGroup = groups.find((g: any) => 
        g.conversationId?._id === selectedConversationId || 
        g.conversationId === selectedConversationId ||
        g._id === selectedConversationId ||
        g.id === selectedConversationId
      );
      
      if (!currentGroup && !groupsLoading) {
        return false;
      }

      if (currentGroup) {
        const isAdmin = (currentGroup.admins || []).some((a: any) => (a.id || a._id || a) === user?.id);
        const isMember = (currentGroup.members || []).some((m: any) => (m.id || m._id || m) === user?.id);
        
        if (!isAdmin && !isMember) {
          return false;
        }
      }
    }

    return inParticipants;
  }, [conversation, user?.id, groups, groupsLoading, selectedConversationId]);

  useEffect(() => {
    setActiveConversation(selectedConversationId || null);
    setSearchMessageQuery('');
    if (selectedConversationId) {
      clickConversation(selectedConversationId);
    }
  }, [selectedConversationId, setActiveConversation]);

  useEffect(() => {
    if (conversationError || !selectedConversationId) {
      router.push(paths.dashboard.chat);
    }
  }, [conversationError, router, selectedConversationId]);

  useEffect(() => {
    if (conversation && conversation.id && conversation.id !== selectedConversationId) {
      router.replace(`${paths.dashboard.chat}?id=${conversation.id}`);
    }
  }, [conversation, selectedConversationId, router]);

  const handleAddRecipients = useCallback(async (selected: IChatParticipant[]) => {
    if (selected.length === 1) {
      const targetUser = selected[0];
      const existingId = conversations.allIds.find((cId: string) => {
        const c = conversations.byId[cId];
        if (!c || c.type === 'GROUP' || c.participants.length > 2) return false;
        return c.participants.some((p: any) => (p.id || p._id) === targetUser.id);
      });

      if (existingId) {
        router.push(`${paths.dashboard.chat}?id=${existingId}`);
        return;
      }

      try {
        const res = await createConversation({
          participants: [targetUser],
          type: 'direct'
        });
        if (res?.conversation?.id) {
          router.push(`${paths.dashboard.chat}?id=${res.conversation.id}`);
          setRecipients([]);
          return;
        }
      } catch (err) {
        console.error('Failed to create empty conversation:', err);
      }
    }
    setRecipients(selected);
  }, [conversations, router]);

  // Called when user clicks a contact from sidebar search (new conversation)
  const handleSelectContact = useCallback((contact: IChatParticipant) => {
    setRecipients([contact]);
  }, []);

  const filteredMessages = useMemo(() => {
    const msgs = conversation?.messages ?? [];
    if (!searchMessageQuery.trim()) return msgs;
    const query = searchMessageQuery.toLowerCase();
    return msgs.filter((m) => m.body && m.body.toLowerCase().includes(query));
  }, [conversation?.messages, searchMessageQuery]);

  const renderSearchConversationResults = (
    <Stack sx={{ flex: '1 1 auto', bgcolor: 'background.paper', p: 3, overflowY: 'auto' }}>
      <Typography variant="subtitle1" sx={{ mb: 2, color: 'text.secondary' }}>
        Search results for &ldquo;{searchMessageQuery}&rdquo; ({searchResults.length})
      </Typography>
      {searchLoading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
          <CircularProgress size={32} color="inherit" />
        </Stack>
      ) : searchResults.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 8 }}>
          No messages found
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {searchResults.map((msg) => {
            const sender: any = participants.find((p) => p.id === msg.senderId) || (msg.senderId === user?.id ? user : null);
            const senderName = msg.senderId === user?.id ? 'You' : (sender?.name || sender?.displayName || 'User');
            const senderAvatar = msg.senderId === user?.id ? (user?.photoURL || (user as any)?.avatarUrl) : (sender?.avatarUrl || sender?.photoURL || '');

            return (
              <ListItemButton
                key={msg.id}
                onClick={() => handleSelectSearchedMessage(msg.id)}
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  bgcolor: 'background.neutral',
                  '&:hover': { bgcolor: 'action.hover' },
                  gap: 2,
                }}
              >
                <Avatar src={senderAvatar} alt={senderName} />
                <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" noWrap>
                      {senderName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {fToNow(msg.createdAt)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {msg.body}
                  </Typography>
                </Stack>
              </ListItemButton>
            );
          })}
        </Stack>
      )}
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', height: { xs: 'calc(100dvh - 64px)', md: 'calc(100dvh - 72px)' }, overflow: 'hidden' }}>
      <Layout
        sx={{
          minHeight: 0,
          flex: '1 1 0',
          position: 'relative',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
        slots={{
          header: selectedConversationId ? (
            <ChatHeaderDetail
              collapseNav={roomNav}
              participants={participants}
              loading={conversationLoading}
              isUserMember={isUserMember}
              searchQuery={searchMessageQuery}
              onSearchQueryChange={setSearchMessageQuery}
            />
          ) : (
            <ChatHeaderCompose
              contacts={contacts}
              onAddRecipients={handleAddRecipients}
              recipients={recipients}
            />
          ),
          nav: (
            <ChatNav
              contacts={contacts}
              conversations={conversations}
              loading={conversationsLoading}
              selectedConversationId={selectedConversationId}
              collapseNav={conversationsNav}
              onSelectContact={handleSelectContact}
            />
          ),
          main: (
            <>
              {selectedConversationId ? (
                searchMessageQuery.trim() ? (
                  renderSearchConversationResults
                ) : (
                  <ChatMessageList
                    messages={filteredMessages}
                    participants={participants}
                    loading={conversationLoading}
                  />
                )
              ) : (
                <EmptyContent
                  imgUrl={`${CONFIG.site.basePath}/assets/icons/empty/ic-chat-active.svg`}
                  title={getGreeting()}
                  description="Write something awesome..."
                />
              )}

              <ChatMessageInput
                key={selectedConversationId || 'compose'}
                recipients={selectedConversationId ? participants : recipients}
                onAddRecipients={handleAddRecipients}
                selectedConversationId={selectedConversationId}
                disabled={!recipients.length && !selectedConversationId}
                isUserMember={isUserMember}
              />
            </>
          ),
          details: selectedConversationId && (
            <ChatRoom
              collapseNav={roomNav}
              participants={participants}
              loading={conversationLoading}
              messages={conversation?.messages ?? []}
              conversationType={conversation?.type}
              isUserMember={isUserMember}
            />
          ),
        }}
      />
    </Box>
  );
}
