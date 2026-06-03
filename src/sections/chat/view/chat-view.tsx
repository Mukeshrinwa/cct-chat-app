import type { IChatParticipant } from 'src/types/chat';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useGroupSockets } from 'src/hooks/use-group-sockets';

import { CONFIG } from 'src/config-global';
import { useChatStore } from 'src/store/useChatStore';
import { useGetContacts, clickConversation, useGetConversation, useGetConversations } from 'src/actions/chat';

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

  const isUserMember = conversation
    ? conversation.participants.some(
      (participant: any) => (participant.id || participant._id) === `${user?.id}`
    )
    : true;

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

  const handleAddRecipients = useCallback((selected: IChatParticipant[]) => {
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

  return (
    <Box sx={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
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
                <ChatMessageList
                  messages={filteredMessages}
                  participants={participants}
                  loading={conversationLoading}
                />
              ) : (
                <EmptyContent
                  imgUrl={`${CONFIG.site.basePath}/assets/icons/empty/ic-chat-active.svg`}
                  title={getGreeting()}
                  description="Write something awesome..."
                />
              )}

              <ChatMessageInput
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
