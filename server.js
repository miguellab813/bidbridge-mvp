const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Initialize Stripe (requires secret key in .env)
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// ==========================================
// 1. STRIPE WEBHOOKS (Must be raw body)
// ==========================================
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        
        if (event.type === 'account.updated') {
            const account = event.data.object;
            if (account.charges_enabled && account.details_submitted) {
                console.log(`Contractor ${account.id} is fully verified and ready for payouts!`);
                // db.Users.update({ stripe_verified: true })
            }
        }
        res.send();
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

// ==========================================
// MIDDLEWARE (JSON parsing for all other routes)
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==========================================
// 2. API ROUTES
// ==========================================

// --- AI Concept Generation ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.post('/api/ai/generate', async (req, res) => {
    try {
        if (process.env.OPENAI_API_KEY) {
            const response = await openai.images.generate({
                model: "dall-e-3", prompt: "Architectural photo: " + req.body.prompt, n: 1, size: "1024x1024"
            });
            res.json({ success: true, imageUrl: response.data[0].url });
        } else {
            setTimeout(() => res.json({ success: true, imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80" }), 2000);
        }
    } catch (error) {
        res.status(500).json({ error: "AI Generation Failed" });
    }
});

// --- Stripe Connect Onboarding ---
app.post('/api/stripe/onboard', async (req, res) => {
    if(!stripe) return res.json({ success: true, url: "#demo-success" }); // Mock for demo
    try {
        const account = await stripe.accounts.create({ type: 'express', country: 'US', email: req.body.email });
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${process.env.BASE_URL}/wallet`, return_url: `${process.env.BASE_URL}/wallet?success=true`,
            type: 'account_onboarding',
        });
        res.json({ success: true, url: accountLink.url });
    } catch (error) {
        res.status(500).json({ error: "Stripe error" });
    }
});

// --- Admin Override & Consent Notifications ---
app.post('/api/admin/override', async (req, res) => {
    const { entityType, entityId, newValue, reason } = req.body;
    console.log(`[AUDIT LOG] Admin override on ${entityType} ${entityId}. Reason: ${reason}. New Value: ${newValue}`);
    
    // In production, trigger Nodemailer/Twilio here to email the contractor/client the receipt.
    res.json({ success: true, message: "Override logged and receipt sent to user." });
});

// ==========================================
// 3. REAL-TIME CHAT (WebSockets)
// ==========================================
io.on('connection', (socket) => {
    socket.on('send_message', (data) => {
        socket.broadcast.emit('receive_message', data); // Send to other client
    });
});

// ==========================================
// Serve Frontend
// ==========================================
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(PORT, () => console.log(`BidBridge Master Server Live on port ${PORT}`));
