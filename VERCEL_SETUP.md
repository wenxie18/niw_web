# Vercel Deployment Setup

## Required Environment Variables

Set these in your Vercel dashboard under Settings > Environment Variables:

### Database
- `POSTGRES_URL` - Your Neon PostgreSQL connection string

### Stripe (for payments)
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key

### Authentication
- `JWT_SECRET` - Random secret for JWT tokens (generate a strong random string)
- `SESSION_SECRET` - Random secret for sessions (generate a strong random string)

### Optional Configuration
- `SHOW_EVALUATION` - Set to "true" to show the Free Evaluation button
- `NODE_ENV` - Set to "production" (automatically set by Vercel)

## Testing the Deployment

1. **Health Check**: Visit `https://your-app.vercel.app/api/health`
   - Should show `vercel: true` and `environment: production`

2. **Static Files**: Check that CSS and JS load properly
   - `https://your-app.vercel.app/styles.css`
   - `https://your-app.vercel.app/script.js`

3. **Rate Limiting**: Should work without 429 errors
   - Multiple API calls should not be blocked

## Recent Fixes Applied

✅ **Rate Limiting**: Made Vercel-compatible with proper proxy trust
✅ **Static Files**: Added proper MIME types and caching
✅ **Error Handling**: Added try-catch blocks for file serving
✅ **Security Headers**: Added production-specific security headers
✅ **Environment Detection**: Proper Vercel environment detection

## Troubleshooting

If you see issues:
1. Check the Vercel function logs
2. Verify all environment variables are set
3. Test the health endpoint first
4. Check that static files are being served correctly
