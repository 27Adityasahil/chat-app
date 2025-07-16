import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    this.token = token;
    this.socket = io('http://localhost:3001', {
      auth: { token }
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Message events
  sendPrivateMessage(recipientId: string, content: string) {
    if (this.socket) {
      this.socket.emit('send_private_message', { recipientId, content });
    }
  }

  sendGroupMessage(groupId: string, content: string) {
    if (this.socket) {
      this.socket.emit('send_group_message', { groupId, content });
    }
  }

  onNewMessage(callback: (message: Message) => void) {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }

  // Typing events
  startTyping(chatType: 'private' | 'group', chatId: string) {
    if (this.socket) {
      this.socket.emit('typing_start', { chatType, chatId });
    }
  }

  stopTyping(chatType: 'private' | 'group', chatId: string) {
    if (this.socket) {
      this.socket.emit('typing_stop', { chatType, chatId });
    }
  }

  onTypingUpdate(callback: (data: { users: string[], chatType: string, chatId: string }) => void) {
    if (this.socket) {
      this.socket.on('typing_update', callback);
    }
  }

  // Remove listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export const socketService = new SocketService();