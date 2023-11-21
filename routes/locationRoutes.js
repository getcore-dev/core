// routes/location.js
const express = require("express");
const router = express.Router();
const Location = require("../models/location");

// Route to create a new location
router.post("/add-location", async (req, res) => {
  try {
    const newLocation = await Location.create(req.body);
    res.status(201).json(newLocation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
