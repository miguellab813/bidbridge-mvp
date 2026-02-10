// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serves your HTML file

// --- MOCK DATABASE (For Demo Purposes) ---
// In production, you would replace these with 'pg' database queries
const projects = [];

// --- API ROUTES ---

// 1. AI Image Generation (Mocked for safety if no Key provided)
app.post('/api/ai/generate', async (req, res) => {
    const { prompt } = req.body;
    
    if (process.env.OPENAI_API_KEY) {
        // Real API Call code would go here
        // For the demo deployment, we return a success with a placeholder
        res.json({ 
            success: true, 
            imageUrl: "https://source.unsplash.com/featured/?construction,modern," + encodeURIComponent(prompt.split(' ')[0]) 
        });
    } else {
        // Fallback if you haven't set up the key yet
        res.json({ 
            success: true, 
            imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1000&auto=format&fit=crop" 
        });
    }
});

// 2. Stripe Payment Intent (Mocked)
app.post('/api/pay/create-intent', (req, res) => {
    res.json({ clientSecret: "mock_secret_12345" });
});

// 3. Serve the Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`BidBridge Server running on port ${PORT}`);
});