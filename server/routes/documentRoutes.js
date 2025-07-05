// document-signature-app/server/routes/documentRoutes.js
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const verifyToken = require("../middleware/authMiddleware");
const Document = require("../models/Document");
const path = require("path");
const fs = require("fs");

// Multer storage configuration (remains the same)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // Get the user ID from the token
    // Fetch documents belonging to the authenticated user
    const documents = await Document.find({ owner: userId });
    console.log("[DOCUMENT ROUTES] Fetched documents:", documents.length); // Keep this log!
    res.status(200).json(documents);
  } catch (error) {
    console.log("Error fetching documents:", error);
    res.status(500).json({ message: "Server error fetching documents" });
  }
});

router.post(
  "/upload",
  verifyToken,
  upload.single("document"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
      }
      console.log("[UPLOAD] req.file.mimetype:", req.file.mimetype);
      console.log("[UPLOAD] req.file.size:", req.file.size);

      const newDocument = new Document({
        fileName: req.file.originalname,
        filePath: "/" + req.file.path, // Store as /uploads/filename.pdf
        owner: req.user.id, // Set the owner to the authenticated user's ID
        mimeType: req.file.mimetype, // NEW: Add MIME type from multer
        fileSize: req.file.size, // NEW: Add file size from multer
        annotations: [], // Initialize with an empty array
      });

      await newDocument.save();

      res.status(201).json({
        message: "Document uploaded successfully!",
        fileName: req.file.originalname,
        filePath: newDocument.filePath,
        documentId: newDocument._id,
      });
    } catch (error) {
      console.log("Document upload error:", error);

      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          message: `Document validation failed: ${errors.join(", ")}`,
        });
      }
      res.status(500).json({ message: "Server error during document upload." });
    }
  }
);

// Existing annotations route (ensure this is present and correct)
router.post("/:documentId/annotations", verifyToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { annotations } = req.body;

    // Find the document by ID and owner to ensure authorization
    const document = await Document.findOne({
      _id: documentId,
      owner: req.user.id, // --- FIXED: Changed from req.user.userId to req.user.id ---
    });

    if (!document) {
      return res
        .status(404)
        .json({ message: "Document not found or you do not have permission." });
    }

    document.annotations = annotations;
    await document.save();

    res.status(200).json({
      message: "Annotations saved successfully",
      annotations: document.annotations,
    });
  } catch (error) {
    console.log("Error saving annotations:", error);
    res.status(500).json({ message: "Server error while saving annotations." });
  }
});

router.get("/:documentId/annotations", verifyToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user.id, // --- FIXED: Changed from req.user.userId to req.user.id ---
    });

    if (!document) {
      return res
        .status(404)
        .json({ message: "Document not found or you do not have permission." });
    }

    res.status(200).json(document.annotations || []); // Return empty array if no annotations
  } catch (error) {
    console.log("Error fetching annotations:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching annotations." });
  }
});

router.post("/:documentId/finalize", verifyToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    // 1. Fetch the document and its annotations
    const document = await Document.findOne({
      _id: documentId,
      owner: req.user.id, // --- FIXED: Changed from req.user.userId to req.user.id ---
    });

    if (!document) {
      return res
        .status(404)
        .json({ message: "Document not found or you do not have permission." });
    }

    // Get original PDF path
    const originalPdfPath = path.join(__dirname, "..", document.filePath);
    if (!fs.existsSync(originalPdfPath)) {
      return res
        .status(404)
        .json({ message: "Original PDF file not found on server." });
    }

    // Load the original PDF
    const existingPdfBytes = fs.readFileSync(originalPdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Get fonts for text annotations
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Iterate through each page of the PDF and apply annotations
    for (let i = 0; i < pdfDoc.getPages().length; i++) {
      const page = pdfDoc.getPages()[i];
      // Filter annotations for the current page (1-indexed in PDF, 0-indexed in array)
      const pageNumberForAnnotations = i + 1;
      const annotationsOnPage = document.annotations.filter(
        (ann) => ann.page === pageNumberForAnnotations
      );

      for (const annotation of annotationsOnPage) {
        // Coordinates need to be adjusted for PDF-Lib (origin bottom-left)
        // Fabric.js: origin top-left. pdf-lib: origin bottom-left.
        // page.getHeight() - (annotation.y + annotation.height) gives y from bottom
        const yFromBottom =
          page.getHeight() - (annotation.y + annotation.height);

        if (
          annotation.type === "text_field" &&
          annotation.objectData &&
          annotation.objectData.text
        ) {
          // For text fields, draw the text directly
          page.drawText(annotation.objectData.text, {
            x: annotation.x,
            y: yFromBottom, // Adjust Y
            font: helveticaFont,
            size: annotation.objectData.fontSize || 16,
            color: rgb(0, 0, 0), // Black color
            // Ensure text fits or wrap/clip if necessary, basic implementation
            maxWidth: annotation.width,
          });
        } else if (
          annotation.type === "placed_signature" &&
          annotation.imageData
        ) {
          // For placed signatures, embed and draw the image
          try {
            // Check for image format to use embedPng or embedJpg
            const mimeType = annotation.imageData.split(":")[1].split(";")[0];
            let image;

            const imageBytes = Buffer.from(
              annotation.imageData.split(",")[1],
              "base64"
            );

            if (mimeType === "image/png") {
              image = await pdfDoc.embedPng(imageBytes);
            } else if (mimeType === "image/jpeg") {
              image = await pdfDoc.embedJpg(imageBytes);
            } else {
              console.warn(
                `Unsupported image format for annotation ${annotation.id}: ${mimeType}`
              );
              continue; // Skip this annotation if format is not supported
            }

            // Calculate actual size of the image on the PDF based on stored fabric object dimensions
            // We saved width/height and scaleX/scaleY from Fabric.js.
            // Use annotation.width and annotation.height directly as they reflect scaled dimensions.
            const imgWidth = annotation.width;
            const imgHeight = annotation.height;

            page.drawImage(image, {
              x: annotation.x,
              y: yFromBottom, // Adjust Y
              width: imgWidth,
              height: imgHeight,
            });
          } catch (imgError) {
            console.log(
              `Error embedding image for annotation ${annotation.id}:`,
              imgError
            );
            // Optionally draw a placeholder or log a warning on the PDF
          }
        }
        // 'signature_field' types that were not filled are ignored,
        // as they are just placeholders and not actual content to flatten.
      }
    }

    // Save the modified PDF
    const flattenedPdfBytes = await pdfDoc.save();

    // 3. Save the flattened PDF to a new file
    const newFileName = `finalized_${document.fileName}`;
    const newFilePath = path.join("uploads", newFileName);
    const absoluteNewFilePath = path.join(__dirname, "..", newFilePath);

    fs.writeFileSync(absoluteNewFilePath, flattenedPdfBytes);

    // 4. Update the document record in the database
    // You might want to store the path to the finalized document,
    // or mark the original document as finalized and prevent further edits.
    document.finalizedPath = "/" + newFilePath; // Add a new field to your Document model
    document.isFinalized = true; // Add a new boolean field to your Document model
    await document.save();

    res.status(200).json({
      message: "Document finalized successfully!",
      finalizedUrl: `http://localhost:5000/${newFilePath}`,
      documentId: document._id,
    });
  } catch (error) {
    console.log("Error finalizing document:", error);
    res
      .status(500)
      .json({ message: "Server error during document finalization." });
  }
});

router.delete("/:documentId", verifyToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    // Find the document by ID and owner to ensure authorization
    const document = await Document.findOne({
      _id: documentId,
      owner: req.user.id, // --- FIXED: Changed from req.user.userId to req.user.id ---
    });

    if (!document) {
      return res
        .status(404)
        .json({ message: "Document not found or you do not have permission." });
    }

    // 1. Delete original PDF file
    const originalPdfPath = path.join(__dirname, "..", document.filePath);
    if (fs.existsSync(originalPdfPath)) {
      fs.unlinkSync(originalPdfPath);
      console.log(`Deleted original file: ${originalPdfPath}`);
    }

    // 2. Delete finalized PDF file if it exists
    if (document.finalizedPath) {
      const finalizedPdfPath = path.join(
        __dirname,
        "..",
        document.finalizedPath
      );
      if (fs.existsSync(finalizedPdfPath)) {
        fs.unlinkSync(finalizedPdfPath);
        console.log(`Deleted finalized file: ${finalizedPdfPath}`);
      }
    }

    // 3. Delete the document record from the database
    await Document.deleteOne({ _id: documentId });

    res.status(200).json({ message: "Document deleted successfully." });
  } catch (error) {
    console.log("Error deleting document:", error);
    res.status(500).json({ message: "Server error during document deletion." });
  }
});

router.post("/:documentId/share", verifyToken, async (req, res) => {
  const { documentId } = req.params;
  const { recipientEmail } = req.body; // The email to share with

  if (!recipientEmail) {
    return res
      .status(400)
      .json({ message: "Recipient email is required for sharing." });
  }

  try {
    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ message: "Document not found." });
    }

    // Ensure only the owner can share their document
    if (document.owner.toString() !== req.user.id) {
      // --- FIXED: Changed from req.user.userId to req.user.id ---
      return res
        .status(403)
        .json({ message: "Not authorized to share this document." });
    }

    // Generate a simple unique token (for now, a UUID or more robust token is better)
    // For production, consider a more cryptographically secure token generation.
    const shareToken = require("crypto").randomBytes(32).toString("hex");

    // Set expiration (e.g., 7 days from now)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    document.shareToken = shareToken;
    document.sharedWith = recipientEmail;
    document.shareExpiresAt = sevenDaysFromNow;
    await document.save();

    // Construct the shareable URL for the frontend
    // IMPORTANT: Ensure FRONTEND_URL is set in your .env file
    const shareableUrl = `${process.env.FRONTEND_URL}/sign/${shareToken}`;

    res.json({
      message: "Document prepared for sharing.",
      shareableUrl: shareableUrl,
      token: shareToken,
      expiresAt: document.shareExpiresAt,
    });
  } catch (error) {
    console.log("Error preparing document for sharing:", error);
    res
      .status(500)
      .json({ message: "Server error preparing document for sharing." });
  }
});

module.exports = router;
