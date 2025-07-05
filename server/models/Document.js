// document-signature-app/server/models/Document.js

const mongoose = require("mongoose");

const annotationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true }, // e.g., 'signature_field', 'placed_signature', 'text_field'
    page: { type: Number, required: true },
    objectData: { type: mongoose.Schema.Types.Mixed, required: true }, // Fabric.js object JSON
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    imageData: { type: String }, // For placed signatures, stores the base64 image data
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  filePath: {
    type: String, // Path to the original uploaded PDF
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  // Ensure fileSize and mimeType are present for complete document metadata
  fileSize: {
    type: Number,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  annotations: [annotationSchema],
  finalizedPath: {
    type: String,
    default: null,
  },
  isFinalized: {
    type: Boolean,
    default: false,
  },
  // --- NEW FIELDS FOR SHARING (Day 9) ---
  shareToken: {
    type: String,
    unique: true, // Ensure each token is unique
    sparse: true, // Allows null values, so documents without tokens don't violate unique constraint
  },
  sharedWith: {
    type: String, // Email of the person it's shared with
    match: [/.+@.+\..+/, "Please fill a valid email address"], // Basic email validation
  },
  shareExpiresAt: {
    type: Date,
  },
  // ------------------------------------
});

const Document = mongoose.model("Document", documentSchema);

module.exports = Document;
