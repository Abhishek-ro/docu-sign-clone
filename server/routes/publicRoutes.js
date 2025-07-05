// document-signature-app/server/routes/publicRoutes.js
const express = require("express");
const router = express.Router();
const Document = require("../models/Document");

// GET /public/documents/:token
// This endpoint allows access to a document using a share token without authentication
router.get("/documents/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const document = await Document.findOne({ shareToken: token });

    if (!document) {
      console.log(`[PUBLIC ROUTES] Document not found for token: ${token}`);
      return res
        .status(404)
        .json({ message: "Document not found or invalid token." });
    }

    // Check if the share token has expired
    if (document.shareExpiresAt && document.shareExpiresAt < new Date()) {
      console.log(
        `[PUBLIC ROUTES] Share token expired for document ${document._id}`
      );
      // Optionally, you might want to clear the token and expiration from the document here
      // document.shareToken = undefined;
      // document.sharedWith = undefined;
      // document.shareExpiresAt = undefined;
      // await document.save();
      return res.status(410).json({ message: "Document link has expired." }); // 410 Gone
    }

    // You might want to select specific fields to send back to the public,
    // avoiding sending sensitive internal data. For now, we send most.
    // Important: Do NOT send `owner` or `annotations` if they contain sensitive user data that public shouldn't see
    // For signing, we DO need annotations, so we will send them.
    const responseDocument = {
      _id: document._id,
      fileName: document.fileName,
      filePath: document.filePath,
      isFinalized: document.isFinalized,
      annotations: document.annotations, // Send annotations so signer can see existing fields
      // Other fields you deem safe for public view
    };

    res.status(200).json(responseDocument);
  } catch (error) {
    console.log("Error fetching document by public token:", error);
    res.status(500).json({ message: "Server error fetching document." });
  }
});

module.exports = router;
