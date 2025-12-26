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

// 1. SETUP CORS (Allow requests from anywhere for now)
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// 2. CONNECT TO MONGODB
// (This is your working connection string)
const MONGO_URI = "mongodb+srv://indhu:indhu006@cluster0.rxztmvk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ CONNECTED TO MONGODB"))
  .catch((err) => console.log("❌ MONGO CONNECTION ERROR:", err));


// --- AUTHENTICATION ROUTES ---

// Register Route
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save User
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find User
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Create Token
    const token = jwt.sign({ id: user._id }, "SECRET_KEY", { expiresIn: "1h" });

    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SOCKET IO LOGIC ---

// 3. ALLOW SOCKET CONNECTIONS FROM ANYWHERE (Crucial for Deployment)
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", async (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
    
    // Load History
    try {
      const history = await Message.find({ room: room }).sort({ timestamp: 1 });
      socket.emit("load_history", history);
    } catch (err) {
      console.log("Error loading history:", err);
    }
  });

  socket.on("send_message", async (data) => {
    // Save to DB
    const newMessage = new Message(data);
    await newMessage.save();
    
    // Send to everyone in room (including sender)
    io.in(data.room).emit("receive_message", data);
  });

  socket.on("typing", (data) => {
    socket.to(data.room).emit("display_typing", data);
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
  });
});

// 4. USE THE PORT RENDER ASSIGNS (OR 3001)
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});