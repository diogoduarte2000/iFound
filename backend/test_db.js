const mongoose = require("mongoose");
const MONGODB_URI = "mongodb+srv://diogosilvanoduarte_db_user:E6cxZgdcjLYNfU4B@cluster0.1p2cerr.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGODB_URI).then(async () => {
  const Publication = require("./models/Publication");
  const pubs = await Publication.find({});
  console.log("=== PUBLICACOES NO MONGODB ===");
  pubs.forEach(p => console.log(`${p._id} | ${p.model} | Status: ${p.status}`));
  process.exit();
}).catch(console.error);
