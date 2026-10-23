import mongoose from "mongoose";
import dns from "dns";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// On Windows, local ISP DNS often blocks SRV queries for mongodb+srv. Use Google/Cloudflare DNS as fallback.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (_) {}

// ESM imports are hoisted — load .env before process.env.MONGO_URI is read.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../.env") });

mongoose.set("bufferCommands", false);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mediaguard",
      { serverSelectionTimeoutMS: 5000 }
    );
    console.log(`✅ [MongoDB] Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ [MongoDB] Connection failed:", err.message);
    if (err.message.includes("whitelist") || err.message.includes("Could not connect to any servers")) {
      console.warn("⚠️  [MongoDB] Atlas Network Access Error: Current IP address is not whitelisted in Atlas Network Access, or cluster is paused.");
    }
    console.warn("⚠️  Running with in-memory persistence fallback.");
  }
};

export default connectDB;
