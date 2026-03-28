const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    nif: { type: String, required: true, unique: true }, // Tax ID for Portugal
    
    // 2FA Fields
    twoFactorSecret: { type: String }, 
    twoFactorExpires: { type: Date },
    isVerified: { type: Boolean, default: false },

    // Password Reset
    resetPasswordSecret: { type: String },
    resetPasswordExpires: { type: Date },

    // Legal / GDPR Consent
    rgpdConsent: { type: Boolean, required: true },
    consentDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
