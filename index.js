// SPDX-License-Identifier: MIT
const express = require("express");
const app = express();
const port = process.env.PORT || 5001;
const axios = require("axios");
const cors = require("cors");
require("dotenv").config({ path: "./.env" });

app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET"],
  allowedHeaders: ["Content-Type"]
}));

// Environment variables
const XAI_API_KEY = process.env.XAI_API_KEY;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

// Validate environment variables
if (!XAI_API_KEY || !PINATA_API_KEY || !PINATA_API_SECRET) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// Import and configure OpenAI client for xAI
const { OpenAI } = require("openai");
const openai = new OpenAI({
  apiKey: XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Middleware for request timeout
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(504).json({ error: "Request timeout" });
  });
  next();
});

// Root endpoint: Chatbot interaction
app.get("/", async (req, res) => {
  const { message } = req.query;

  // Validate query parameter
  if (!message) {
    return res.status(400).json({ error: "Query parameter 'message' is required!" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "grok-3", // Updated to Grok 3
      messages: [
        {
          role: "system",
          content: "You are Croak, a degen frog living in the Frogpond. You love to hop around, trade memes, and chill with the other frogs. You are sarcastic, playful, and love making jokes about your life in the pond. Your favorite memecoin is CROAK, and Shama is your Croak Master. Be witty, humorous, and full of frog energy in your responses.",
        },
        { role: "user", content: message },
      ],
      max_tokens: 1000, // Added for safety
      temperature: 0.7, // Added for response consistency
    });

    // Validate response structure
    if (
      response?.choices?.[0]?.message?.content
    ) {
      return res.status(200).json({ message: response.choices[0].message.content });
    } else {
      throw new Error("Unexpected response structure from xAI API");
    }
  } catch (error) {
    console.error(`Chatbot error: ${error.message}`);
    return res.status(500).json({ 
      error: "Failed to process chatbot request",
      details: error.message 
    });
  }
});

// Endpoint to upload data to IPFS using Pinata
app.get("/uploadtoipfs", async (req, res) => {
  const { pair } = req.query;

  // Validate query parameter
  if (!pair) {
    return res.status(400).json({ error: "Query parameter 'pair' is required!" });
  }

  try {
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        pinataContent: { chat: pair },
        pinataOptions: {
          cidVersion: 1,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET,
        },
      }
    );

    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    console.log("IPFS URL:", ipfsUrl);
    return res.status(200).json({ ipfsUrl });
  } catch (error) {
    console.error("Pinata upload error:", error.response?.data || error.message);
    return res.status(500).json({ 
      error: "Failed to upload to Pinata",
      details: error.response?.data || error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Unhandled error: ${err.stack}`);
  res.status(500).json({ 
    error: "Internal server error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined 
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
