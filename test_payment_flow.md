# Payment Flow Test Guide

## How Payment Confirmation Works

### Step-by-Step Flow:

1. **User Login** → Creates session with `paid: false`
2. **Click "Pay $1,599"** → Redirects to Stripe Checkout
3. **Complete Payment** → Stripe redirects back with session ID
4. **Server Verification** → Checks with Stripe if payment succeeded
5. **Database Update** → Sets `paid = 1` for user's email
6. **UI Unlock** → Survey button becomes enabled

### Security Features:

- **Server-side verification**: We don't trust the frontend, we ask Stripe directly
- **Email matching**: Payment is only applied to the logged-in user's email
- **Session updates**: User's session is immediately updated
- **Database persistence**: Payment status survives server restarts

### Test the Flow:

1. **Go to**: http://localhost:3000/account
2. **Create account**: Use any email/password
3. **Click "Pay $1,599"**: Should redirect to Stripe
4. **Use test card**: `4242 4242 4242 4242` (any future date, any CVC)
5. **Complete payment**: Should redirect back to account page
6. **Check result**: Survey button should be enabled

### What Happens Behind the Scenes:

```
User clicks "Pay" 
    ↓
Frontend: POST /api/create-checkout-session
    ↓
Server: Creates Stripe session with user's email
    ↓
Stripe: Processes payment
    ↓
Stripe: Redirects to /account?success=1&session_id=cs_xxx
    ↓
Frontend: Detects success URL parameters
    ↓
Frontend: GET /api/checkout/confirm?session_id=cs_xxx
    ↓
Server: Asks Stripe "Is this session paid?"
    ↓
Stripe: "Yes, payment_status = 'paid'"
    ↓
Server: UPDATE users SET paid = 1 WHERE email = user@example.com
    ↓
Server: Updates session user.paid = true
    ↓
Frontend: Calls refreshUI() → Survey unlocked!
```

### Debugging:

If payment doesn't unlock the survey:
1. Check browser console for errors
2. Check server logs for Stripe errors
3. Verify config.js has correct Stripe keys
4. Test with different Stripe test cards
