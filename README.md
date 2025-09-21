# NIW Application Survey Website

A professional web application for collecting National Interest Waiver (NIW) application information through a comprehensive survey form.

## Features

- **Multi-step Survey Form**: 8 organized sections covering all aspects of NIW applications
- **Professional Design**: Modern, responsive UI with smooth animations
- **Form Validation**: Real-time validation with user-friendly error messages
- **Auto-save**: Progress is automatically saved to localStorage
- **Database Storage**: SQLite database for storing survey responses
- **REST API**: Flask-based backend API for data management
- **Email-based Querying**: Retrieve survey data by email address

## Survey Sections

1. **Personal Information** - Basic contact and identity details
2. **USCIS Information** - Service center address details
3. **Educational Background** - Academic qualifications and university rankings
4. **Additional Education** - Second and third degrees, PhD research
5. **Professional Information** - Current employment and research work
6. **Research Expertise** - Research focus areas and methodologies
7. **Publications** - Research publications and their details
8. **Citations & Impact** - Citation metrics and research impact

## Quick Start

### Prerequisites

- Node.js 14.0 or higher
- npm (comes with Node.js)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

### Alternative: Static HTML (No Backend)

If you just want to test the frontend without the backend:

1. Open `index.html` directly in your browser
2. The form will work with auto-save to localStorage
3. Data won't be saved to a database

## API Endpoints

- `POST /api/submit-survey` - Submit survey data
- `GET /api/survey/<email>` - Retrieve survey by email
- `GET /api/surveys` - Get all survey submissions
- `GET /api/health` - Health check

## Database Schema

The application uses SQLite with two main tables:

- `survey_responses` - Main survey data with JSON storage
- `response_fields` - Individual field storage for easier querying

## File Structure

```
niw_web/
├── index.html          # Main survey form
├── styles.css          # Professional styling
├── script.js           # Form functionality and API calls
├── server.js           # Express.js backend API
├── package.json        # Node.js dependencies and scripts
├── vercel.json         # Vercel deployment configuration
├── .gitignore          # Git ignore file
├── survey_questions_mapping_v4.json  # Original question mapping
└── README.md           # This file
```

## Customization

### Adding New Questions

1. Add the question to `survey_questions_mapping_v4.json`
2. Add the corresponding form field to the appropriate section in `index.html`
3. The form will automatically handle the new field

### Styling Changes

Modify `styles.css` to customize the appearance. The design uses CSS Grid and Flexbox for responsive layouts.

### Backend Modifications

The Express.js API in `server.js` can be extended to:
- Add authentication (JWT, Passport.js)
- Implement data validation (Joi, express-validator)
- Add email notifications (Nodemailer, SendGrid)
- Export data to various formats (Excel, PDF)
- Add admin dashboard
- Implement user management

## Deployment Options

### Local Development
- Run `npm run dev` for development with auto-reload
- Run `npm start` for production mode
- Access at `http://localhost:3000`

### Cloud Deployment (Recommended)

#### Vercel (Easiest - Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Deploy automatically
4. Free tier includes 100GB bandwidth

#### Netlify
1. Connect GitHub repository
2. Build command: `npm run build` (if you add build step)
3. Publish directory: root
4. Free tier available

#### AWS (Most Scalable)
- **AWS Lambda**: Serverless deployment
- **AWS EC2**: Full server control
- **AWS Elastic Beanstalk**: Easy deployment
- **AWS Amplify**: Full-stack hosting

#### Heroku
1. Add `Procfile`: `web: node server.js`
2. Connect GitHub repository
3. Deploy with one click

### Static Hosting (Frontend Only)
- **Netlify**: Drag and drop the HTML/CSS/JS files
- **Vercel**: Connect your GitHub repository
- **GitHub Pages**: Push to a GitHub repository

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Security Considerations

- Input validation on both frontend and backend
- SQL injection protection through parameterized queries
- CORS enabled for API access
- Email validation and sanitization

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the port in `app.py` (line 95)
2. **Database errors**: Delete `niw_survey.db` to reset
3. **CORS issues**: Ensure Flask-CORS is installed
4. **Form not submitting**: Check browser console for JavaScript errors

### Debug Mode

The Flask app runs in debug mode by default. Check the terminal for detailed error messages.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.
