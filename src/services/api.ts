const API_BASE = 'http://localhost:3001/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
      ...options,
    };

    if (options.body && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }

    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  }

  // Auth endpoints
  async register(userData: FormData) {
    return this.request('/register', {
      method: 'POST',
      body: userData,
    });
  }

  async verifyOTP(email: string, otp: string) {
    return this.request('/verify-otp', {
      method: 'POST',
      body: { email, otp },
    });
  }

  async login(email: string, password: string) {
    return this.request('/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async loginWithOTP(email: string, otp: string) {
    return this.request('/login-otp', {
      method: 'POST',
      body: { email, otp },
    });
  }

  // User endpoints
  async getProfile() {
    return this.request('/profile');
  }

  async sendFriendRequest(uniqueId: string) {
    return this.request('/friend-request', {
      method: 'POST',
      body: { uniqueId },
    });
  }

  async getFriendRequests() {
    return this.request('/friend-requests');
  }

  async respondToFriendRequest(requestId: string, action: 'accepted' | 'rejected') {
    return this.request(`/friend-request/${requestId}/${action}`, {
      method: 'POST',
    });
  }

  // Group endpoints
  async createGroup(groupData: FormData) {
    return this.request('/create-group', {
      method: 'POST',
      body: groupData,
    });
  }

  async joinGroup(uniqueCode: string) {
    return this.request('/join-group', {
      method: 'POST',
      body: { uniqueCode },
    });
  }

  async getGroupRequests(groupId: string) {
    return this.request(`/group/${groupId}/requests`);
  }

  async respondToGroupRequest(groupId: string, requestId: string, action: 'accepted' | 'rejected') {
    return this.request(`/group/${groupId}/request/${requestId}/${action}`, {
      method: 'POST',
    });
  }

  // Chat endpoints
  async getChats() {
    return this.request('/chats');
  }

  async getMessages(chatType: 'private' | 'group', chatId: string, page = 1) {
    return this.request(`/messages/${chatType}/${chatId}?page=${page}`);
  }
}

export const apiService = new ApiService();