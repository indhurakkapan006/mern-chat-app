if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: __dirname + "/.env" });
}
const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Models
const Message = require("./models/Message");
const User = require("./models/User");

app.use(cors());
app.use(express.json());

// Test endpoint
app.get("/", (req, res) => {
  res.json({ message: "Server is running!" });
});

const server = http.createServer(app);

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/chat-app";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ CONNECTED TO MONGODB"))
  .catch((err) => {
    console.log("❌ MONGO CONNECTION ERROR:", err);
    process.exit(1);
  });

// --- AUTHENTICATION ROUTES ---

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "supersecretkey123456789", { expiresIn: "1h" });

    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- SOCKET IO LOGIC ---

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  },
});

// Track active 1-1 chat sessions (key: chatId, value: array of socket IDs)
const activeDirectChats = new Map();
// Track total active 1-1 chat participants
let totalDirectChatParticipants = 0;

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", async (room) => {
    socket.join(room);
    
    try {
      const history = await Message.find({ room: room }).sort({ timestamp: 1 });
      socket.emit("load_history", history);
    } catch (err) {
      console.log("Error loading history:", err);
    }
  });

  socket.on("send_message", async (data) => {
    const newMessage = new Message(data);
    await newMessage.save();
    io.in(data.room).emit("receive_message", data);
  });

  socket.on("typing", (data) => {
    socket.to(data.room).emit("display_typing", data);
  });

  // Handle 1-1 chat initiation
  socket.on("start_direct_chat", (data) => {
    const { from, to } = data;
    const chatId = [from, to].sort().join('_'); // Create consistent chat ID

    console.log(`Direct chat attempt: ${from} -> ${to}, chatId: ${chatId}`);
    console.log(`Total active participants: ${totalDirectChatParticipants}`);

    // Check if we've reached the global limit of 2 users
    if (totalDirectChatParticipants >= 2) {
      console.log(`Global limit reached (${totalDirectChatParticipants}/2), blocking user`);
      socket.emit("direct_chat_error", { message: "1-1 chat is currently full (2 users maximum). Please wait for someone to finish their chat." });
      return;
    }

    // Check if chat already exists between these users
    if (activeDirectChats.has(chatId)) {
      const participants = activeDirectChats.get(chatId);
      console.log(`Existing chat found with ${participants.length} participants`);

      if (participants.length >= 2) {
        // This specific chat is full (shouldn't happen with global limit, but safety check)
        socket.emit("direct_chat_error", { message: "This private chat is already full (2 users maximum)" });
        return;
      }
      // Add user to existing chat
      participants.push(socket.id);
      totalDirectChatParticipants++;
      socket.join(chatId);
      console.log(`User added to existing chat ${chatId}, total participants now: ${totalDirectChatParticipants}`);
      socket.emit("direct_chat_started", { chatId, participants: participants.length });
    } else {
      // Create new chat
      activeDirectChats.set(chatId, [socket.id]);
      totalDirectChatParticipants++;
      socket.join(chatId);
      console.log(`New chat created: ${chatId}, total participants now: ${totalDirectChatParticipants}`);
      socket.emit("direct_chat_started", { chatId, participants: 1 });
    }
  });

  // Handle direct messages
  socket.on("direct_message", (data) => {
    const { from, to } = data;
    const chatId = [from, to].sort().join('_');
    
    // Save direct message to database (optional - you might want to create a separate collection)
    // For now, just broadcast to the chat room
    socket.to(chatId).emit("receive_direct_message", data);
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
    
    // Remove user from any active direct chats
    for (const [chatId, participants] of activeDirectChats.entries()) {
      const index = participants.indexOf(socket.id);
      if (index > -1) {
        participants.splice(index, 1);
        totalDirectChatParticipants--;
        console.log(`User removed from chat ${chatId}, total participants now: ${totalDirectChatParticipants}`);
        
        // If no participants left, remove the chat
        if (participants.length === 0) {
          activeDirectChats.delete(chatId);
          console.log(`Chat ${chatId} deleted (no participants left)`);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});