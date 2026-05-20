/**
 * MongoDB Connection Utility
 *
 * Connects to MongoDB using MONGODB_URI from environment variables.
 *
 * Connection priority:
 * 1. Read URI from /tmp/mongodb-memory-uri.txt (set by mini-services/mongodb-service)
 * 2. Use MONGODB_URI from environment variables
 * 3. Fall back to starting an in-memory MongoDB (for development only)
 *
 * In production (Vercel): set MONGODB_URI to your MongoDB Atlas URI
 * In local dev: the mini-service provides a persistent in-memory MongoDB
 */

import mongoose from 'mongoose'
import { readFileSync, existsSync } from 'fs'

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
 * Get the MongoDB URI to use.
 * Priority: mini-service file > env var > in-memory fallback
 */
async function getMongoURI(): Promise<{ uri: string; isAtlas: boolean }> {
  // 1. Check if the mini-service has written a URI file
  const URI_FILE = '/tmp/mongodb-memory-uri.txt'
  if (existsSync(URI_FILE)) {
    try {
      const fileUri = readFileSync(URI_FILE, 'utf-8').trim()
      if (fileUri && fileUri.startsWith('mongodb://')) {
        // Ensure the database name is included
        const uri = fileUri.includes('/team-task-manager')
          ? fileUri
          : fileUri.replace(/\/?$/, '/team-task-manager')
        console.log(`📋 Using MongoDB URI from mini-service: ${uri.replace(/\/\/[^@]+@/, '//***@')}`)
        return { uri, isAtlas: false }
      }
    } catch {
      // Ignore file read errors
    }
  }

  // 2. Check environment variable
  const envUri = process.env.MONGODB_URI
  if (envUri && !hasPlaceholder(envUri)) {
    return { uri: envUri, isAtlas: envUri.includes('mongodb+srv') }
  }

  if (envUri && hasPlaceholder(envUri)) {
    console.log('⚠️ MONGODB_URI contains <db_password> placeholder — using in-memory MongoDB')
  } else {
    console.log('⚠️ MONGODB_URI not set — using in-memory MongoDB')
  }

  // 3. Start in-memory MongoDB as fallback
  const uri = await ensureInMemoryMongo()
  return { uri, isAtlas: false }
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
  const { uri, isAtlas } = await getMongoURI()

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
    console.log(`✅ MongoDB connected (${isAtlas ? 'Atlas' : 'local'}, db: ${dbName})`)
    return instance.connection
  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ MongoDB connection failed:', err.message)

    // If connection failed and we have a stale URI file, try in-memory fallback
    if (!isAtlas) {
      console.log('🔄 Trying in-memory MongoDB fallback...')
      try {
        const fallbackUri = await ensureInMemoryMongo()
        const instance = await mongoose.connect(fallbackUri, {
          bufferCommands: false,
          maxPoolSize: 10,
          minPoolSize: 1,
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        })
        console.log('✅ Connected to in-memory MongoDB (fallback)')
        return instance.connection
      } catch {
        // Throw original error
      }
    }

    throw error
  }
}

export default connectDB
