// document-signature-app/server/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path"); // NEW: Import path module

// Import routes
const publicRoutes = require("./routes/publicRoutes");
const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware for logging incoming requests (Re-added for debugging visibility)
app.use((req, res, next) => {
  console.log(`[INCOMING REQUEST] Method: ${req.method}, URL: ${req.url}`);
  next();
});

// Configure CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
  })
);

// Body parser for JSON
app.use(express.json());

// Serve static files from the 'uploads' directory (More robust path)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Simple root route
app.get("/", (req, res) => {
  res.send("Document Signature App Backend API is running!");
});

// Use routes
app.use("/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/docs", documentRoutes);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully!"))
  .catch((err) => console.log("MongoDB connection error:", err)); // Use console.log for errors

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`To access, open your browser to: http://localhost:${PORT}`);
});
