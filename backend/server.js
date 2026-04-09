require("dotenv").config();
const cluster = require("cluster");
const os = require("os");
const app = require("./app");
const { connectToDatabase, isSmtpConfigured } = require("./db");

const PORT = process.env.PORT || 5000;
const availableCpuCount = typeof os.availableParallelism === "function"
  ? os.availableParallelism()
  : os.cpus().length;
const requestedWorkerCount = Math.max(1, Number(process.env.NODE_CLUSTER_WORKERS || 1));
const canShareRealtimeState = process.env.CHAT_REALTIME_SHARED_BACKPLANE === "true";
const workerCount = canShareRealtimeState
  ? Math.min(requestedWorkerCount, availableCpuCount)
  : 1;

const startServer = () => {
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
};

if (requestedWorkerCount > 1 && !canShareRealtimeState) {
  console.warn(
    "NODE_CLUSTER_WORKERS > 1 foi pedido, mas o live chat em memoria precisa de um backplane partilhado. " +
      "O backend vai arrancar com 1 worker para manter o chat em tempo real consistente."
  );
}

if (workerCount > 1 && cluster.isPrimary) {
  console.log(`Processo principal ativo. A iniciar ${workerCount} workers.`);

  for (let index = 0; index < workerCount; index += 1) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.warn(`Worker ${worker.process.pid} terminou (code=${code}, signal=${signal}). A reiniciar...`);
    cluster.fork();
  });
} else {
  startServer();
}
