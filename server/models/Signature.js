// server/models/Signature.js
const mongoose = require("mongoose");

const signatureSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    signerId: {
      // If signed by an authenticated user
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Can be null for external signers
    },
    externalSignerEmail: {
      // If signed by an external user
      type: String,
      required: false,
    },
    x: {
      // X coordinate of signature on the page
      type: Number,
      required: true,
    },
    y: {
      // Y coordinate of signature on the page
      type: Number,
      required: true,
    },
    page: {
      // 1-indexed page number
      type: Number,
      required: true,
    },
    // You might want to store actual signature image path or SVG data here later
    // For now, we'll use a simple text placeholder
    signatureType: {
      // 'text', 'image'
      type: String,
      default: "text",
    },
    signatureText: {
      // The text that represents the signature
      type: String,
    },
    // Add more fields if you implement image signatures
    // signatureImagePath: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Signature", signatureSchema);
