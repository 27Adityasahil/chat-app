export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  uniqueId: string;
  photo: string;
  isOnline: boolean;
  lastSeen: string;
  friends: User[];
  groups: Group[];
}

export interface Group {
  id: string;
  name: string;
  description: string;
  uniqueCode: string;
  admin: string;
  members: User[];
  photo: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  sender: User;
  content: string;
  type: 'text' | 'image' | 'file';
  chat: {
    type: 'private' | 'group';
    id: string;
  };
  createdAt: string;
  readBy: Array<{
    user: string;
    readAt: string;
  }>;
}

export interface PrivateChat {
  id: string;
  participants: User[];
  lastMessage?: Message;
  lastActivity: string;
}

export interface FriendRequest {
  id: string;
  from: User;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface GroupJoinRequest {
  id: string;
  user: User;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}