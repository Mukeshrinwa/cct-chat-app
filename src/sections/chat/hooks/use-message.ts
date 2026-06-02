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

  const firstAttachmentUrl = message.attachments?.[0]?.preview || message.attachments?.[0]?.path || '';
  const firstAttachmentType = message.attachments?.[0]?.type || '';

  const hasImage =
    message.contentType === 'image' ||
    firstAttachmentType.startsWith('image/') ||
    (typeof firstAttachmentUrl === 'string' &&
      (/\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(firstAttachmentUrl) || firstAttachmentUrl.includes('giphy.com'))) ||
    (typeof message.body === 'string' &&
      (message.body.startsWith('data:image/') ||
        /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(message.body) || message.body.includes('giphy.com')));

  return { hasImage, me, senderDetails };
}
