// document-signature-app/server/controllers/authController.js
const User = require("../models/User"); // Import the User model
const bcrypt = require("bcryptjs"); // For password hashing
const jwt = require("jsonwebtoken"); // For generating JWTs

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body; // Destructure data from request body

  try {
    // 1. Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    // 2. Create new user instance
    user = new User({
      name,
      email,
      password, // Password will be hashed before saving
    });

    // 3. Hash password
    const salt = await bcrypt.genSalt(10); // Generate a salt (random string)
    user.password = await bcrypt.hash(password, salt); // Hash the user's password

    // 4. Save user to database
    await user.save();

    // 5. Generate JWT token for immediate login after registration
    const payload = {
      user: {
        id: user.id, // Mongoose creates an 'id' virtual getter for '_id'
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Your secret key from .env
      { expiresIn: "1h" }, // Token expires in 1 hour
      (err, token) => {
        if (err) throw err; // Handle JWT signing errors
        res
          .status(201)
          .json({ message: "User registered successfully", token });
      }
    );
  } catch (err) {
    console.log(err.message); // Log full error for debugging
    res.status(500).send("Server error during registration"); // Generic error message to client
  }
};

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
  const { email, password } = req.body; // Destructure data from request body

  try {
    // 1. Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      // Return same generic message as password mismatch for security
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3. Generate JWT token for login
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
      (err, token) => {
        if (err) throw err;
        res.json({ message: "Logged in successfully", token }); // 200 OK by default
      }
    );
  } catch (err) {
    console.log(err.message);
    res.status(500).send("Server error during login");
  }
};
