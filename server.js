const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  photo: { type: String, default: '' },
  uniqueId: { type: String, unique: true, required: true },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiry: { type: Date },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false }
}, { timestamps: true });

// Group Schema
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  uniqueCode: { type: String, unique: true, required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  joinRequests: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  photo: { type: String, default: '' },
  isPrivate: { type: Boolean, default: false }
}, { timestamps: true });

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  chat: {
    type: { type: String, enum: ['private', 'group'], required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true }
  },
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Private Chat Schema
const privateChatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Group = mongoose.model('Group', groupSchema);
const Message = mongoose.model('Message', messageSchema);
const PrivateChat = mongoose.model('PrivateChat', privateChatSchema);

// JWT Secret
const JWT_SECRET = 'your-secret-key';

// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'photo') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for photos'));
      }
    } else {
      cb(null, true);
    }
  }
});

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate unique ID
const generateUniqueId = () => {
  return 'USR' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5).toUpperCase();
};

// Generate group code
const generateGroupCode = () => {
  return 'GRP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5).toUpperCase();
};

// Send OTP email
const sendOTP = async (email, otp, name) => {
  const mailOptions = {
    from: 'your-email@gmail.com',
    to: email,
    subject: 'Your OTP for Chat App',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${name}!</h2>
        <p>Your OTP for Chat App verification is:</p>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0;">
          ${otp}
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

// Socket middleware for authentication
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

// Routes

// Register
app.post('/api/register', upload.single('photo'), async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate OTP and unique ID
    const otp = generateOTP();
    const uniqueId = generateUniqueId();
    
    // Create user
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      photo: req.file ? req.file.filename : '',
      uniqueId,
      otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    await user.save();

    // Send OTP
    const emailSent = await sendOTP(email, otp, name);
    
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }

    res.status(201).json({ 
      message: 'User registered successfully. Please verify your email with OTP.',
      userId: user._id,
      uniqueId: user.uniqueId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET);

    res.json({ 
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        uniqueId: user.uniqueId,
        photo: user.photo
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      // Generate new OTP
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      
      await sendOTP(email, otp, user.name);
      
      return res.status(400).json({ 
        message: 'Please verify your email first. New OTP sent.',
        needsVerification: true
      });
    }

    // Generate new OTP for login
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    
    await sendOTP(email, otp, user.name);

    res.json({ 
      message: 'OTP sent to your email for login verification',
      userId: user._id,
      needsOTP: true
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login with OTP
app.post('/api/login-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET);

    res.json({ 
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        uniqueId: user.uniqueId,
        photo: user.photo
      }
    });
  } catch (error) {
    console.error('Login OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password -otp -otpExpiry')
      .populate('friends', 'name uniqueId photo isOnline lastSeen')
      .populate('groups', 'name uniqueCode photo');
    
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request
app.post('/api/friend-request', verifyToken, async (req, res) => {
  try {
    const { uniqueId } = req.body;
    const senderId = req.user.userId;
    
    const targetUser = await User.findOne({ uniqueId });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser._id.toString() === senderId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    // Check if already friends
    if (targetUser.friends.includes(senderId)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    // Check if request already exists
    const existingRequest = targetUser.friendRequests.find(
      req => req.from.toString() === senderId && req.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    targetUser.friendRequests.push({ from: senderId });
    await targetUser.save();

    res.json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friend requests
app.get('/api/friend-requests', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('friendRequests.from', 'name uniqueId photo');
    
    const pendingRequests = user.friendRequests.filter(req => req.status === 'pending');
    
    res.json(pendingRequests);
  } catch (error) {
    console.error('Friend requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept/Reject friend request
app.post('/api/friend-request/:requestId/:action', verifyToken, async (req, res) => {
  try {
    const { requestId, action } = req.params;
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    const request = user.friendRequests.id(requestId);
    
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    request.status = action;
    
    if (action === 'accepted') {
      // Add to friends list
      user.friends.push(request.from);
      
      // Add current user to sender's friends list
      await User.findByIdAndUpdate(request.from, {
        $push: { friends: userId }
      });
    }

    await user.save();
    
    res.json({ message: `Friend request ${action}` });
  } catch (error) {
    console.error('Friend request action error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create group
app.post('/api/create-group', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    const adminId = req.user.userId;
    
    const uniqueCode = generateGroupCode();
    
    const group = new Group({
      name,
      description,
      uniqueCode,
      admin: adminId,
      members: [adminId],
      photo: req.file ? req.file.filename : '',
      isPrivate: isPrivate === 'true'
    });

    await group.save();

    // Add group to user's groups
    await User.findByIdAndUpdate(adminId, {
      $push: { groups: group._id }
    });

    res.status(201).json({ 
      message: 'Group created successfully',
      group: {
        id: group._id,
        name: group.name,
        uniqueCode: group.uniqueCode,
        photo: group.photo
      }
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Join group request
app.post('/api/join-group', verifyToken, async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    const userId = req.user.userId;
    
    const group = await Group.findOne({ uniqueCode });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.members.includes(userId)) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }

    // Check if request already exists
    const existingRequest = group.joinRequests.find(
      req => req.user.toString() === userId && req.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({ message: 'Join request already sent' });
    }

    group.joinRequests.push({ user: userId });
    await group.save();

    res.json({ message: 'Join request sent successfully' });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get group join requests (for admin)
app.get('/api/group/:groupId/requests', verifyToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    
    const group = await Group.findById(groupId)
      .populate('joinRequests.user', 'name uniqueId photo');
    
    if (!group || group.admin.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pendingRequests = group.joinRequests.filter(req => req.status === 'pending');
    
    res.json(pendingRequests);
  } catch (error) {
    console.error('Group requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept/Reject group join request
app.post('/api/group/:groupId/request/:requestId/:action', verifyToken, async (req, res) => {
  try {
    const { groupId, requestId, action } = req.params;
    const userId = req.user.userId;
    
    const group = await Group.findById(groupId);
    
    if (!group || group.admin.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const request = group.joinRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = action;
    
    if (action === 'accepted') {
      group.members.push(request.user);
      
      // Add group to user's groups
      await User.findByIdAndUpdate(request.user, {
        $push: { groups: groupId }
      });
    }

    await group.save();
    
    res.json({ message: `Join request ${action}` });
  } catch (error) {
    console.error('Group request action error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chats
app.get('/api/chats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get private chats
    const privateChats = await PrivateChat.find({ participants: userId })
      .populate('participants', 'name uniqueId photo isOnline lastSeen')
      .populate('lastMessage')
      .sort({ lastActivity: -1 });

    // Get groups
    const groups = await Group.find({ members: userId })
      .populate('members', 'name uniqueId photo isOnline lastSeen')
      .sort({ updatedAt: -1 });

    res.json({ privateChats, groups });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages
app.get('/api/messages/:chatType/:chatId', verifyToken, async (req, res) => {
  try {
    const { chatType, chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await Message.find({
      'chat.type': chatType,
      'chat.id': chatId,
      isDeleted: false
    })
    .populate('sender', 'name uniqueId photo')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Socket.IO connection handling
io.use(socketAuth);

const connectedUsers = new Map();
const typingUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.user.name);
  
  connectedUsers.set(socket.user._id.toString(), socket.id);
  
  // Update user online status
  User.findByIdAndUpdate(socket.user._id, {
    isOnline: true,
    lastSeen: new Date()
  }).exec();

  // Join user to their rooms
  socket.join(`user_${socket.user._id}`);
  
  // Join user to their group rooms
  socket.user.groups.forEach(groupId => {
    socket.join(`group_${groupId}`);
  });

  // Handle private message
  socket.on('send_private_message', async (data) => {
    try {
      const { recipientId, content } = data;
      
      // Find or create private chat
      let privateChat = await PrivateChat.findOne({
        participants: { $all: [socket.user._id, recipientId] }
      });

      if (!privateChat) {
        privateChat = new PrivateChat({
          participants: [socket.user._id, recipientId]
        });
        await privateChat.save();
      }

      // Create message
      const message = new Message({
        sender: socket.user._id,
        content,
        chat: { type: 'private', id: privateChat._id }
      });

      await message.save();
      await message.populate('sender', 'name uniqueId photo');

      // Update private chat
      privateChat.lastMessage = message._id;
      privateChat.lastActivity = new Date();
      await privateChat.save();

      // Send to both users
      io.to(`user_${socket.user._id}`).emit('new_message', message);
      io.to(`user_${recipientId}`).emit('new_message', message);

    } catch (error) {
      console.error('Private message error:', error);
    }
  });

  // Handle group message
  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, content } = data;
      
      // Verify user is member of group
      const group = await Group.findById(groupId);
      if (!group || !group.members.includes(socket.user._id)) {
        return;
      }

      // Create message
      const message = new Message({
        sender: socket.user._id,
        content,
        chat: { type: 'group', id: groupId }
      });

      await message.save();
      await message.populate('sender', 'name uniqueId photo');

      // Send to group
      io.to(`group_${groupId}`).emit('new_message', message);

    } catch (error) {
      console.error('Group message error:', error);
    }
  });

  // Handle typing
  socket.on('typing_start', (data) => {
    const { chatType, chatId } = data;
    const roomKey = `${chatType}_${chatId}`;
    
    if (!typingUsers.has(roomKey)) {
      typingUsers.set(roomKey, new Set());
    }
    
    typingUsers.get(roomKey).add(socket.user.name);
    
    socket.to(`${chatType}_${chatId}`).emit('typing_update', {
      users: Array.from(typingUsers.get(roomKey)),
      chatType,
      chatId
    });
  });

  socket.on('typing_stop', (data) => {
    const { chatType, chatId } = data;
    const roomKey = `${chatType}_${chatId}`;
    
    if (typingUsers.has(roomKey)) {
      typingUsers.get(roomKey).delete(socket.user.name);
      
      if (typingUsers.get(roomKey).size === 0) {
        typingUsers.delete(roomKey);
      }
      
      socket.to(`${chatType}_${chatId}`).emit('typing_update', {
        users: typingUsers.has(roomKey) ? Array.from(typingUsers.get(roomKey)) : [],
        chatType,
        chatId
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.user.name);
    
    connectedUsers.delete(socket.user._id.toString());
    
    // Update user offline status
    User.findByIdAndUpdate(socket.user._id, {
      isOnline: false,
      lastSeen: new Date()
    }).exec();

    // Remove from typing indicators
    typingUsers.forEach((users, roomKey) => {
      if (users.has(socket.user.name)) {
        users.delete(socket.user.name);
        if (users.size === 0) {
          typingUsers.delete(roomKey);
        }
        
        const [chatType, chatId] = roomKey.split('_');
        socket.to(roomKey).emit('typing_update', {
          users: Array.from(users),
          chatType,
          chatId
        });
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});