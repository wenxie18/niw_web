# 📊 Data Management System

## Overview
The Data Management System provides a comprehensive interface for downloading and managing survey data from your NIW application. This system allows your team to easily export user data in both CSV and JSON formats.

## 🔐 Access
- **URL**: `http://localhost:3000/data-management?key=admin123`
- **Admin Key**: Set `ADMIN_KEY` environment variable or use default `admin123`
- **Protection**: All endpoints require admin authentication

## 🚀 Features

### 📈 Dashboard Statistics
- **Total Users**: Count of all registered users
- **Completed Both Surveys**: Users who finished both first and second surveys
- **Partial Surveys**: Users who completed only one survey
- **No Surveys**: Users who haven't started any surveys

### 🔍 User Management
- **Search**: Filter users by email address
- **Status Filter**: Filter by completion status (All, Completed Both, Partial, None)
- **User List**: View all users with their payment status, package type, and survey completion status

### 📥 Download Options

#### Individual User Downloads
- **CSV Format**: Structured data with columns for easy analysis
- **JSON Format**: Complete raw data for programmatic use
- **Data Includes**: User info, survey responses, payment history

#### Bulk Downloads
- **Select Multiple Users**: Checkbox selection for multiple users
- **Download All**: Export all visible users (respects current filters)
- **Download Selected**: Export only selected users
- **Bulk CSV**: All users in one structured CSV file
- **Bulk JSON**: All users in one JSON array

### 📊 Data Structure

#### CSV Format
```
User_Email, Field, Value, Survey_Type, Question_ID, Response
user@example.com, user, email, "", "", user@example.com
user@example.com, first_survey, response, first, Q1_abc123, "Answer 1"
user@example.com, second_survey, response, second, Q2_def456, "Answer 2"
user@example.com, payment, amount_dollars, "", payment_0, 299.00
```

#### JSON Format
```json
{
  "user": {
    "email": "user@example.com",
    "paid": true,
    "package_type": "full",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "first_survey": {
    "id": "survey-id-123",
    "responses": { "Q1_abc123": "Answer 1" },
    "created_at": "2024-01-01T00:00:00Z"
  },
  "second_survey": {
    "id": "survey-id-456", 
    "responses": { "Q2_def456": "Answer 2" },
    "created_at": "2024-01-01T00:00:00Z"
  },
  "payments": [
    {
      "amount_dollars": 299.00,
      "package_type": "full",
      "payment_method": "card",
      "status": "completed"
    }
  ]
}
```

## 🛠️ API Endpoints

### GET `/api/admin/users`
- **Purpose**: Fetch all users with survey completion status
- **Auth**: Requires admin key
- **Response**: Array of user objects with completion flags

### GET `/api/admin/user-data/:email`
- **Purpose**: Download individual user data
- **Params**: 
  - `email`: User email address
  - `format`: `csv` or `json` (default: `json`)
- **Auth**: Requires admin key
- **Response**: User data in requested format

### POST `/api/admin/bulk-download`
- **Purpose**: Download multiple users' data
- **Body**: `{ "emails": ["user1@example.com", "user2@example.com"], "format": "csv" }`
- **Auth**: Requires admin key
- **Response**: Bulk data in requested format

## 🔧 Configuration

### Environment Variables
```bash
# Set a secure admin key for production
ADMIN_KEY=your_secure_admin_key_here
```

### Default Access
- **Development**: `http://localhost:3000/data-management?key=admin123`
- **Production**: Set `ADMIN_KEY` environment variable

## 📋 Usage Examples

### 1. Access the Management Interface
```
http://localhost:3000/data-management?key=admin123
```

### 2. Download All User Data (CSV)
1. Click "Download All (CSV)" button
2. File downloads as `niw-survey-bulk-X-users-data.csv`

### 3. Download Specific User (JSON)
1. Find user in the table
2. Click "JSON" button in their row
3. File downloads as `niw-survey-user@example.com-data.json`

### 4. Filter and Download Partial Surveys
1. Select "Partial Surveys" from filter dropdown
2. Select desired users with checkboxes
3. Click "Download Selected (CSV)"

## 🔒 Security Features

- **Admin Key Protection**: All endpoints require valid admin key
- **URL Parameter**: Admin key passed via URL parameter
- **Header Support**: Admin key can also be passed via `X-Admin-Key` header
- **Access Denied Page**: Clear error message for unauthorized access

## 📁 File Naming Convention

- **Individual User**: `niw-survey-{email}-data.{csv|json}`
- **Bulk Download**: `niw-survey-bulk-{count}-users-data.{csv|json}`

## 🚨 Troubleshooting

### Access Denied Error
- Check that admin key is correct
- Ensure `ADMIN_KEY` environment variable is set
- Verify URL includes `?key=your_admin_key`

### Download Fails
- Check browser console for error messages
- Verify user has completed surveys
- Ensure admin key is valid

### No Data Shows
- Check database connection
- Verify users exist in database
- Check admin key permissions

## 🔄 Data Refresh

- **Auto-refresh**: Data loads automatically on page load
- **Manual Refresh**: Click "🔄 Refresh" button
- **Real-time**: Data reflects current database state

---

**Note**: This system provides read-only access to survey data. For data modification or deletion, use the database management tools directly.
