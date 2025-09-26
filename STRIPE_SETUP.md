# Stripe Setup Guide

## Step 1: Create Stripe Account

1. Go to https://stripe.com
2. Click "Start now" or "Sign up"
3. Create your account with email and password
4. Verify your email address

## Step 2: Get Test API Keys

1. After logging in, go to https://dashboard.stripe.com/test/apikeys
2. You'll see two keys:
   - **Publishable key** (starts with `pk_test_`) - Safe to use in frontend
   - **Secret key** (starts with `sk_test_`) - Keep this secret, use only in backend

## Step 3: Configure Your App

1. Copy `config.example.js` to `config.js`:
   ```bash
   cp config.example.js config.js
   ```

2. Edit `config.js` and replace the placeholder values:
   ```javascript
   module.exports = {
       STRIPE_SECRET_KEY: 'sk_test_51ABC123...', // Your actual secret key
       STRIPE_PUBLISHABLE_KEY: 'pk_test_51ABC123...', // Your actual publishable key
       // ... other config
   };
   ```

## Step 4: Test Payment Flow

1. Start your server: `npm run dev`
2. Go to http://localhost:3000/account
3. Create an account or sign in
4. Click "Pay $1,599" button
5. Use Stripe test card numbers:
   - **Success**: 4242 4242 4242 4242
   - **Decline**: 4000 0000 0000 0002
   - **Requires authentication**: 4000 0025 0000 3155
   - Use any future expiry date (e.g., 12/34)
   - Use any 3-digit CVC

## Test Card Numbers

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Visa (success) |
| 4000 0000 0000 0002 | Card declined |
| 4000 0025 0000 3155 | Requires authentication |
| 5555 5555 5555 4444 | Mastercard (success) |

## Security Notes

- **NEVER** commit `config.js` to version control
- **NEVER** share your secret key publicly
- The test keys are safe to use in development
- For production, you'll need live keys (starts with `sk_live_` and `pk_live_`)

## What You Need to Share

**DO NOT share these:**
- Secret key (sk_test_...)
- Session secret

**Safe to share:**
- Publishable key (pk_test_...)
- Your Stripe account email (for support)
- Test card numbers (they're public)

## Troubleshooting

- If you get "Stripe not configured" error, check your `config.js` file
- Make sure you're using test keys, not live keys
- Check the server console for error messages
- Verify the secret key starts with `sk_test_`
