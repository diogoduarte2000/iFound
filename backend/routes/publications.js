const express = require("express");
const Publication = require("../models/Publication");
const authMiddleware = require("../middleware/authMiddleware");
const { findAppleIphoneByModel } = require("../data/appleIphoneCatalog");
const { getImeiValidationResult } = require("../utils/imei");

const router = express.Router();

const ONLINE_STATUSES = ["Ativo", "Pendente"];
const MANUAL_STATUSES = ["Ativo", "Pendente", "Resolvido"];
const MAX_ONLINE_PUBLICATIONS = 3;
const PENDING_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ONLINE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const RESOLVED_RETENTION_MS = 5 * 60 * 1000;

const normalizeTextField = (value) => String(value || "").trim();

const parsePublicationPayload = (body, requirePhoto = true) => {
  const type = normalizeTextField(body.type);
  const model = normalizeTextField(body.model);
  const color = normalizeTextField(body.color);
  const storage = normalizeTextField(body.storage);
  const imei = normalizeTextField(body.imei);
  const distinctiveMarks = normalizeTextField(body.distinctiveMarks);
  const zone = normalizeTextField(body.zone);
  const exactLocation = normalizeTextField(body.exactLocation);
  const dateOfEvent = body.dateOfEvent;
  const photo = body.photo;

  if (!["Perdido", "Achado"].includes(type)) {
    return { error: "Tipo invalido." };
  }

  if (!model || !color || !zone || !dateOfEvent) {
    return { error: "Faltam campos obrigatorios na publicacao." };
  }

  if (requirePhoto && !photo) {
    return { error: "E obrigatorio anexar uma fotografia." };
  }

  const catalogModel = findAppleIphoneByModel(model);

  if (catalogModel) {
    if (!catalogModel.colors.includes(color)) {
      return { error: "A cor selecionada nao corresponde ao modelo escolhido." };
    }

    if (storage && !catalogModel.storages.includes(storage)) {
      return { error: "A memoria selecionada nao corresponde ao modelo escolhido." };
    }
  }

  let normalizedImei = "";
  if (imei) {
    const imeiValidation = getImeiValidationResult(imei);

    if (!imeiValidation.isValid) {
      return { error: imeiValidation.reason };
    }

    normalizedImei = imeiValidation.normalizedImei;
  }

  return {
    value: {
      type,
      model,
      color,
      storage,
      imei: normalizedImei,
      distinctiveMarks,
      zone,
      exactLocation,
      dateOfEvent,
      photo,
    },
  };
};

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
    const parsedPayload = parsePublicationPayload(req.body, true);
    if (parsedPayload.error) {
      return res.status(400).json({ message: parsedPayload.error });
    }

    const {
      type,
      model,
      color,
      storage,
      imei: normalizedImei,
      distinctiveMarks,
      zone,
      exactLocation,
      dateOfEvent,
      photo,
    } = parsedPayload.value;

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
      imei: normalizedImei,
      distinctiveMarks,
      zone,
      exactLocation,
      dateOfEvent,
      photo,
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

router.get("/mine/:publicationId", authMiddleware, async (req, res) => {
  try {
    await expirePublications(req.user.id);

    const publication = await Publication.findOne({
      _id: req.params.publicationId,
      author: req.user.id,
    });

    if (!publication) {
      return res.status(404).json({ message: "Publicacao nao encontrada." });
    }

    res.json(publication);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar a publicacao." });
  }
});

router.patch("/:publicationId", authMiddleware, async (req, res) => {
  try {
    await expirePublications(req.user.id);

    const publication = await Publication.findOne({
      _id: req.params.publicationId,
      author: req.user.id,
    });

    if (!publication) {
      return res.status(404).json({ message: "Publicacao nao encontrada." });
    }

    if (["Offline", "Resolvido"].includes(publication.status)) {
      return res.status(400).json({ message: "So pode editar publicacoes ativas ou pendentes." });
    }

    const parsedPayload = parsePublicationPayload(
      {
        ...req.body,
        photo: req.body.photo || publication.photo,
      },
      true
    );

    if (parsedPayload.error) {
      return res.status(400).json({ message: parsedPayload.error });
    }

    const {
      type,
      model,
      color,
      storage,
      imei,
      distinctiveMarks,
      zone,
      exactLocation,
      dateOfEvent,
      photo,
    } = parsedPayload.value;

    publication.type = type;
    publication.model = model;
    publication.color = color;
    publication.storage = storage;
    publication.imei = imei;
    publication.distinctiveMarks = distinctiveMarks;
    publication.zone = zone;
    publication.exactLocation = exactLocation;
    publication.dateOfEvent = dateOfEvent;
    publication.photo = photo;

    await publication.save();

    res.json({
      message: "Publicacao atualizada com sucesso.",
      publication,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao atualizar a publicacao." });
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
