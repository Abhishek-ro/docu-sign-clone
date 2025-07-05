// server/routes/signatureRoutes.js
const express = require('express');
const router = express.Router();
const signatureController = require('../controllers/signatureController');
const auth = require('../middleware/auth'); // Assuming you have an auth middleware

// Route to save signature position (from Day 6) - if not already here
router.post('/', auth, signatureController.saveSignaturePosition);

// New route for Day 8: Finalize the signature on the PDF
router.post('/finalize', auth, signatureController.finalizeSignature);

// Route to get signatures for a document (from Day 6) - if not already here
router.get('/:documentId', auth, signatureController.getSignaturesForDocument);


module.exports = router;