require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

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
  if (mongoose.connection.readyState === 1) {
    res.json({ message: "Backend e DB conectados com sucesso!" });
  } else {
    res.status(503).json({ message: "Servidor ativo mas Banco de Dados offline/indisponível." });
  }
});

const authRoutes = require("./routes/auth");
const publicationRoutes = require("./routes/publications");
const chatRoutes = require("./routes/chats");

app.use("/api/auth", authRoutes);
app.use("/api/posts", publicationRoutes);
app.use("/api/chats", chatRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Rota nao encontrada.",
    path: req.originalUrl,
  });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ifound";
const smtpConfigured = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}.`);
  
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log("MongoDB ligado com sucesso.");
      if (!smtpConfigured) {
        console.warn("SMTP nao configurado. O 2FA por email nao vai funcionar.");
      }
    })
    .catch((err) => {
      console.error("Erro critico ao ligar ao MongoDB:", err.message);
    });
});
