const express = require('express');
const User = require('../models/user');
const router = express.Router();

router.post('/register', async (req, res) => {
    try { 
        const { username, email, password } = req.body;

        // check if user exists
        let user = await User.findOne({ email });
        if (user) { 
            return res.status(400).json({ message: 'User already exists' });
        }

        // create user and save to database
        user = new User({ username, email, password });
        await user.save();

        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        res.status(500).json({ message: err})
    }  
});

module.exports = router;