require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { isDatabaseConfigured, isSmtpConfigured } = require("./db");
const authRoutes = require("./routes/auth");
const publicationRoutes = require("./routes/publications");
const chatRoutes = require("./routes/chats");

const app = express();

const buildStatusPayload = () => ({
  message: "Backend do Ifound a funcionar!",
  runtime: process.env.NETLIFY ? "netlify" : process.env.NODE_ENV || "development",
  databaseConfigured: isDatabaseConfigured(),
  smtpConfigured: isSmtpConfigured(),
  auth: "/api/auth",
  posts: "/api/posts",
  chats: "/api/chats",
});

app.use(express.json({ limit: "15mb" }));
app.use(cors());

app.get("/", (req, res) => {
  res.json({
    ...buildStatusPayload(),
    status: "/api/status",
  });
});

app.get("/api/status", (req, res) => {
  const payload = buildStatusPayload();

  res.status(payload.databaseConfigured ? 200 : 503).json(payload);
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
