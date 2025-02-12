const http = require("http");
const fs = require("fs");
const socketIO = require("socket.io");
const sqlite3 = require("sqlite3").verbose();

// Set up the database
const db = new sqlite3.Database("chat.db", (err) => {
  if (err) {
    console.error("Error opening database", err);
  } else {
    db.run(
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user TEXT,
        message TEXT,
        timestamp TEXT
      )`
    );
  }
});

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    fs.readFile(__dirname + "/index.html", (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading index.html");
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      }
    });
  } else if (req.url === "/styles.css") {
    fs.readFile(__dirname + "/styles.css", (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading styles.css");
      } else {
        res.writeHead(200, { "Content-Type": "text/css" });
        res.end(data);
      }
    });
  }
});

// Enable CORS for WebSockets
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = 5000;

// Handle socket connections
io.on("connection", (socket) => {
  console.log("A user connected");

  // Load messages from SQLite and send them to the client
  db.all("SELECT * FROM messages ORDER BY id ASC", (err, rows) => {
    if (err) {
      console.error("Error loading messages:", err);
    } else {
      socket.emit("load messages", rows);
    }
  });

  // Handle incoming messages
  socket.on("send message", (chatData) => {
    const { user, message, timestamp } = chatData;

    // Save the message to SQLite
    db.run(
      "INSERT INTO messages (user, message, timestamp) VALUES (?, ?, ?)",
      [user, message, timestamp],
      function (err) {
        if (err) {
          console.error("Error inserting message:", err);
        } else {
          // Broadcast the new message to all clients
          io.emit("send message", chatData);
        }
      }
    );
  });

  // Add new admin request handler
  socket.on("admin request", (password) => {
    if (password === "Admin") {
      db.all("SELECT * FROM messages", (err, rows) => {
        if (err) {
          console.error("Error fetching admin data:", err);
        } else {
          socket.emit("admin data", rows);
        }
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server is listening on port ${port}`);
});
