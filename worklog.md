---
Task ID: 1
Agent: Main
Task: Complete MongoDB migration - remove all Prisma, replace with Mongoose

Work Log:
- Audited all API routes and lib files for remaining Prisma usage
- Found every API route still imported `db` from `@/lib/db` (Prisma client)
- Installed mongoose and mongodb-memory-server packages
- Rewrote all 8 API route files to use Mongoose models + connectDB()
- Deleted src/lib/db.ts (Prisma client)
- Removed @prisma/client and prisma from package.json dependencies
- Deleted prisma folder (schema.prisma)
- Updated .env to include MONGODB_URI for Atlas
- Updated mongodb.ts to read URI from mini-service file first, then env var, then in-memory fallback
- Fixed User model duplicate index warning (removed redundant index since unique: true creates one)
- Fixed Mongoose deprecation warning (new: true → returnDocument: 'after')
- Added userId field to auth response objects for frontend AuthUser compatibility
- Tested all 13 CRUD operations successfully:
  1. Signup ✅
  2. Login ✅
  3. Fetch current user ✅
  4. Create project ✅
  5. Update project ✅
  6. Create task ✅
  7. Update task status ✅
  8. List tasks ✅
  9. Get project detail ✅
  10. List users ✅
  11. Delete task ✅
  12. Delete project ✅
  13. Logout ✅
- Lint passes with no errors

Stage Summary:
- All Prisma dependencies removed from project
- All API routes fully migrated to Mongoose/MongoDB
- MongoDB connection uses smart fallback: mini-service URI → env var → in-memory MongoDB
- All CRUD operations verified working
- Frontend UI unchanged
- Project is now fully MongoDB Atlas / Mongoose compatible for Vercel deployment
