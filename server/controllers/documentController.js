// document-signature-app/server/controllers/documentController.js
const multer = require("multer"); // Multer for handling file uploads
const path = require("path"); // Node.js path module for path manipulation
const Document = require("../models/Document"); // <--- IMPORTANT: Import the Document model here!

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 'uploads/' is the directory where files will be stored
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    // Generate a unique filename: fieldname-timestamp.ext
    // e.g., 'document-1678888888888.pdf'
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// Initialize Multer upload middleware
// 'document' is the name of the field in the form data that holds the file
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  fileFilter: function (req, file, cb) {
    // Only allow PDF files
    const filetypes = /pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb("Error: Only PDF files are allowed!");
    }
  },
}).single("document"); // '.single('document')' means it expects a single file upload with field name 'document'

// @desc    Upload a new document
// @route   POST /api/documents/upload
// @access  Private (now protected by auth middleware)
exports.uploadDocument = (req, res) => {
  upload(req, res, async (err) => {
    // <--- IMPORTANT: Added 'async' here
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      return res.status(400).json({ message: `Multer error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred when uploading.
      return res.status(500).json({ message: err.message });
    }

    // If no file was provided
    if (!req.file) {
      return res.status(400).json({ message: "No file selected for upload." });
    }

    // File uploaded successfully, now save document metadata to DB
    const { originalname, filename, path: localFilePath } = req.file; // Destructure properties from req.file
    const userId = req.user.id; // Get user ID from the authenticated request (provided by auth middleware)

    try {
      const newDocument = new Document({
        user: userId,
        fileName: filename,
        originalName: originalname,
        filePath: `/uploads/${filename}`, // Store public URL path
      });

      await newDocument.save(); // Save the document record to MongoDB

      res.status(201).json({
        // Changed status to 201 for resource created
        message: "File uploaded and record saved successfully!",
        fileName: newDocument.fileName,
        originalName: newDocument.originalName,
        filePath: newDocument.filePath,
        documentId: newDocument._id, // Return the document ID from DB
      });
    } catch (dbErr) {
      console.log("Error saving document to database:", dbErr.message);
      // In a production app, you might want to delete the uploaded file from 'uploads/'
      // if the database save fails, to prevent orphaned files. (Requires 'fs' module)
      // Example: fs.unlinkSync(localFilePath);
      return res
        .status(500)
        .json({ message: "Failed to save document record to database." });
    }
  });
};

// @desc    Get all annotations for a specific document
// @route   GET /api/documents/:id/annotations
// @access  Private
exports.getDocumentAnnotations = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Ensure only the owner can access their document's annotations
    if (document.user.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ message: "Not authorized to access this document" });
    }

    res.status(200).json(document.annotations || []); // Return annotations or an empty array
  } catch (error) {
    console.log("Error fetching document annotations:", error.message);
    res.status(500).json({ message: "Server error fetching annotations" });
  }
};

// @desc    Save annotations for a specific document
// @route   POST /api/documents/:id/annotations
// @access  Private
exports.saveDocumentAnnotations = async (req, res) => {
  const { annotations } = req.body; // Expecting an array of annotation objects

  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Ensure only the owner can modify their document's annotations
    if (document.user.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ message: "Not authorized to modify this document" });
    }

    // Replace existing annotations with the new array
    document.annotations = annotations;
    await document.save();

    res.status(200).json({
      message: "Annotations saved successfully!",
      annotations: document.annotations,
    });
  } catch (error) {
    console.log("Error saving document annotations:", error.message);
    res.status(500).json({ message: "Server error saving annotations" });
  }
};
