import React, { useState, useRef, useEffect } from 'react';
import { Send, X, User, Users } from 'lucide-react';
import { socketService } from '../../services/socket';
import { Message, User as UserType } from '../../types';

interface ChatWindowProps {
  chat: { type: 'private' | 'group'; id: string; name: string };
  messages: Message[];
  currentUser: UserType;
  onSendMessage: (content: string) => void;
  onClose: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  chat,
  messages,
  currentUser,
  onSendMessage,
  onClose
}) => {
  const [message, setMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Listen for typing updates
    socketService.onTypingUpdate((data) => {
      if (data.chatType === chat.type && data.chatId === chat.id) {
        setTypingUsers(data.users.filter(user => user !== currentUser.name));
      }
    });

    return () => {
      socketService.removeAllListeners();
    };
  }, [chat, currentUser.name]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      handleTypingStop();
    }
  };

  const handleTypingStart = () => {
    socketService.startTyping(chat.type, chat.id);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 3000);
  };

  const handleTypingStop = () => {
    socketService.stopTyping(chat.type, chat.id);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageColor = (messageUsername: string) => {
    if (messageUsername === currentUser.name) return 'text-blue-600';
    
    const colors = [
      'text-purple-600', 'text-green-600', 'text-orange-600', 
      'text-pink-600', 'text-indigo-600', 'text-teal-600'
    ];
    
    let hash = 0;
    for (let i = 0; i < messageUsername.length; i++) {
      hash = messageUsername.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              {chat.type === 'private' ? (
                <User className="w-5 h-5 text-blue-600" />
              ) : (
                <Users className="w-5 h-5 text-green-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{chat.name}</h2>
              <p className="text-sm text-gray-500">
                {chat.type === 'private' ? 'Direct Message' : 'Group Chat'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender.id === currentUser.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.sender.id === currentUser.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white shadow-sm border border-gray-200'
              }`}
            >
              {chat.type === 'group' && msg.sender.id !== currentUser.id && (
                <p className={`text-xs font-medium mb-1 ${getMessageColor(msg.sender.name)}`}>
                  {msg.sender.name}
                </p>
              )}
              <p className="text-sm">{msg.content}</p>
              <p className={`text-xs mt-1 ${
                msg.sender.id === currentUser.id ? 'text-blue-200' : 'text-gray-500'
              }`}>
                {formatTime(msg.createdAt)}
              </p>
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-200 px-4 py-2 rounded-lg">
              <p className="text-sm text-gray-600">
                {typingUsers.length === 1
                  ? `${typingUsers[0]} is typing...`
                  : `${typingUsers.join(', ')} are typing...`}
              </p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (e.target.value.trim()) {
                handleTypingStart();
              } else {
                handleTypingStop();
              }
            }}
            onBlur={handleTypingStop}
            placeholder={`Message ${chat.name}`}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;