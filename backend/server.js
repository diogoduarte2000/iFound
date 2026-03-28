require("dotenv").config();

const app = require("./app");
const { connectToDatabase, isSmtpConfigured } = require("./db");

const PORT = process.env.PORT || 5000;

connectToDatabase()
  .then(() => {
    console.log("MongoDB ligado com sucesso.");
    if (!isSmtpConfigured()) {
      console.warn("SMTP nao configurado. O 2FA por email nao vai funcionar.");
    }
    app.listen(PORT, () => {
      console.log(`Servidor a correr na porta ${PORT}.`);
    });
  })
  .catch((err) => {
    console.error("Erro ao ligar ao MongoDB:", err);
  });
