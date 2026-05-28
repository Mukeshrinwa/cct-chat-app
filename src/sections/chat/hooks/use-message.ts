import type { IChatMessage, IChatParticipant } from 'src/types/chat';

// ----------------------------------------------------------------------

type Props = {
  currentUserId: string;
  message: IChatMessage;
  participants: IChatParticipant[];
};

export function useMessage({ message, participants, currentUserId }: Props) {
  const sender = participants.find((participant) => participant.id === message.senderId);

  const senderDetails =
    message.senderId === currentUserId
      ? { type: 'me' }
      : { avatarUrl: sender?.avatarUrl, firstName: sender?.name.split(' ')[0] };

  const me = senderDetails.type === 'me';

  const hasImage =
    message.contentType === 'image' ||
    (typeof message.body === 'string' &&
      (message.body.startsWith('data:image/') ||
        /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(message.body)));

  return { hasImage, me, senderDetails };
}
