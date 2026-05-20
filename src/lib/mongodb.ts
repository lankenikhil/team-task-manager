/**
 * MongoDB Connection Utility
 *
 * Cached database connection for serverless environments (Vercel).
 * Reuses the existing connection across serverless function invocations
 * to prevent exhausting the MongoDB connection pool.
 *
 * In development (non-production), we use a global variable to cache the connection
 * so it survives hot module reloads. In production (serverless), each function
 * invocation gets its own module scope, but the connection is still cached
 * within that invocation's lifecycle.
 */

import mongoose from 'mongoose'

// Global type extension for caching Mongoose connection in development
declare global {
  var mongoose: {
    conn: mongoose.Connection | null
    promise: Promise<mongoose.Connection> | null
  } | undefined
}

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env or your Vercel project settings.'
  )
}

/**
 * Cached connection object — persists across hot reloads in development.
 * In serverless (production), this is re-initialized per cold start,
 * but reused within the same invocation.
 */
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

/**
 * Establishes a MongoDB connection or returns the existing cached connection.
 * This function is safe to call repeatedly — it will only create one connection.
 *
 * @returns {Promise<mongoose.Connection>} The active Mongoose connection
 */
async function connectDB(): Promise<mongoose.Connection> {
  // If we already have a connection, return it immediately
  if (cached!.conn) {
    return cached!.conn
  }

  // If no connection promise exists, create one
  if (!cached!.promise) {
    const opts: mongoose.ConnectOptions = {
      // Buffer commands until connection is ready (prevents errors on cold start)
      bufferCommands: true,
      // Maximum number of sockets the driver will keep open per host
      maxPoolSize: 10,
      // Minimum number of sockets the driver will keep open per host
      minPoolSize: 2,
      // Timeout for initial connection
      serverSelectionTimeoutMS: 10000,
      // Timeout for socket operations
      socketTimeoutMS: 45000,
    }

    cached!.promise = mongoose
      .connect(MONGODB_URI!, opts)
      .then((mongoose) => {
        console.log('✅ MongoDB connected successfully')
        return mongoose.connection
      })
      .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message || error)
        // Reset the promise so the next attempt can try again
        cached!.promise = null
        throw error
      })
  }

  try {
    cached!.conn = await cached!.promise
  } catch (error) {
    // Reset the cached promise on error so retry is possible
    cached!.promise = null
    throw error
  }

  return cached!.conn
}

export default connectDB
