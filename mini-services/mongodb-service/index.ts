/**
 * MongoDB Memory Server - Mini Service
 *
 * Starts an in-memory MongoDB instance and writes the connection URI
 * to a file so the main Next.js app can read it.
 *
 * Port: 3031 (HTTP status server)
 */

import { MongoMemoryServer } from 'mongodb-memory-server'
import { writeFileSync, existsSync, unlinkSync } from 'fs'
import { createServer } from 'http'

const URI_FILE = '/tmp/mongodb-memory-uri.txt'
const PORT = 3031

async function main() {
  console.log('📦 Starting MongoDB Memory Server...')

  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'team-task-manager',
    },
  })

  const uri = mongod.getUri()
  console.log(`✅ MongoDB Memory Server running at: ${uri}`)

  // Write URI to file for the main app to read
  writeFileSync(URI_FILE, uri)
  console.log(`📝 URI saved to ${URI_FILE}`)

  // Simple HTTP server for health checks
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', uri }))
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  server.listen(PORT, () => {
    console.log(`🏥 Health check server at http://localhost:${PORT}/health`)
  })

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...')
    await mongod.stop()
    if (existsSync(URI_FILE)) unlinkSync(URI_FILE)
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await mongod.stop()
    if (existsSync(URI_FILE)) unlinkSync(URI_FILE)
    process.exit(0)
  })
}

main().catch((error) => {
  console.error('❌ Failed to start MongoDB:', error)
  process.exit(1)
})
