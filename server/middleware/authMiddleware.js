// document-signature-app/server/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

// Middleware to protect routes
module.exports = function (req, res, next) {

  const token = req.header("Authorization");
  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  // Check if token starts with 'Bearer ' and extract it
  if (!token.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: 'Token format is incorrect, must be "Bearer <token>"' });
  }

  const tokenString = token.split(" ")[1]; // Get the actual token string

  // Verify token
  try {
    const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
    req.user = decoded.user; // Attach the decoded user payload to the request object
    next(); // Proceed to the next middleware/route handler
  } catch (err) {
    // Token is not valid (e.g., expired, malformed)
    res.status(401).json({ message: "Token is not valid" });
  }
};
