# Migration Guide: SQLite → Vercel + Neon PostgreSQL

## ✅ What's Already Done:
- ✅ Installed PostgreSQL packages (`pg`, `@vercel/postgres`)
- ✅ Created `database.js` with PostgreSQL connection
- ✅ Updated `server.js` to use PostgreSQL instead of SQLite
- ✅ Created migration script

## 🚀 Next Steps (5 minutes):

### Step 1: Set Up Neon Database
1. Go to [neon.tech](https://neon.tech)
2. Sign up and create a new project
3. Copy the connection string (looks like: `postgres://user:password@host:port/database`)

### Step 2: Add Environment Variable to Vercel
1. Go to your Vercel project dashboard
2. Click "Settings" → "Environment Variables"
3. Add new variable:
   - **Name:** `DATABASE_URL`
   - **Value:** Your Neon connection string
   - **Environment:** Production, Preview, Development

### Step 3: Deploy to Vercel
```bash
git add .
git commit -m "Migrate from SQLite to PostgreSQL for Vercel"
git push origin main
```

## 🔧 Local Development Setup:
1. Create `.env.local` file:
```bash
DATABASE_URL=your_neon_connection_string_here
NODE_ENV=development
```

2. Install dotenv:
```bash
npm install dotenv
```

3. Add to top of `server.js`:
```javascript
require('dotenv').config();
```

## 🎯 Benefits After Migration:
- ✅ **Login will work on Vercel** (no more timeouts)
- ✅ **Data persists** between deployments
- ✅ **10GB free storage** (16,000+ users)
- ✅ **Better performance** with serverless PostgreSQL
- ✅ **Automatic scaling**

## 🚨 Important Notes:
- **Backup your current data** before migration
- **Test locally first** with the new database
- **The old SQLite file** will no longer be used
- **All existing users** will need to re-register (or you can migrate their data)

## 🆘 If Something Goes Wrong:
```bash
git checkout v1.0-before-db-migration
```
This will revert to the working SQLite version.
