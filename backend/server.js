require("dotenv").config();
const app = require("./app");
const { connectToDatabase, isSmtpConfigured } = require("./db");

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Servidor a correr na porta ${PORT}.`);

  try {
    await connectToDatabase();
    console.log("MongoDB ligado com sucesso.");
  } catch (err) {
    console.error("Erro critico ao ligar ao MongoDB:", err.message);
  }

  if (!isSmtpConfigured()) {
    console.warn("SMTP nao configurado. O envio de emails 2FA e recuperacao nao vai funcionar.");
  }
});
