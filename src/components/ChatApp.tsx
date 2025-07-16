import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, Users, MessageCircle, Plus, Hash } from 'lucide-react';

interface Message {
  id: number;
  username: string;
  message: string;
  timestamp: string;
  room: string;
}

interface User {
  username: string;
  room: string;
  id: string;
}

const ChatApp: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState('');
  const [currentRoom, setCurrentRoom] = useState('General');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('receive_message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('room_history', (data: { messages: Message[], room: string }) => {
      setMessages(data.messages);
    });

    newSocket.on('users_update', (users: User[]) => {
      setUsers(users);
    });

    newSocket.on('rooms_update', (rooms: string[]) => {
      setRooms(rooms);
    });

    newSocket.on('typing_update', (data: { users: string[], room: string }) => {
      if (data.room === currentRoom) {
        setTypingUsers(data.users);
      }
    });

    newSocket.on('user_joined', (data: { username: string, room: string }) => {
      if (data.room === currentRoom) {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          username: 'System',
          message: `${data.username} joined the room`,
          timestamp: new Date().toISOString(),
          room: data.room
        }]);
      }
    });

    newSocket.on('user_left', (data: { username: string, room: string }) => {
      if (data.room === currentRoom) {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          username: 'System',
          message: `${data.username} left the room`,
          timestamp: new Date().toISOString(),
          room: data.room
        }]);
      }
    });

    return () => {
      newSocket.close();
    };
  }, [currentRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && socket) {
      socket.emit('join', { username: username.trim(), room: currentRoom });
      setIsJoined(true);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && socket) {
      socket.emit('send_message', { message: message.trim() });
      setMessage('');
      handleTypingStop();
    }
  };

  const handleTypingStart = () => {
    if (socket) {
      socket.emit('typing_start');
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        handleTypingStop();
      }, 3000);
    }
  };

  const handleTypingStop = () => {
    if (socket) {
      socket.emit('typing_stop');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleRoomChange = (room: string) => {
    if (socket && room !== currentRoom) {
      setCurrentRoom(room);
      setMessages([]);
      setTypingUsers([]);
      socket.emit('join', { username, room });
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim() && socket) {
      socket.emit('create_room', newRoomName.trim());
      setNewRoomName('');
      setShowCreateRoom(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageColor = (messageUsername: string) => {
    if (messageUsername === 'System') return 'text-gray-500';
    if (messageUsername === username) return 'text-blue-600';
    
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

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <MessageCircle className="mx-auto h-16 w-16 text-blue-600 mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Chat</h1>
            <p className="text-gray-600">Enter your username to start chatting</p>
          </div>
          
          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter your username"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room
              </label>
              <select
                value={currentRoom}
                onChange={(e) => setCurrentRoom(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="General">General</option>
                <option value="Random">Random</option>
                <option value="Tech Talk">Tech Talk</option>
                <option value="Gaming">Gaming</option>
              </select>
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Join Chat
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Chat App</h1>
          <p className="text-sm text-gray-600">Welcome, {username}!</p>
        </div>
        
        {/* Rooms */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Rooms
              </h2>
              <button
                onClick={() => setShowCreateRoom(!showCreateRoom)}
                className="text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            
            {showCreateRoom && (
              <form onSubmit={handleCreateRoom} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Room name"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}
            
            <div className="space-y-1">
              {rooms.map((room) => (
                <button
                  key={room}
                  onClick={() => handleRoomChange(room)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    currentRoom === room
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Hash className="h-4 w-4" />
                  <span className="font-medium">{room}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Online Users */}
          <div className="p-4 border-t border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Online Users ({users.length})
            </h2>
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 text-sm text-gray-700"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className={user.username === username ? 'font-medium' : ''}>
                    {user.username}
                    {user.username === username && ' (You)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Hash className="h-5 w-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900">{currentRoom}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="h-4 w-4" />
              <span>{users.length} online</span>
            </div>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.username === username ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.username === username
                    ? 'bg-blue-600 text-white'
                    : msg.username === 'System'
                    ? 'bg-gray-100 text-gray-600 text-center italic'
                    : 'bg-white shadow-sm border border-gray-200'
                }`}
              >
                {msg.username !== 'System' && msg.username !== username && (
                  <p className={`text-xs font-medium mb-1 ${getMessageColor(msg.username)}`}>
                    {msg.username}
                  </p>
                )}
                <p className="text-sm">{msg.message}</p>
                <p className={`text-xs mt-1 ${
                  msg.username === username ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2 rounded-lg">
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
              placeholder={`Message #${currentRoom}`}
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
    </div>
  );
};

export default ChatApp;