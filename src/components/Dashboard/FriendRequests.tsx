import React, { useState, useEffect } from 'react';
import { X, User, Check, X as XIcon } from 'lucide-react';
import { apiService } from '../../services/api';
import { FriendRequest } from '../../types';

interface FriendRequestsProps {
  onClose: () => void;
}

const FriendRequests: React.FC<FriendRequestsProps> = ({ onClose }) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await apiService.getFriendRequests();
      setRequests(response);
    } catch (error) {
      console.error('Failed to load friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: 'accepted' | 'rejected') => {
    setActionLoading(requestId);
    try {
      await apiService.respondToFriendRequest(requestId, action);
      setRequests(requests.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Failed to respond to friend request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Friend Requests</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-96">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No friend requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    {request.from.photo ? (
                      <img 
                        src={`http://localhost:3001/uploads/${request.from.photo}`} 
                        alt="" 
                        className="w-full h-full rounded-full object-cover" 
                      />
                    ) : (
                      <User className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{request.from.name}</p>
                    <p className="text-sm text-gray-500">{request.from.uniqueId}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRequest(request.id, 'accepted')}
                      disabled={actionLoading === request.id}
                      className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRequest(request.id, 'rejected')}
                      disabled={actionLoading === request.id}
                      className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendRequests;