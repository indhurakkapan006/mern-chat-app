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
  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [typingStatus, setTypingStatus] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  
  const messagesEndRef = useRef(null);

  // --- AUTHENTICATION ---

  const handleRegister = async () => {
    try {
      // 2. UPDATED URL FOR REGISTRATION
      await axios.post("https://chat-app-backend-k5ki.onrender.com/register", { username, password });
      alert("Registration Successful! Now please login.");
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

  // --- CHAT LOGIC ---

  const joinRoom = () => {
    if (username !== "" && room !== "") {
      socket.emit("join_room", room);
      setShowChat(true);
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
      setMessageList((list) => [...list, messageData]);
      setCurrentMessage("");
      setShowEmoji(false);
      socket.emit("typing", { room: room, message: "" });
    }
  };

  const onEmojiClick = (emojiObject) => {
    setCurrentMessage((prev) => prev + emojiObject.emoji);
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    socket.emit("typing", { room: room, author: username, message: "typing" });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageList]);

  useEffect(() => {
    socket.on("receive_message", (data) => setMessageList((list) => [...list, data]));
    socket.on("display_typing", (data) => setTypingStatus(data.message === "" ? "" : `${data.author} is typing...`));
    socket.on("load_history", (history) => setMessageList(history));

    return () => {
      socket.off("receive_message");
      socket.off("display_typing");
      socket.off("load_history");
    };
  }, [socket]);

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
        !showChat ? (
          <div className="joinChatContainer">
            <h3>Welcome, {username}!</h3>
            <input
              type="text"
              placeholder="Room ID..."
              onChange={(e) => setRoom(e.target.value)}
            />
            <button onClick={joinRoom}>Join Room</button>
          </div>
        ) : (
          <div className="chat-window">
            <div className="chat-header">
              <p>Room: {room}</p>
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