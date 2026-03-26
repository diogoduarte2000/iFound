const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    filePath: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: true }
);

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "" },
    attachments: [attachmentSchema],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const chatSchema = new mongoose.Schema(
  {
    publication: { type: mongoose.Schema.Types.ObjectId, ref: "Publication", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    messages: [messageSchema],
  },
  { timestamps: true }
);

chatSchema.index({ publication: 1, participants: 1 });

module.exports = mongoose.model("Chat", chatSchema);
