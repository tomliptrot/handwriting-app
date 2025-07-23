# Mailgun Email Notification Setup

This document explains how to set up email notifications when users complete their 30 images using Mailgun and Netlify Functions.

## Required Environment Variables

Add these environment variables to your Netlify site settings:

### 1. Mailgun Configuration
- **MAILGUN_API_KEY**: Your Mailgun API key
  - Found in your Mailgun dashboard under Settings → API Keys
  - Should start with `key-` followed by a long string
  
- **MAILGUN_DOMAIN**: Your Mailgun domain
  - Found in your Mailgun dashboard under Domains
  - Example: `mg.yourdomain.com` or `sandboxXXXXX.mailgun.org`

- **ADMIN_EMAIL**: Your email address to receive notifications
  - Example: `admin@yourdomain.com`

## Setting Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add the following variables:

```
MAILGUN_API_KEY=key-your-actual-api-key-here
MAILGUN_DOMAIN=mg.yourdomain.com
ADMIN_EMAIL=your-email@domain.com
```

## Mailgun Domain Setup

### Option 1: Use Mailgun Sandbox (Testing)
- Use the sandbox domain provided by Mailgun
- No DNS setup required
- Limited to authorized recipients only
- Domain looks like: `sandboxXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org`

### Option 2: Use Your Own Domain (Production)
1. Add your domain in Mailgun dashboard
2. Set up DNS records as specified by Mailgun:
   - TXT record for domain verification
   - MX records for receiving emails
   - CNAME records for tracking and unsubscribe links
3. Verify domain in Mailgun dashboard

## Email Template

The notification email includes:
- Worker ID
- Number of images completed
- Session duration
- Number of codes skipped
- Session start time
- Completion code
- Timestamp of completion

## Testing

1. Complete a test session with 30 images
2. Check your email (including spam folder)
3. Check Netlify function logs if emails aren't received:
   - Go to Netlify dashboard → Functions → send-completion-email
   - View recent invocations and logs

## Troubleshooting

### Email not received:
1. Check environment variables are set correctly
2. Verify Mailgun domain is active
3. Check Netlify function logs for errors
4. Ensure your email address is authorized in Mailgun (for sandbox domains)

### Function errors:
1. Check Netlify function logs
2. Verify package.json includes `mailgun-js` dependency
3. Ensure all required environment variables are set

## Security Notes

- Never commit API keys to your repository
- Use environment variables for all sensitive data
- Consider using IP restrictions in Mailgun if available
- Monitor your Mailgun usage to prevent abuse