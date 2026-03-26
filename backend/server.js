require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Basic Route for testing
app.get("/api/status", (req, res) => {
  res.json({ message: "Backend do Perdidos e Achados (Portugal) a funcionar!" });
});

// Import Routes
const authRoutes = require("./routes/auth");
const publicationRoutes = require("./routes/publications");

app.use("/api/auth", authRoutes);
app.use("/api/posts", publicationRoutes);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/perdidos-achados-iphone";

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("🔥 Ligado à base de dados MongoDB!");
  app.listen(PORT, () => {
    console.log(`🚀 Servidor a correr na porta ${PORT}`);
  });
})
.catch((err) => {
  console.error("❌ Erro ao ligar ao MongoDB:", err);
});
