const express = require("express");
const Publication = require("../models/Publication");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const ONLINE_STATUSES = ["Ativo", "Pendente"];
const MANUAL_STATUSES = ["Ativo", "Pendente", "Resolvido"];
const MAX_ONLINE_PUBLICATIONS = 3;
const PENDING_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ONLINE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const RESOLVED_RETENTION_MS = 5 * 60 * 1000;

const expirePublications = async (authorId) => {
  const now = new Date();
  const resolvedFilter = {
    status: "Resolvido",
    resolvedAt: { $ne: null, $lte: new Date(now.getTime() - RESOLVED_RETENTION_MS) },
  };

  if (authorId) {
    resolvedFilter.author = authorId;
  }

  await Publication.deleteMany(resolvedFilter);

  const filter = {
    status: { $ne: "Offline" },
    $or: [
      { createdAt: { $lte: new Date(now.getTime() - ONLINE_LIFETIME_MS) } },
      {
        status: "Pendente",
        pendingSince: { $ne: null, $lte: new Date(now.getTime() - PENDING_LIFETIME_MS) },
      },
    ],
  };

  if (authorId) {
    filter.author = authorId;
  }

  await Publication.updateMany(filter, {
    $set: {
      status: "Offline",
      offlineAt: now,
      pendingSince: null,
      resolvedAt: null,
    },
  });
};

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { type, model, color, storage, imei, distinctiveMarks, zone, exactLocation, dateOfEvent } = req.body;

    if (!["Perdido", "Achado"].includes(type)) {
      return res.status(400).json({ message: "Tipo invalido." });
    }

    await expirePublications(req.user.id);

    const onlineCount = await Publication.countDocuments({
      author: req.user.id,
      status: { $in: ONLINE_STATUSES },
    });

    if (onlineCount >= MAX_ONLINE_PUBLICATIONS) {
      return res.status(400).json({
        message: "Cada utilizador pode ter no maximo 3 publicacoes online em simultaneo.",
      });
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
      author: req.user.id,
      status: "Ativo",
      pendingSince: null,
      offlineAt: null,
    });

    const savedPublication = await newPublication.save();
    res.status(201).json({ message: "Publicacao criada com sucesso!", publication: savedPublication });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao criar publicacao." });
  }
});

router.get("/", async (req, res) => {
  try {
    await expirePublications();

    const { type, zone, status, q } = req.query;
    const filter = {
      status: status && ONLINE_STATUSES.includes(status) ? status : { $in: ONLINE_STATUSES },
    };
    const andFilters = [];

    if (type) {
      filter.type = type;
    }

    if (zone) {
      andFilters.push({ zone: { $regex: zone, $options: "i" } });
    }

    if (q) {
      const searchRegex = { $regex: q, $options: "i" };
      andFilters.push({
        $or: [
          { model: searchRegex },
          { color: searchRegex },
          { zone: searchRegex },
          { exactLocation: searchRegex },
          { distinctiveMarks: searchRegex },
          { storage: searchRegex },
        ],
      });
    }

    if (andFilters.length > 0) {
      filter.$and = andFilters;
    }

    const publications = await Publication.find(filter)
      .sort({ createdAt: -1 })
      .populate("author", "email");

    res.json(publications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar publicacoes." });
  }
});

router.get("/mine", authMiddleware, async (req, res) => {
  try {
    await expirePublications(req.user.id);
    const publications = await Publication.find({ author: req.user.id }).sort({ createdAt: -1 });
    res.json(publications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar as suas publicacoes." });
  }
});

router.patch("/:publicationId/status", authMiddleware, async (req, res) => {
  try {
    const nextStatus = String(req.body.status || "");

    if (!MANUAL_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ message: "Estado invalido." });
    }

    await expirePublications(req.user.id);

    const publication = await Publication.findOne({
      _id: req.params.publicationId,
      author: req.user.id,
    });

    if (!publication) {
      return res.status(404).json({ message: "Publicacao nao encontrada." });
    }

    if (publication.status === "Offline") {
      return res.status(400).json({
        message: "Esta publicacao ficou offline automaticamente e ja nao pode voltar ao feed.",
      });
    }

    publication.status = nextStatus;
    publication.pendingSince = nextStatus === "Pendente" ? new Date() : null;
    publication.resolvedAt = nextStatus === "Resolvido" ? new Date() : null;
    publication.offlineAt = nextStatus === "Resolvido" ? new Date() : null;
    await publication.save();

    res.json({
      message: "Estado da publicacao atualizado com sucesso.",
      publication,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao atualizar o estado da publicacao." });
  }
});

module.exports = router;
