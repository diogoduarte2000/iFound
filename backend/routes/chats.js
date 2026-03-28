const express = require("express");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const crypto = require("crypto");
const Chat = require("../models/Chat");
const Publication = require("../models/Publication");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const ATTACHMENT_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const storageRoot = process.env.NETLIFY ? path.join("/tmp", "ifound-storage") : path.join(__dirname, "..", "storage");
const uploadRoot = path.join(storageRoot, "chat-attachments");

if (!fsSync.existsSync(uploadRoot)) {
  fsSync.mkdirSync(uploadRoot, { recursive: true });
}

const ensureParticipant = (chat, userId) =>
  chat.participants.some((participant) => participant.toString() === userId);

const getAttachmentExtension = (originalName, mimeType) => {
  const existingExtension = path.extname(originalName || "");
  if (existingExtension) {
    return existingExtension;
  }

  const mimeMap = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };

  return mimeMap[mimeType] || ".bin";
};

const deleteFileIfExists = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

const cleanupExpiredAttachments = async (chat) => {
  let changed = false;

  for (const message of chat.messages) {
    const keptAttachments = [];

    for (const attachment of message.attachments) {
      if (attachment.expiresAt.getTime() <= Date.now()) {
        await deleteFileIfExists(attachment.filePath);
        changed = true;
      } else {
        keptAttachments.push(attachment);
      }
    }

    if (keptAttachments.length !== message.attachments.length) {
      message.attachments = keptAttachments;
    }
  }

  if (changed) {
    await chat.save();
  }

  return chat;
};

const populateChat = async (chat) => {
  await chat.populate([
    {
      path: "publication",
      select: "type model color zone status createdAt author",
      populate: { path: "author", select: "email" },
    },
    { path: "participants", select: "email" },
    { path: "messages.sender", select: "email" },
  ]);

  return chat;
};

const serializeChat = async (chat) => {
  await populateChat(chat);

  return {
    _id: chat._id,
    publication: chat.publication,
    participants: chat.participants,
    updatedAt: chat.updatedAt,
    messages: chat.messages.map((message) => ({
      _id: message._id,
      sender: message.sender,
      text: message.text,
      createdAt: message.createdAt,
      attachments: message.attachments.map((attachment) => ({
        _id: attachment._id,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        expiresAt: attachment.expiresAt,
        url: `/api/chats/${chat._id}/messages/${message._id}/attachments/${attachment._id}`,
      })),
    })),
  };
};

const getChatSummary = async (chat) => {
  await populateChat(chat);
  const lastMessage = chat.messages[chat.messages.length - 1];

  return {
    _id: chat._id,
    publication: chat.publication,
    participants: chat.participants,
    updatedAt: chat.updatedAt,
    lastMessage: lastMessage
      ? {
          _id: lastMessage._id,
          sender: lastMessage.sender,
          text: lastMessage.text,
          createdAt: lastMessage.createdAt,
          hasAttachments: lastMessage.attachments.length > 0,
        }
      : null,
  };
};

router.get("/", authMiddleware, async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.user.id }).sort({ updatedAt: -1 });
    const summaries = [];

    for (const chat of chats) {
      await cleanupExpiredAttachments(chat);
      summaries.push(await getChatSummary(chat));
    }

    res.json(summaries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar conversas." });
  }
});

router.post("/open", authMiddleware, async (req, res) => {
  try {
    const { publicationId } = req.body;
    const publication = await Publication.findById(publicationId);

    if (!publication) {
      return res.status(404).json({ message: "Comunicacao nao encontrada." });
    }

    if (publication.author.toString() === req.user.id) {
      return res.status(400).json({ message: "Nao pode abrir chat na sua propria comunicacao." });
    }

    let chat = await Chat.findOne({
      publication: publication._id,
      participants: { $all: [req.user.id, publication.author] },
    });

    if (!chat) {
      chat = await Chat.create({
        publication: publication._id,
        participants: [req.user.id, publication.author],
        messages: [],
      });
    }

    await cleanupExpiredAttachments(chat);
    res.json(await serializeChat(chat));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao abrir conversa." });
  }
});

router.get("/:chatId", authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat || !ensureParticipant(chat, req.user.id)) {
      return res.status(404).json({ message: "Conversa nao encontrada." });
    }

    await cleanupExpiredAttachments(chat);
    res.json(await serializeChat(chat));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar conversa." });
  }
});

router.post("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat || !ensureParticipant(chat, req.user.id)) {
      return res.status(404).json({ message: "Conversa nao encontrada." });
    }

    const text = String(req.body.text || "").trim();
    const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];

    if (!text && attachments.length === 0) {
      return res.status(400).json({ message: "Mensagem vazia." });
    }

    if (attachments.length > MAX_ATTACHMENTS) {
      return res.status(400).json({ message: "Pode enviar no maximo 3 fotos por mensagem." });
    }

    const storedAttachments = [];

    for (const attachment of attachments) {
      const mimeType = String(attachment.mimeType || "");
      const originalName = String(attachment.originalName || "imagem");
      const dataUrl = String(attachment.dataUrl || "");
      const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);

      if (!mimeType.startsWith("image/") || !matches) {
        return res.status(400).json({ message: "Apenas imagens sao permitidas no chat." });
      }

      const buffer = Buffer.from(matches[2], "base64");

      if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
        return res.status(400).json({ message: "Cada foto pode ter no maximo 4MB." });
      }

      const filename = `${Date.now()}-${crypto.randomUUID()}${getAttachmentExtension(originalName, mimeType)}`;
      const filePath = path.join(uploadRoot, filename);
      await fs.writeFile(filePath, buffer);

      storedAttachments.push({
        originalName,
        mimeType,
        filePath,
        expiresAt: new Date(Date.now() + ATTACHMENT_TTL_MS),
      });
    }

    chat.messages.push({
      sender: req.user.id,
      text,
      attachments: storedAttachments,
    });

    await chat.save();
    await cleanupExpiredAttachments(chat);

    res.status(201).json(await serializeChat(chat));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao enviar mensagem." });
  }
});

router.get("/:chatId/messages/:messageId/attachments/:attachmentId", authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat || !ensureParticipant(chat, req.user.id)) {
      return res.status(404).json({ message: "Conversa nao encontrada." });
    }

    const message = chat.messages.id(req.params.messageId);
    const attachment = message?.attachments.id(req.params.attachmentId);

    if (!attachment) {
      return res.status(404).json({ message: "Anexo nao encontrado." });
    }

    if (attachment.expiresAt.getTime() <= Date.now()) {
      await deleteFileIfExists(attachment.filePath);
      message.attachments = message.attachments.filter(
        (item) => item._id.toString() !== attachment._id.toString()
      );
      await chat.save();
      return res.status(404).json({ message: "Este anexo expirou." });
    }

    if (!fsSync.existsSync(attachment.filePath)) {
      return res.status(404).json({ message: "Ficheiro nao encontrado." });
    }

    res.type(attachment.mimeType);
    res.sendFile(attachment.filePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao abrir anexo." });
  }
});

module.exports = router;
