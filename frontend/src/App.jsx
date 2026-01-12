import io from "socket.io-client";
import { useEffect, useState, useRef } from "react";
import EmojiPicker from "emoji-picker-react";
import axios from "axios";
import "./App.css";

// 1. CONNECT TO YOUR LIVE RENDER SERVER
const socket = io.connect("https://chat-app-backend-k5ki.onrender.com");

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");

  const [room, setRoom] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [typingStatus, setTypingStatus] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [recentlyJoinedRooms, setRecentlyJoinedRooms] = useState([]);
  
  // 1-1 Chat States
  const [showDirectChat, setShowDirectChat] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [directMessages, setDirectMessages] = useState([]);
  const [directMessageInput, setDirectMessageInput] = useState("");
  const [directChatMode, setDirectChatMode] = useState(false);
  
  const [profileData, setProfileData] = useState({
    email: "",
    bio: "",
    phone: ""
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfileData, setEditedProfileData] = useState({
    email: "",
    bio: "",
    phone: ""
  });
  
  const messagesEndRef = useRef(null);

  // --- AUTHENTICATION ---

  const handleRegister = async () => {
    try {
      // 2. UPDATED URL FOR REGISTRATION
      await axios.post("https://chat-app-backend-k5ki.onrender.com/register", { username, password });
      alert("Registration Successful! Now please login.");
      setUsername("");
      setPassword("");
      setIsRegistering(false); 
    } catch (err) {
      alert("Registration Failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleLogin = async () => {
    try {
      // 3. UPDATED URL FOR LOGIN
      const response = await axios.post("https://chat-app-backend-k5ki.onrender.com/login", { username, password });
      setToken(response.data.token);
      setUsername(response.data.username);
      setIsAuthenticated(true);
    } catch (err) {
      alert("Login Failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    setToken("");
    setShowChat(false);
    setRoom("");
    setMessageList([]);
  };

  const leaveRoom = () => {
    socket.emit("leave_room", room);
    setShowChat(false);
    setRoom("");
    setMessageList([]);
  };

  const rejoinRoom = (roomId) => {
    setRoom(roomId);
    socket.emit("join_room", roomId);
    setShowChat(true);
  };

  const saveProfile = () => {
    setProfileData(editedProfileData);
    setIsEditingProfile(false);
    alert("Profile updated successfully!");
  };

  const startEditingProfile = () => {
    setEditedProfileData(profileData);
    setIsEditingProfile(true);
  };

  // --- 1-1 CHAT LOGIC ---

  const startDirectChat = () => {
    if (selectedUser && selectedUser !== username) {
      setDirectChatMode(true);
      setShowDirectChat(true);
      socket.emit("start_direct_chat", {from: username, to: selectedUser});
    } else {
      alert("Please enter a valid username (different from yours)");
    }
  };

  const sendDirectMessage = async () => {
    if (directMessageInput.trim() !== "") {
      const messageData = {
        from: username,
        to: selectedUser,
        message: directMessageInput,
        time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
      };

      await socket.emit("direct_message", messageData);
      setDirectMessages([...directMessages, messageData]);
      setDirectMessageInput("");
      setShowEmoji(false);
    }
  };

  const endDirectChat = () => {
    setShowDirectChat(false);
    setDirectChatMode(false);
    setSelectedUser("");
    setDirectMessages([]);
  };

  // --- CHAT LOGIC ---

  const joinRoom = () => {
    if (username !== "" && room !== "") {
      socket.emit("join_room", room);
      setShowChat(true);
      // Add room to recently joined rooms if not already there
      if (!recentlyJoinedRooms.includes(room)) {
        setRecentlyJoinedRooms([room, ...recentlyJoinedRooms.slice(0, 4)]);
      }
    }
  };

  const sendMessage = async () => {
    if (currentMessage !== "") {
      const messageData = {
        room: room,
        author: username,
        message: currentMessage,
        time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
      };

      await socket.emit("send_message", messageData);
      setCurrentMessage("");
      setShowEmoji(false);
      socket.emit("typing", { room: room, message: "" });
    }
  };

  const onEmojiClick = (emojiObject) => {
    if (directChatMode) {
      setDirectMessageInput((prev) => prev + emojiObject.emoji);
    } else {
      setCurrentMessage((prev) => prev + emojiObject.emoji);
    }
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    socket.emit("typing", { room: room, author: username, message: "typing" });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageList, directMessages]);

  useEffect(() => {
    socket.on("receive_message", (data) => setMessageList((list) => [...list, data]));
    socket.on("display_typing", (data) => setTypingStatus(data.message === "" ? "" : `${data.author} is typing...`));
    socket.on("load_history", (history) => setMessageList(history));
    socket.on("receive_direct_message", (data) => {
      if (data.from === selectedUser) {
        setDirectMessages((list) => [...list, data]);
      }
    });

    return () => {
      socket.off("receive_message");
      socket.off("display_typing");
      socket.off("load_history");
      socket.off("receive_direct_message");
    };
  }, [socket, selectedUser]);

  return (
    <div className="App">
      
      {!isAuthenticated ? (
        <div className="joinChatContainer">
          <h3>{isRegistering ? "Register" : "Login"} to DevChat</h3>
          <input
            type="text"
            placeholder="Username..."
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password..."
            onChange={(e) => setPassword(e.target.value)}
          />
          
          {isRegistering ? (
            <button onClick={handleRegister}>Sign Up</button>
          ) : (
            <button onClick={handleLogin}>Login</button>
          )}

          <p 
            style={{cursor: "pointer", textDecoration: "underline", color: "blue"}}
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? "Already have an account? Login" : "Need an account? Register"}
          </p>
        </div>
      ) : (
        !showChat && !showProfile ? (
          <div className="joinChatContainer">
            <h3>Welcome, {username}!</h3>
            <div style={{display: "flex", gap: "10px", marginBottom: "15px"}}>
              <button onClick={() => setShowProfile(true)} style={{backgroundColor: "#4CAF50"}}>View Profile</button>
              <button onClick={() => setShowDirectChat(true)} style={{backgroundColor: "#9C27B0"}}>1-1 Chat</button>
            </div>
            <input
              type="text"
              placeholder="Room ID..."
              onChange={(e) => setRoom(e.target.value)}
            />
            <button onClick={joinRoom}>Join Room</button>
            
            {recentlyJoinedRooms.length > 0 && (
              <div style={{marginTop: "20px", textAlign: "left", borderTop: "1px solid #ccc", paddingTop: "15px"}}>
                <h4>Recently Joined Rooms:</h4>
                {recentlyJoinedRooms.map((recentRoom, index) => (
                  <div key={index} style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eee"}}>
                    <span>{recentRoom}</span>
                    <button onClick={() => rejoinRoom(recentRoom)} style={{backgroundColor: "#2196F3", padding: "5px 10px", fontSize: "12px"}}>Rejoin</button>
                  </div>
                ))}
              </div>
            )}
            
            <button onClick={handleLogout} style={{marginTop: "10px", backgroundColor: "#ff6b6b"}}>Sign Out</button>
          </div>
        ) : showProfile ? (
          <div className="joinChatContainer">
            <h3>Profile - {username}</h3>
            {!isEditingProfile ? (
              <div style={{textAlign: "left", width: "100%", maxWidth: "400px"}}>
                <div style={{padding: "10px", borderBottom: "1px solid #ccc", marginBottom: "10px"}}>
                  <strong>Username:</strong> {username}
                </div>
                <div style={{padding: "10px", borderBottom: "1px solid #ccc", marginBottom: "10px"}}>
                  <strong>Email:</strong> {profileData.email || "Not set"}
                </div>
                <div style={{padding: "10px", borderBottom: "1px solid #ccc", marginBottom: "10px"}}>
                  <strong>Bio:</strong> {profileData.bio || "Not set"}
                </div>
                <div style={{padding: "10px", borderBottom: "1px solid #ccc", marginBottom: "15px"}}>
                  <strong>Phone:</strong> {profileData.phone || "Not set"}
                </div>
                <button onClick={startEditingProfile} style={{backgroundColor: "#2196F3", marginRight: "10px"}}>Edit Profile</button>
                <button onClick={() => setShowProfile(false)} style={{backgroundColor: "#666"}}>Back</button>
              </div>
            ) : (
              <div style={{textAlign: "left", width: "100%", maxWidth: "400px"}}>
                <div style={{marginBottom: "10px"}}>
                  <label><strong>Email:</strong></label>
                  <input
                    type="email"
                    value={editedProfileData.email}
                    onChange={(e) => setEditedProfileData({...editedProfileData, email: e.target.value})}
                    style={{width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box"}}
                  />
                </div>
                <div style={{marginBottom: "10px"}}>
                  <label><strong>Bio:</strong></label>
                  <textarea
                    value={editedProfileData.bio}
                    onChange={(e) => setEditedProfileData({...editedProfileData, bio: e.target.value})}
                    style={{width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box", minHeight: "80px"}}
                  />
                </div>
                <div style={{marginBottom: "15px"}}>
                  <label><strong>Phone:</strong></label>
                  <input
                    type="tel"
                    value={editedProfileData.phone}
                    onChange={(e) => setEditedProfileData({...editedProfileData, phone: e.target.value})}
                    style={{width: "100%", padding: "8px", marginTop: "5px", boxSizing: "border-box"}}
                  />
                </div>
                <button onClick={saveProfile} style={{backgroundColor: "#4CAF50", marginRight: "10px"}}>Save Changes</button>
                <button onClick={() => setIsEditingProfile(false)} style={{backgroundColor: "#666"}}>Cancel</button>
              </div>
            )}
          </div>
        ) : showDirectChat ? (
          <div className="joinChatContainer">
            <h3>1-1 Chat</h3>
            {!showDirectChat || !directChatMode ? (
              <div style={{width: "100%", maxWidth: "400px"}}>
                <input
                  type="text"
                  placeholder="Enter username to chat..."
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  style={{width: "100%", padding: "10px", marginBottom: "10px", boxSizing: "border-box"}}
                />
                <button onClick={startDirectChat} style={{backgroundColor: "#9C27B0", marginRight: "10px"}}>Start Chat</button>
                <button onClick={() => setShowDirectChat(false)} style={{backgroundColor: "#666"}}>Back</button>
              </div>
            ) : (
              <div style={{width: "100%"}}>
                <button onClick={endDirectChat} style={{backgroundColor: "#666", marginBottom: "10px"}}>Back</button>
              </div>
            )}
          </div>
        ) : directChatMode ? (
          <div className="chat-window">
            <div className="chat-header">
              <p>Chat with {selectedUser}</p>
              <div style={{display: "flex", gap: "10px"}}>
                <button onClick={endDirectChat} style={{backgroundColor: "#ff6b6b", cursor: "pointer"}}>Close</button>
              </div>
            </div>
            <div className="chat-body">
                {directMessages.map((messageContent, index) => {
                  return (
                    <div
                      className="message"
                      key={index}
                      id={username === messageContent.from ? "you" : "other"}
                    >
                      <div>
                        <div className="message-content">
                          <p>{messageContent.message}</p>
                        </div>
                        <div className="message-meta">
                          <p id="time">{messageContent.time}</p>
                          <p id="author">{messageContent.from}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-footer">
              {showEmoji && (
                <div className="emoji-picker-container">
                  <EmojiPicker onEmojiClick={onEmojiClick} width={300} height={400} />
                </div>
              )}

              <button 
                  onClick={() => setShowEmoji((val) => !val)} 
                  className="emoji-btn"
                  style={{ fontSize: "20px", marginRight: "5px", cursor: "pointer" }}
              >
                  😊
              </button>

              <input
                type="text"
                value={directMessageInput}
                placeholder="Hey..."
                onChange={(e) => setDirectMessageInput(e.target.value)}
                onKeyPress={(event) => {
                  event.key === "Enter" && sendDirectMessage();
                }}
              />
              <button onClick={sendDirectMessage}>&#9658;</button>
            </div>
          </div>
        ) : (
          <div className="chat-window">
            <div className="chat-header">
              <p>Room: {room}</p>
              <div style={{display: "flex", gap: "10px"}}>
                <button onClick={leaveRoom} style={{backgroundColor: "#ffa500", cursor: "pointer"}}>Leave Room</button>
                <button onClick={handleLogout} style={{backgroundColor: "#ff6b6b", cursor: "pointer"}}>Sign Out</button>
              </div>
            </div>
            <div className="chat-body">
                {messageList.map((messageContent, index) => {
                  return (
                    <div
                      className="message"
                      key={index}
                      id={username === messageContent.author ? "you" : "other"}
                    >
                      <div>
                        <div className="message-content">
                          <p>{messageContent.message}</p>
                        </div>
                        <div className="message-meta">
                          <p id="time">{messageContent.time}</p>
                          <p id="author">{messageContent.author}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-footer">
              <div style={{position: "absolute", top: "-20px", fontSize: "12px", color: "gray"}}>
                  {typingStatus}
              </div>
              
              {showEmoji && (
                <div className="emoji-picker-container">
                  <EmojiPicker onEmojiClick={onEmojiClick} width={300} height={400} />
                </div>
              )}

              <button 
                  onClick={() => setShowEmoji((val) => !val)} 
                  className="emoji-btn"
                  style={{ fontSize: "20px", marginRight: "5px", cursor: "pointer" }}
              >
                  😊
              </button>

              <input
                type="text"
                value={currentMessage}
                placeholder="Hey..."
                onChange={handleTyping}
                onKeyPress={(event) => {
                  event.key === "Enter" && sendMessage();
                }}
              />
              <button onClick={sendMessage}>&#9658;</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default App;