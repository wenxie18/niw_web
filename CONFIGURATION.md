# Configuration Guide

## Overview

The TurboNIW application uses a centralized configuration system through `config.js`. This allows you to easily manage all application settings from one place.

## Configuration File

The main configuration is in `config.js` (not tracked in git for security). Copy from `config.example.js` to get started.

## Available Settings

### Survey Configuration

```javascript
SURVEY_TYPE: 'full', // Options: 'full' or 'simplified'
SURVEY_TITLE: {
    full: 'Complete NIW Application Survey',
    simplified: 'Simplified NIW Application Survey'
},
SURVEY_DESCRIPTION: {
    full: 'Comprehensive survey covering all aspects of your NIW application',
    simplified: 'Streamlined survey focusing on essential NIW application details'
}
```

**Survey Types:**
- `full`: Complete survey with all fields (149 questions)
- `simplified`: Streamlined survey with essential fields (91 questions)

### Payment Configuration

```javascript
PAYMENT_AMOUNT: 159900, // Amount in cents ($1,599.00)
PAYMENT_CURRENCY: 'usd',
PAYMENT_PRODUCT_NAME: 'Complete NIW Prep'
```

### Feature Flags

```javascript
FEATURES: {
    PAYMENT_REQUIRED: true,
    SURVEY_AUTO_SAVE: true,
    EMAIL_NOTIFICATIONS: false,
    ADMIN_DASHBOARD: false
}
```

## How to Switch Survey Types

1. **Edit `config.js`**:
   ```javascript
   SURVEY_TYPE: 'simplified', // Change from 'full' to 'simplified'
   ```

2. **Restart the server** (if using nodemon, it will auto-restart)

3. **Users will now see the simplified survey** when they click "Fill Survey"

## Survey Field Mapping

- **Full Survey**: Based on `survey_questions_mapping_v4.json` (149 fields)
- **Simplified Survey**: Based on `survey_questions_mapping_v4_simplified.json` (91 fields)

The simplified survey removes:
- Complex research methodology questions
- Detailed publication analysis
- Advanced citation tracking
- Some optional personal information fields

## API Endpoints

- `GET /api/config` - Returns current configuration
- `GET /survey` - Routes to appropriate survey based on config
- `POST /api/create-checkout-session` - Uses config for payment settings

## Security Notes

- `config.js` is in `.gitignore` to protect sensitive keys
- Never commit Stripe keys or session secrets
- Use environment variables for production deployment

## Future Configuration Options

The config system is designed to be easily extensible. You can add new settings like:

```javascript
// Email Configuration
EMAIL_SERVICE: 'sendgrid',
EMAIL_FROM: 'noreply@turboniw.com',

// Database Configuration  
DB_BACKUP_ENABLED: true,
DB_BACKUP_FREQUENCY: 'daily',

// UI Configuration
THEME_COLOR: '#2563eb',
LOGO_URL: '/assets/logo.png'
```

## Testing Configuration

Test your configuration by visiting:
- `http://localhost:3000/api/config` - View current settings
- `http://localhost:3000/account` - See survey title updates
- `http://localhost:3000/survey` - Test survey routing
