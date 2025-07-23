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

## Testing Your Configuration

After setting up your environment variables, test your configuration:

1. **Use the Test Function**: Visit `https://your-site.netlify.app/.netlify/functions/test-mailgun`
2. **Check the Response**: The function will test your configuration and send a test email
3. **Review Logs**: Check Netlify function logs for detailed diagnostic information

## Troubleshooting

### **401 Forbidden Error (Authentication Failed)**

This is the most common error. Check these items in order:

1. **API Key Format**:
   - Should be your complete API key from Mailgun dashboard
   - Check for extra spaces or characters
   - Verify it's the correct key from your Mailgun dashboard

2. **Environment Variables**:
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Ensure `MAILGUN_API_KEY` is set exactly (case-sensitive)
   - No quotes around the value

3. **API Key Permissions**:
   - Use your **private** API key, not public
   - Found in Mailgun Dashboard → Settings → API Keys
   - Should have sending permissions

4. **Domain Issues**:
   - Verify `MAILGUN_DOMAIN` matches exactly what's in your Mailgun dashboard
   - For sandbox: `sandboxXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org`
   - For custom domain: `mg.yourdomain.com`

### **403 Forbidden Error**

1. **Domain Authorization**:
   - Check if your domain is verified in Mailgun
   - Ensure DNS records are properly configured
   - Wait for domain verification to complete

2. **Plan Limitations**:
   - Verify your Mailgun plan allows sending
   - Check if you've exceeded your sending limits

### **400 Bad Request Error**

1. **Email Format Issues**:
   - Ensure `ADMIN_EMAIL` is a valid email address
   - Check that the sender domain matches your Mailgun domain

2. **Domain Format**:
   - Domain should not include `http://` or `https://`
   - Should be just the domain name (e.g., `mg.example.com`)

### **Email not received**:
1. **Check Spam Folder**: Emails might be filtered as spam
2. **Authorized Recipients**: For sandbox domains, add your email as an authorized recipient
3. **Domain Verification**: Ensure your sending domain is verified
4. **Check Logs**: Review both Netlify function logs and Mailgun logs

### **Function errors**:
1. **Dependencies**: Verify `package.json` includes `mailgun-js` dependency
2. **Environment Variables**: Use the test function to verify all variables are set
3. **Function Logs**: Check Netlify function logs for detailed error messages
4. **Deploy Status**: Ensure your latest changes are deployed

## Step-by-Step Debugging

1. **Run the Test Function**:
   ```
   https://your-site.netlify.app/.netlify/functions/test-mailgun
   ```

2. **Check Environment Variables**:
   - All required variables present
   - API key format correct
   - Domain format correct

3. **Verify in Mailgun Dashboard**:
   - Domain is active and verified
   - API key is valid and has permissions
   - Sending limits not exceeded

4. **Check Email Settings**:
   - Admin email is authorized (for sandbox)
   - Email address format is valid

5. **Review Function Logs**:
   - Netlify Dashboard → Functions → Logs
   - Look for specific error codes and messages

## Common Solutions

### **Quick Fix for 401 Errors**:
1. Go to Mailgun Dashboard → Settings → API Keys
2. Copy your **Private API Key** (full key string)
3. Update `MAILGUN_API_KEY` in Netlify environment variables
4. Redeploy your site or trigger a new build

### **For Sandbox Domains**:
1. Go to Mailgun Dashboard → Sending → Authorized Recipients
2. Add your admin email address
3. Verify the email address via the confirmation email

### **For Custom Domains**:
1. Ensure all DNS records are configured correctly
2. Wait for domain verification (can take up to 48 hours)
3. Check domain status in Mailgun dashboard

## Security Notes

- Never commit API keys to your repository
- Use environment variables for all sensitive data
- Consider using IP restrictions in Mailgun if available
- Monitor your Mailgun usage to prevent abuse
- Regularly rotate your API keys