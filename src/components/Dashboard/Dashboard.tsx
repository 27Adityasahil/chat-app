import React, { useState, useEffect } from 'react';
import { User, MessageCircle, Users, Settings, LogOut, Copy, Check, Plus, UserPlus } from 'lucide-react';
import { apiService } from '../../services/api';
import { socketService } from '../../services/socket';
import ChatWindow from './ChatWindow';
import FriendRequests from './FriendRequests';
import GroupRequests from './GroupRequests';
import CreateGroup from './CreateGroup';
import { User as UserType, PrivateChat, Group, Message } from '../../types';

interface DashboardProps {
  user: UserType;
  token: string;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, token, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'groups' | 'settings'>('chats');
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeChat, setActiveChat] = useState<{ type: 'private' | 'group'; id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friendId, setFriendId] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [showGroupRequests, setShowGroupRequests] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Connect to socket
    const socket = socketService.connect(token);
    
    // Load initial data
    loadChats();

    // Listen for new messages
    socketService.onNewMessage((message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socketService.disconnect();
    };
  }, [token]);

  const loadChats = async () => {
    try {
      const response = await apiService.getChats();
      setChats(response.privateChats);
      setGroups(response.groups);
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const copyUniqueId = () => {
    navigator.clipboard.writeText(user.uniqueId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendId.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiService.sendFriendRequest(friendId.trim());
      setSuccess('Friend request sent successfully!');
      setFriendId('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupCode.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiService.joinGroup(groupCode.trim());
      setSuccess('Group join request sent successfully!');
      setGroupCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openChat = async (type: 'private' | 'group', id: string, name: string) => {
    setActiveChat({ type, id, name });
    
    try {
      const messages = await apiService.getMessages(type, id);
      setMessages(messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const renderChatsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Recent Chats</h2>
      </div>

      {/* Private Chats */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Direct Messages</h3>
        <div className="space-y-2">
          {chats.map((chat) => {
            const otherUser = chat.participants.find(p => p.id !== user.id);
            return (
              <button
                key={chat.id}
                onClick={() => openChat('private', chat.id, otherUser?.name || 'Unknown')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    {otherUser?.photo ? (
                      <img src={`http://localhost:3001/uploads/${otherUser.photo}`} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  {otherUser?.isOnline && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{otherUser?.name}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {chat.lastMessage ? 'Last message...' : 'Start a conversation'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Groups */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Groups</h3>
        <div className="space-y-2">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => openChat('group', group.id, group.name)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                {group.photo ? (
                  <img src={`http://localhost:3001/uploads/${group.photo}`} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <Users className="w-6 h-6 text-green-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{group.name}</p>
                <p className="text-sm text-gray-500 truncate">
                  {group.members.length} members
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFriendsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Friends</h2>
        <button
          onClick={() => setShowFriendRequests(true)}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          View Requests
        </button>
      </div>

      {/* Add Friend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">Add Friend</h3>
        <form onSubmit={handleSendFriendRequest} className="flex gap-3">
          <input
            type="text"
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            placeholder="Enter friend's unique ID"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Friends List */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Your Friends</h3>
        <div className="space-y-2">
          {user.friends?.map((friend) => (
            <div key={friend.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200">
              <div className="relative">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  {friend.photo ? (
                    <img src={`http://localhost:3001/uploads/${friend.photo}`} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                {friend.isOnline && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{friend.name}</p>
                <p className="text-sm text-gray-500">{friend.uniqueId}</p>
              </div>
              <button
                onClick={() => {
                  // Find or create private chat with this friend
                  const existingChat = chats.find(chat => 
                    chat.participants.some(p => p.id === friend.id)
                  );
                  if (existingChat) {
                    openChat('private', existingChat.id, friend.name);
                    setActiveTab('chats');
                  }
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGroupsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Groups</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGroupRequests(true)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View Requests
          </button>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Create Group
          </button>
        </div>
      </div>

      {/* Join Group */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">Join Group</h3>
        <form onSubmit={handleJoinGroup} className="flex gap-3">
          <input
            type="text"
            value={groupCode}
            onChange={(e) => setGroupCode(e.target.value)}
            placeholder="Enter group code"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Groups List */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Your Groups</h3>
        <div className="space-y-2">
          {groups.map((group) => (
            <div key={group.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                {group.photo ? (
                  <img src={`http://localhost:3001/uploads/${group.photo}`} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <Users className="w-5 h-5 text-green-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{group.name}</p>
                <p className="text-sm text-gray-500">{group.uniqueCode} • {group.members.length} members</p>
              </div>
              <button
                onClick={() => {
                  openChat('group', group.id, group.name);
                  setActiveTab('chats');
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
      
      {/* Profile Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-medium text-gray-900 mb-4">Profile Information</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            {user.photo ? (
              <img src={`http://localhost:3001/uploads/${user.photo}`} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Unique ID</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
                {user.uniqueId}
              </code>
              <button
                onClick={copyUniqueId}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {copiedId ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Share this ID with friends to connect</p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              {user.photo ? (
                <img src={`http://localhost:3001/uploads/${user.photo}`} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.uniqueId}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="p-4 border-b border-gray-200">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('chats')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activeTab === 'chats' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              Chats
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activeTab === 'friends' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <User className="w-4 h-4" />
              Friends
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activeTab === 'groups' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" />
              Groups
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activeTab === 'settings' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          )}

          {activeTab === 'chats' && renderChatsTab()}
          {activeTab === 'friends' && renderFriendsTab()}
          {activeTab === 'groups' && renderGroupsTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <ChatWindow
            chat={activeChat}
            messages={messages}
            currentUser={user}
            onSendMessage={(content) => {
              if (activeChat.type === 'private') {
                // Find recipient ID from chat
                const chat = chats.find(c => c.id === activeChat.id);
                const recipient = chat?.participants.find(p => p.id !== user.id);
                if (recipient) {
                  socketService.sendPrivateMessage(recipient.id, content);
                }
              } else {
                socketService.sendGroupMessage(activeChat.id, content);
              }
            }}
            onClose={() => setActiveChat(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No chat selected</h3>
              <p className="text-gray-500">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showFriendRequests && (
        <FriendRequests onClose={() => setShowFriendRequests(false)} />
      )}
      
      {showGroupRequests && (
        <GroupRequests onClose={() => setShowGroupRequests(false)} />
      )}
      
      {showCreateGroup && (
        <CreateGroup 
          onClose={() => setShowCreateGroup(false)}
          onSuccess={() => {
            setShowCreateGroup(false);
            loadChats();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;