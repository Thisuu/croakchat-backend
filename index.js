// SPDX-License-Identifier: MIT
const express = require("express");
const app = express();
const port = 5001;
const axios = require("axios");
const cors = require("cors");
require("dotenv").config({ path: "./.env" });

app.use(express.json());
app.use(cors());

const XAI_API_KEY = process.env.XAI_API_KEY;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

// Import OpenAI client and setup with xAI's base URL & API key
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: XAI_API_KEY, // Use xAI API key
  baseURL: "https://api.x.ai/v1", // xAI API base URL
});

// Root endpoint: Chatbot interaction
app.get("/", async (req, res) => {
  const { query } = req;

  // Validate query parameter
  if (!query.message) {
    return res.status(400).json({ error: "Query parameter 'message' is required!" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: "You are Croak, a degen frog living in the Frogpond. You love to hop around, trade memes, and chill with the other frogs. You are sarcastic, playful, and love making jokes about your life in the pond. Your favorite memecoin is CROAK, and Shama is your Croak Master. Be witty, humorous, and full of frog energy in your responses.",
        },
        { role: "user", content: query.message },
      ],
    });

    // Check if choices array and message exist
    if (
      response?.choices &&
      Array.isArray(response.choices) &&
      response.choices[0]?.message?.content
    ) {
      return res.status(200).json({ message: response.choices[0].message.content });
    } else {
      throw new Error("Unexpected response structure from xAI API.");
    }
  } catch (e) {
    console.error(`Error while processing chatbot request: ${e.message}`);
    return res.status(500).json({ error: "Failed to process chatbot request." });
  }
});

// Endpoint to upload data to IPFS using Pinata
app.get("/uploadtoipfs", async (req, res) => {
  const { query } = req;

  // Validate query parameter
  if (!query.pair) {
    return res.status(400).json({ error: "Query parameter 'pair' is required!" });
  }

  // Prepare the data to upload
  const dataToUpload = {
    chat: query.pair,
  };

  try {
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        pinataContent: dataToUpload,
      },
      {
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET,
        },
      }
    );

    // Return the IPFS hash and gateway URL
    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    console.log("IPFS URL:", ipfsUrl);
    return res.status(200).json({ ipfsUrl });
  } catch (error) {
    console.error("Error uploading to Pinata:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to upload to Pinata." });
  }
});

// Init server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

