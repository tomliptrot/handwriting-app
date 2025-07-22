# OCR Data Collection App

A web application for collecting handwritten text samples for OCR training data.

## Overview

This app allows workers to:
- Write down generated codes on paper
- Take photos of their handwritten codes
- Upload images to AWS S3 for data collection
- Track progress through a session-based interface

## Features

- Unique code generation
- Photo capture and preview
- Progress tracking
- Session management with database logging
- Configurable target image counts
- Worker validation and statistics

## Deployment on Netlify

### Prerequisites

1. AWS S3 bucket set up for image storage
2. Database service (Supabase or Firebase) configured
3. AWS IAM credentials with S3 write permissions

### Deploy Steps

1. **Fork/Clone** this repository

2. **Configure settings** in `config.js`:
   - Set your AWS S3 bucket name and credentials
   - Configure database connection (Supabase/Firebase)
   - Adjust app settings (target images, file size limits, etc.)

3. **Deploy to Netlify**:
   - Connect your GitHub repository to Netlify
   - Set build command: (none needed - static site)
   - Set publish directory: `/` (root)
   - Deploy site

4. **Environment Variables** (optional):
   - For security, consider using Netlify environment variables instead of hardcoded credentials
   - Use Netlify Functions for sensitive operations if needed

### Files

- `index.html` - Main application interface
- `script.js` - Core application logic
- `styles.css` - Application styling  
- `config.js` - Configuration settings

### Security Note

Update `config.js` with your actual AWS and database credentials before deployment. Consider using environment variables or serverless functions for production deployments.