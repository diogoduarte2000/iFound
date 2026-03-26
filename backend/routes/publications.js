const express = require("express");
const Publication = require("../models/Publication");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

// 1. CREATE A PUBLICATION (Requires Login)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { type, model, color, storage, imei, distinctiveMarks, zone, exactLocation, dateOfEvent } = req.body;
    
    // Minimal Validation
    if (!["Perdido", "Achado"].includes(type)) {
      return res.status(400).json({ message: "Tipo inválido." });
    }

    const newPublication = new Publication({
      type,
      model,
      color,
      storage,
      imei,
      distinctiveMarks,
      zone,
      exactLocation,
      dateOfEvent,
      author: req.user.id
    });

    const savedPub = await newPublication.save();
    res.status(201).json({ message: "Publicação criada com sucesso!", publication: savedPub });
  } catch (error) {
    res.status(500).json({ message: "Erro ao criar publicação." });
  }
});

// 2. GET ALL PUBLICATIONS (Public Feed)
router.get("/", async (req, res) => {
  try {
    const { type, zone } = req.query; // Filters -> ?type=Perdido&zone=Lisboa
    const filter = {};
    if (type) filter.type = type;
    if (zone) filter.zone = { $regex: zone, $options: "i" };

    const publications = await Publication.find(filter)
      .sort({ createdAt: -1 }) // Newest first
      .populate("author", "email"); // We do NOT expose NIF on public endpoint
    res.json(publications);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar publicações." });
  }
});

// 3. GET MY PUBLICATIONS (Requires Login)
router.get("/mine", authMiddleware, async (req, res) => {
    try {
        const publications = await Publication.find({ author: req.user.id })
            .sort({ createdAt: -1 });
        res.json(publications);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar as suas publicações." });
    }
});

module.exports = router;
