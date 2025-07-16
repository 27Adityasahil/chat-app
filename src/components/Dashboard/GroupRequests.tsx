import React, { useState, useEffect } from 'react';
import { X, Users, Check, X as XIcon } from 'lucide-react';
import { apiService } from '../../services/api';
import { GroupJoinRequest, Group } from '../../types';

interface GroupRequestsProps {
  onClose: () => void;
}

const GroupRequests: React.FC<GroupRequestsProps> = ({ onClose }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await apiService.getChats();
      // Filter groups where current user is admin
      const adminGroups = response.groups.filter((group: Group) => 
        group.admin === response.groups[0]?.admin // This needs to be fixed to check current user
      );
      setGroups(adminGroups);
      if (adminGroups.length > 0) {
        setSelectedGroup(adminGroups[0].id);
        loadRequests(adminGroups[0].id);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async (groupId: string) => {
    setRequestsLoading(true);
    try {
      const response = await apiService.getGroupRequests(groupId);
      setRequests(response);
    } catch (error) {
      console.error('Failed to load group requests:', error);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: 'accepted' | 'rejected') => {
    if (!selectedGroup) return;
    
    setActionLoading(requestId);
    try {
      await apiService.respondToGroupRequest(selectedGroup, requestId, action);
      setRequests(requests.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Failed to respond to group request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGroupChange = (groupId: string) => {
    setSelectedGroup(groupId);
    loadRequests(groupId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Group Requests</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading groups...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">You don't admin any groups</p>
            </div>
          ) : (
            <>
              {/* Group Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Group
                </label>
                <select
                  value={selectedGroup || ''}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Requests */}
              <div className="overflow-y-auto max-h-96">
                {requestsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2 text-sm">Loading requests...</p>
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p className="text-gray-500 text-sm">No join requests</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div key={request.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          {request.user.photo ? (
                            <img 
                              src={`http://localhost:3001/uploads/${request.user.photo}`} 
                              alt="" 
                              className="w-full h-full rounded-full object-cover" 
                            />
                          ) : (
                            <Users className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{request.user.name}</p>
                          <p className="text-xs text-gray-500">{request.user.uniqueId}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRequest(request.id, 'accepted')}
                            disabled={actionLoading === request.id}
                            className="p-1.5 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRequest(request.id, 'rejected')}
                            disabled={actionLoading === request.id}
                            className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupRequests;