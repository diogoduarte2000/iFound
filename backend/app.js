require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const publicationRoutes = require("./routes/publications");
const chatRoutes = require("./routes/chats");

const app = express();

app.use(express.json({ limit: "15mb" }));
app.use(cors());

app.get("/", (req, res) => {
  res.json({
    message: "Backend do Ifound a funcionar!",
    status: "/api/status",
    auth: "/api/auth",
    posts: "/api/posts",
  });
});

app.get("/api/status", (req, res) => {
  res.json({ message: "Backend do Ifound a funcionar!" });
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", publicationRoutes);
app.use("/api/chats", chatRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Rota nao encontrada.",
    path: req.originalUrl,
  });
});

module.exports = app;
