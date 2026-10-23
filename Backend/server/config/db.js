import mongoose from "mongoose";
import dns from "dns";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// On Windows local development, local ISP DNS often blocks SRV queries for MongoDB Atlas clusters.
// Only apply custom DNS on Windows to avoid breaking Linux container networking on Render.
if (process.platform === "win32") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (_) {}
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../.env") });
config({ path: path.join(__dirname, "../.env") });

mongoose.set("bufferCommands", false);

let lastMongoError = null;

export const getMongoStatus = () => {
  if (mongoose.connection.readyState === 1) {
    return { status: "ok", message: "Connected to MongoDB" };
  }
  return {
    status: "unavailable",
    reason: lastMongoError || (!process.env.MONGO_URI ? "MONGO_URI not configured in environment" : "Connecting to MongoDB...")
  };
};

const parseMongoError = (err, uri) => {
  const msg = err?.message || String(err);
  if (!uri || uri.includes("127.0.0.1") || uri.includes("localhost")) {
    return "No MONGO_URI provided in environment (defaulted to localhost:27017 which is unavailable on cloud)";
  }
  if (msg.includes("bad auth") || msg.includes("Authentication failed") || msg.includes("auth failed")) {
    return "MongoDB Atlas Authentication Failed: Check username and password in MONGO_URI (ensure no unescaped special characters or <> brackets)";
  }
  if (msg.includes("whitelist") || msg.includes("Could not connect to any servers") || err.name === "MongooseServerSelectionError") {
    return "MongoDB Atlas IP Whitelist Block: Render IP not allowed. In MongoDB Atlas, go to Network Access -> Add IP Address -> Add '0.0.0.0/0' (Allow Access from Anywhere)";
  }
  if (msg.includes("ENOTFOUND") || msg.includes("ESERVFAIL") || msg.includes("querySrv")) {
    return "DNS SRV Lookup Failed: Could not resolve MongoDB Atlas hostname. Check MONGO_URI cluster domain";
  }
  if (msg.includes("ETIMEDOUT") || msg.includes("timeout")) {
    return "Connection Timeout: MongoDB Atlas cluster took too long to respond. Check if cluster is paused or network access is blocked";
  }
  return `MongoDB Connection Error: ${msg}`;
};

const connectDB = async (retryCount = 0) => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    lastMongoError = "MONGO_URI environment variable is not set. Running with memory store.";
    console.warn("⚠️  [MongoDB] " + lastMongoError);
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
    });
    lastMongoError = null;
    console.log(`✅ [MongoDB] Connected: ${conn.connection.host}`);
  } catch (err) {
    const reason = parseMongoError(err, uri);
    lastMongoError = reason;
    console.error(`❌ [MongoDB] Connection failed: ${err.message}`);
    console.warn(`⚠️  [MongoDB Diagnosis] ${reason}`);
    console.warn("⚠️  Running with in-memory persistence fallback.");

    // Retry up to 5 times with backoff if not an auth error
    if (retryCount < 5 && !err.message.includes("bad auth")) {
      const delay = Math.min(30000, (retryCount + 1) * 5000);
      console.log(`[MongoDB] Scheduling retry ${retryCount + 1}/5 in ${delay / 1000}s...`);
      setTimeout(() => connectDB(retryCount + 1), delay);
    }
  }
};

export default connectDB;
