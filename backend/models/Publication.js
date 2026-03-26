const mongoose = require("mongoose");

const publicationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Perdido", "Achado"], required: true },
    
    // iPhone Details
    model: { type: String, required: true }, // e.g., "iPhone 13 Pro"
    color: { type: String, required: true }, 
    storage: { type: String }, // e.g., "128GB"
    imei: { type: String }, // Partial or Full
    distinctiveMarks: { type: String }, 
    
    // Location Details (Portugal specific in UI but simple string/coords here)
    zone: { type: String, required: true }, // e.g., "Lisboa - Parque das Nações"
    exactLocation: { type: String },
    dateOfEvent: { type: Date, required: true },
    
    // Ownership
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["Ativo", "Pendente", "Resolvido", "Offline"], default: "Ativo" },
    pendingSince: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    offlineAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Publication", publicationSchema);
