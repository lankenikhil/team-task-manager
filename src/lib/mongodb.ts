/**
 * MongoDB Connection Utility
 *
 * Connects to MongoDB using MONGODB_URI from environment variables.
 * Includes automatic in-memory MongoDB startup for local development.
 *
 * In production (Vercel): set MONGODB_URI to your MongoDB Atlas URI
 * In local dev: if MONGODB_URI has a placeholder, auto-starts in-memory MongoDB
 */

import mongoose from 'mongoose'

declare global {
  var mongoose: {
    conn: mongoose.Connection | null
    promise: Promise<mongoose.Connection> | null
  } | undefined
  var __mongoMemoryServer: unknown
}

let cached = global.mongoose
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

function hasPlaceholder(uri: string): boolean {
  return uri.includes('<') && uri.includes('>')
}

/**
 * Start an in-memory MongoDB instance.
 * Stores the instance globally so it persists across hot reloads.
 */
async function ensureInMemoryMongo(): Promise<string> {
  if (global.__mongoMemoryServer) {
    try {
      const mongod = global.__mongoMemoryServer as { getUri: () => string }
      return mongod.getUri()
    } catch {
      global.__mongoMemoryServer = undefined
    }
  }

  console.log('📦 Starting in-memory MongoDB...')

  const { MongoMemoryServer } = await import('mongodb-memory-server')
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'team-task-manager' },
  })

  global.__mongoMemoryServer = mongod
  const uri = mongod.getUri()
  console.log(`✅ In-memory MongoDB running at: ${uri}`)
  return uri
}

async function connectDB(): Promise<mongoose.Connection> {
  if (cached!.conn && cached!.conn.readyState === 1) {
    return cached!.conn
  }

  if (!cached!.promise) {
    cached!.promise = establishConnection()
  }

  try {
    cached!.conn = await cached!.promise
  } catch (error) {
    cached!.promise = null
    cached!.conn = null
    throw error
  }

  return cached!.conn
}

async function establishConnection(): Promise<mongoose.Connection> {
  const rawUri = process.env.MONGODB_URI
  let uri = rawUri
  let isAtlas = true

  if (!uri || hasPlaceholder(uri)) {
    if (uri && hasPlaceholder(uri)) {
      console.log('⚠️ MONGODB_URI contains <db_password> placeholder — using in-memory MongoDB')
    } else {
      console.log('⚠️ MONGODB_URI not set — using in-memory MongoDB')
    }
    uri = await ensureInMemoryMongo()
    isAtlas = false
  }

  const masked = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
  console.log(`🔗 Connecting to MongoDB: ${masked}`)

  try {
    const instance = await mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    })

    const dbName = instance.connection.db?.databaseName || 'unknown'
    console.log(`✅ MongoDB connected (${isAtlas ? 'Atlas' : 'in-memory'}, db: ${dbName})`)
    return instance.connection
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ MongoDB connection failed:', err.message)

    // If Atlas failed, try in-memory fallback
    if (isAtlas) {
      console.log('🔄 Atlas unreachable, trying in-memory MongoDB...')
      try {
        const fallbackUri = await ensureInMemoryMongo()
        const instance = await mongoose.connect(fallbackUri, {
          bufferCommands: false,
          maxPoolSize: 10,
          minPoolSize: 1,
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        })
        console.log('✅ Connected to in-memory MongoDB (Atlas fallback)')
        return instance.connection
      } catch {
        // Throw original Atlas error
      }
    }

    throw error
  }
}

export default connectDB
