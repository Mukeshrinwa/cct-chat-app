import type { IChatMessage, IChatParticipant } from 'src/types/chat';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import CircularProgress from '@mui/material/CircularProgress';

import { fToNow } from 'src/utils/format-time';

import { SearchNotFound } from 'src/components/search-not-found';

// ----------------------------------------------------------------------

type Props = {
  query: string;
  users: IChatParticipant[];
  messages: IChatMessage[];
  loading: boolean;
  onClickUser: (contact: IChatParticipant) => void;
  onClickMessage: (message: IChatMessage) => void;
};

const getConversationLabel = (conv: any) => {
  if (!conv) return '';
  if (conv.type === 'GROUP' || conv.type === 'group') {
    return `in Group Chat`;
  }
  return 'in Direct Chat';
};

export function ChatNavSearchResults({
  query,
  users,
  messages,
  loading,
  onClickUser,
  onClickMessage,
}: Props) {
  const hasUsers = users.length > 0;
  const hasMessages = messages.length > 0;
  const hasResults = hasUsers || hasMessages;

  const notFound = !hasResults && !!query && !loading;

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress size={24} color="inherit" />
      </Stack>
    );
  }

  const renderNotFound = (
    <SearchNotFound
      query={query}
      sx={{
        p: 3,
        mx: 'auto',
        width: `calc(100% - 40px)`,
        bgcolor: 'background.neutral',
      }}
    />
  );

  const renderUsers = hasUsers && (
    <Stack spacing={1} sx={{ mb: 4 }}>
      <Typography variant="subtitle2" sx={{ px: 2.5, color: 'text.secondary', fontWeight: 600 }}>
        Users ({users.length})
      </Typography>

      <Box component="ul">
        {users.map((result) => (
          <Box key={result.id} component="li" sx={{ display: 'flex' }}>
            <ListItemButton
              onClick={() => onClickUser(result)}
              sx={{ gap: 2, py: 1.2, px: 2.5 }}
            >
              <Avatar alt={result.name} src={result.avatarUrl} sx={{ width: 36, height: 36 }} />

              <Stack sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {result.name}
                </Typography>
                <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                  @{result.username || result.name}
                </Typography>
              </Stack>

              {result.status === 'online' && (
                <Box
                  sx={{
                    ml: 'auto',
                    width: 8,
                    height: 8,
                    flexShrink: 0,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                  }}
                />
              )}
            </ListItemButton>
          </Box>
        ))}
      </Box>
    </Stack>
  );

  const renderMessages = hasMessages && (
    <Stack spacing={1}>
      <Typography variant="subtitle2" sx={{ px: 2.5, color: 'text.secondary', fontWeight: 600 }}>
        Messages ({messages.length})
      </Typography>

      <Box component="ul">
        {messages.map((message) => {
          const msgAny = message as any;
          const sender = msgAny.senderDetails || (typeof msgAny.senderId === 'object' ? msgAny.senderId : null);
          const senderName = sender?.name || sender?.displayName || 'User';
          const senderAvatar = sender?.avatar || sender?.avatarUrl || sender?.photoURL || '';
          
          const conversation = msgAny.conversationId;
          const convLabel = getConversationLabel(msgAny.conversationDetails || conversation);

          return (
            <Box key={message.id} component="li" sx={{ display: 'flex' }}>
              <ListItemButton
                onClick={() => onClickMessage(message)}
                sx={{ gap: 2, py: 1.5, px: 2.5 }}
              >
                <Avatar alt={senderName} src={senderAvatar} sx={{ width: 36, height: 36 }} />

                <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle2" noWrap>
                      {senderName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
                      {fToNow(message.createdAt)}
                    </Typography>
                  </Stack>

                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: '11px', mt: 0.25 }} noWrap>
                    {convLabel}
                  </Typography>

                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }} noWrap>
                    {message.body}
                  </Typography>
                </Stack>
              </ListItemButton>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );

  return (
    <>
      {notFound && renderNotFound}
      {renderUsers}
      {renderMessages}
    </>
  );
}
