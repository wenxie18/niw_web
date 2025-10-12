# 🚀 Vercel Deployment Guide

## 📋 **Pre-Deployment Checklist**

### 1. **Environment Variables Setup**
Before deploying, ensure these environment variables are set in Vercel:

#### **Required Variables:**
```bash
# Database
POSTGRES_URL=your_postgres_connection_string

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin Access (NEW)
ADMIN_KEY=your_secure_admin_password_here
```

#### **How to Set Environment Variables:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable with appropriate values
5. Set environment to **Production** (and **Preview** if desired)

### 2. **Deploy to Vercel**
```bash
# Push to GitHub (if not already done)
git add .
git commit -m "Add data management system"
git push origin main

# Deploy to Vercel
vercel --prod
```

## 🔐 **Accessing Data Management on Vercel**

### **Production URL Format:**
```
https://your-app-name.vercel.app/data-management?key=your_admin_key
```

### **Example URLs:**
```
# If your app is named "niw-web"
https://niw-web.vercel.app/data-management?key=mySecretAdminKey123

# If you have a custom domain
https://yourdomain.com/data-management?key=mySecretAdminKey123
```

## 🛡️ **Security Configuration**

### **1. Set a Strong Admin Key**
```bash
# Generate a secure random key
openssl rand -base64 32

# Or use a password generator
# Example: Kx9mP2nQ8vR5sT7uW3yZ1aB4cD6eF9gH
```

### **2. Environment Variable Security**
- ✅ **Never commit** `ADMIN_KEY` to Git
- ✅ **Use different keys** for different environments
- ✅ **Rotate keys** periodically
- ✅ **Keep keys secret** - only share with trusted team members

### **3. Access Control**
- 🔒 **URL-based access** - key must be in URL parameter
- 🔒 **Server-side validation** - all API endpoints protected
- 🔒 **No fallback keys** - production requires proper configuration

## 📊 **Data Management Features on Vercel**

### **Available Features:**
- ✅ **User Statistics Dashboard**
- ✅ **Search & Filter Users**
- ✅ **Individual User Downloads** (CSV/JSON)
- ✅ **Bulk Downloads** (CSV/JSON)
- ✅ **Real-time Data** from production database

### **File Downloads:**
- **Individual**: `niw-survey-user@example.com-data.csv`
- **Bulk**: `niw-survey-bulk-5-users-data.json`

## 🔧 **Troubleshooting**

### **"Admin access not configured" Error**
- **Cause**: `ADMIN_KEY` environment variable not set
- **Fix**: Set `ADMIN_KEY` in Vercel environment variables
- **Redeploy**: After setting variables, redeploy the app

### **"Access Denied" Error**
- **Cause**: Wrong or missing admin key in URL
- **Fix**: Check that URL includes correct `?key=your_admin_key`
- **Verify**: Key matches the `ADMIN_KEY` environment variable

### **"Failed to load users" Error**
- **Cause**: Database connection or query issues
- **Fix**: Check `POSTGRES_URL` environment variable
- **Verify**: Database is accessible from Vercel

### **Download Fails**
- **Cause**: Browser security or network issues
- **Fix**: Try different browser or check network connection
- **Verify**: Admin key is valid and user has data

## 🚀 **Quick Start Commands**

### **Deploy with Environment Variables:**
```bash
# Set environment variables in Vercel dashboard first
vercel --prod
```

### **Test Data Management:**
```bash
# Replace with your actual Vercel URL and admin key
curl "https://your-app.vercel.app/api/admin/users?key=your_admin_key"
```

### **Check Environment Variables:**
```bash
# In Vercel dashboard, go to Settings → Environment Variables
# Verify all required variables are set
```

## 📱 **Mobile Access**
The data management interface is fully responsive and works on:
- ✅ **Desktop browsers**
- ✅ **Tablets**
- ✅ **Mobile phones**
- ✅ **All modern browsers**

## 🔄 **Updates and Maintenance**

### **Updating Admin Key:**
1. Change `ADMIN_KEY` in Vercel environment variables
2. Redeploy the application
3. Update bookmarks with new key

### **Adding Team Members:**
1. Share the admin key securely (password manager recommended)
2. Provide the full URL with key
3. Consider rotating key periodically

### **Monitoring Usage:**
- Check Vercel analytics for page views
- Monitor database queries in your PostgreSQL dashboard
- Review download activity through server logs

---

## 🎯 **Summary**

**To access data management on Vercel:**

1. **Set `ADMIN_KEY`** in Vercel environment variables
2. **Deploy your app** to Vercel
3. **Visit**: `https://your-app.vercel.app/data-management?key=your_admin_key`
4. **Download data** in CSV or JSON format

**Security**: The admin key is required for all access - no key, no access! 🔒
