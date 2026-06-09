import type { IDateValue } from './common';

// ----------------------------------------------------------------------

export type IChatAttachment = {
  name: string;
  size: number;
  type: string;
  path: string;
  preview: string;
  createdAt: IDateValue;
  modifiedAt: IDateValue;
  url?: string;
};

export type IChatMessage = {
  id: string;
  _id?: string;
  body: string;
  senderId: string;
  contentType: string;
  createdAt: IDateValue;
  attachments: IChatAttachment[];
  isDeleted?: boolean;
  deleteType?: 'everyone' | 'me';
  parentMessageId?: string;
  parentId?: string;
  parentMessage?: {
    _id?: string;
    messageId?: string;
    senderId?: string;
    body?: string;
    contentType?: string;
  } | null;
  reactions?: Array<{ emoji: string; senderId: string; username?: string }>;

  editedAt?: IDateValue;
  status?: 'sent' | 'delivered' | 'read';
};

export type IChatParticipant = {
  id: string;
  name: string;
  username?: string;
  role: string;
  email: string;
  address: string;
  avatarUrl: string;
  phoneNumber: string;
  lastActivity: IDateValue;
  status: 'online' | 'offline' | 'alway' | 'busy';
};

export type IChatConversation = {
  id: string;
  type: string;
  unreadCount: number;
  messages: IChatMessage[];
  participants: IChatParticipant[];
  isMuted?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
};

export type IChatConversations = {
  byId: Record<string, IChatConversation>;
  allIds: string[];
};
