
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

console.log('Attempting to connect to MongoDB. MONGODB_URI from environment:', MONGODB_URI ? "****** (set)" : MONGODB_URI); // Added console.log for debugging

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env or .env.local'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    // console.log('Using cached MongoDB connection.');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    // console.log('Creating new MongoDB connection promise.');
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      // console.log('MongoDB connection promise resolved.');
      return mongooseInstance;
    });
  }
  try {
    // console.log('Awaiting MongoDB connection promise.');
    cached.conn = await cached.promise;
    // console.log('MongoDB connected successfully.');
  } catch (e) {
    // console.error('MongoDB connection error:', e);
    cached.promise = null;
    throw e;
  }
  
  return cached.conn;
}

export default dbConnect;
