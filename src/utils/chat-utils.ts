import { CONFIG } from 'src/config-global';

// ----------------------------------------------------------------------

export const getMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const baseUrl = CONFIG.site.assetURL || CONFIG.site.serverUrl || '';
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${cleanUrl}`;
};

interface PopulatedUser {
  _id?: string;
  id?: string;
  name?: string;
}

// ----------------------------------------------------------------------

/**
 * Normalizes a message object to ensure consistent field names and ID formats.
 * Reference project se port kiya gaya hai (chatUtils.ts)
 */
export const normalizeMessage = (message: Record<string, any>) => {
  if (!message) return null;

  const senderId = (() => {
    if (typeof message.senderId === 'object' && message.senderId !== null) {
      return (message.senderId as PopulatedUser)._id || (message.senderId as PopulatedUser).id;
    }
    if (message.senderId) {
      return message.senderId;
    }
    if (message.senderDetails) {
      return message.senderDetails._id || message.senderDetails.id;
    }
    return undefined;
  })();

  const rawAttachments = message.attachments || [];
  const normalizedAttachments = rawAttachments.map((att: any) => {
    const rawUrl = att.url || att.path || att.preview || '';
    const formattedUrl = getMediaUrl(rawUrl);
    return {
      name: att.fileName || att.name || 'Attachment',
      size: att.size || 0,
      type: att.mimeType || att.type || '',
      path: formattedUrl,
      preview: formattedUrl,
      createdAt: att.createdAt || message.createdAt || new Date().toISOString(),
      modifiedAt: att.modifiedAt || message.createdAt || new Date().toISOString(),
    };
  });

  return {
    ...message,
    _id: message._id,
    senderId: senderId ? String(senderId) : '',
    recipientId: message.recipientId ? String(message.recipientId) : undefined,
    conversationId: message.conversationId ? String(message.conversationId) : undefined,
    text: message.text || message.message || message.content || '',
    createdAt: message.createdAt || new Date().toISOString(),
    messageId: String(message.messageId || message._id || window.crypto.randomUUID()),
    messageType: message.messageType || message.type || message.fileType || 'text',
    status: message.status || message.deliveryStatus || 'sent',
    reactions: message.reactions || [],
    attachments: normalizedAttachments,
    isForwarded: !!message.isForwarded,
    forwardedFrom: message.forwardedFrom || '',
    parentMessageId: message.parentMessageId || null,
    parentMessage: message.parentMessage || null,
    isEdited: !!message.isEdited,
    version: message.version || 1,
    editedAt: message.editedAt || null,
    editHistory: message.editHistory || [],
    isDeletedForEveryone: !!message.isDeletedForEveryone,
  };
};

// ----------------------------------------------------------------------

/**
 * Checks if a message was sent by the current user.
 */
export const isOwnMessage = (
  message: Record<string, any>,
  currentUserId: string | undefined
): boolean => {
  if (!message || !currentUserId) return false;

  const senderId = (() => {
    if (typeof message.senderId === 'object' && message.senderId !== null) {
      return (message.senderId as PopulatedUser)._id || (message.senderId as PopulatedUser).id;
    }
    if (message.senderId) {
      return message.senderId;
    }
    if (message.senderDetails) {
      return message.senderDetails._id || message.senderDetails.id;
    }
    return undefined;
  })();

  return String(senderId) === String(currentUserId);
};

// ----------------------------------------------------------------------

/**
 * Returns the alignment ("left" or "right") for a message based on the sender.
 */
export const getMessageAlignment = (
  message: Record<string, any>,
  currentUserId: string | undefined
): 'left' | 'right' => (isOwnMessage(message, currentUserId) ? 'right' : 'left');

// ----------------------------------------------------------------------

/**
 * Determines the message type based on payload or MIME type.
 */
export const getMessageType = (msg: Record<string, any>): string => {
  if (msg.messageType === 'gif' || msg.type === 'gif') return 'gif';

  const previewUrl = msg.attachmentPreview || '';
  if (previewUrl && (previewUrl.includes('giphy.com') || previewUrl.toLowerCase().endsWith('.gif')))
    return 'gif';

  const attachment = msg.attachments?.[0];
  if (attachment) {
    const url = attachment.url || '';
    if (url && (url.includes('giphy.com') || url.toLowerCase().endsWith('.gif'))) return 'gif';
  }

  if (msg.messageType && msg.messageType !== 'text') return msg.messageType;
  if (msg.type && msg.type !== 'text') return msg.type;

  if (!attachment) {
    const emojiOnlyRegex =
      /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|\s)+$/;
    const text = msg.text || msg.message || '';
    if (text && emojiOnlyRegex.test(text) && text.length <= 10) return 'emoji';
    return 'text';
  }

  const mime = attachment.mimeType || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';

  const fileName = attachment.fileName || '';
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['gif'].includes(ext || '')) return 'gif';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext || '')) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac'].includes(ext || '')) return 'audio';

  return 'document';
};

// ----------------------------------------------------------------------

/**
 * Returns the appropriate icon category for a document based on its extension.
 */
export const getDocumentCategory = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (['pdf'].includes(ext || '')) return 'pdf';
  if (['doc', 'docx'].includes(ext || '')) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return 'excel';
  if (['ppt', 'pptx'].includes(ext || '')) return 'powerpoint';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return 'archive';
  if (['js', 'ts', 'html', 'css', 'json', 'py', 'go'].includes(ext || '')) return 'code';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext || '')) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac'].includes(ext || '')) return 'audio';

  return 'file';
};
