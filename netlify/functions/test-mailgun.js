const mailgun = require('mailgun-js');

exports.handler = async (event) => {
    // Only allow GET requests for this test endpoint
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed. Use GET request.' })
        };
    }

    try {
        console.log('=== Mailgun Configuration Test ===');
        
        // Check environment variables
        const requiredEnvVars = ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'ADMIN_EMAIL'];
        const envStatus = {};
        
        requiredEnvVars.forEach(varName => {
            const value = process.env[varName];
            envStatus[varName] = {
                present: !!value,
                value: varName === 'MAILGUN_API_KEY' ? 
                    (value ? `${value.substring(0, 8)}...` : 'NOT SET') : 
                    value || 'NOT SET'
            };
        });

        console.log('Environment variables:', envStatus);

        // Validate API key format
        const apiKey = process.env.MAILGUN_API_KEY;
        const apiKeyValid = apiKey && apiKey.startsWith('key-') && apiKey.length > 10;
        
        console.log('API Key validation:', {
            present: !!apiKey,
            startsWithKey: apiKey?.startsWith('key-'),
            validLength: apiKey?.length > 10,
            isValid: apiKeyValid
        });

        // Check if all required vars are present
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Missing environment variables',
                    missing: missingVars,
                    envStatus: envStatus
                })
            };
        }

        if (!apiKeyValid) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid API key format',
                    details: 'API key should start with "key-" and be longer than 10 characters',
                    envStatus: envStatus
                })
            };
        }

        // Initialize Mailgun
        const mg = mailgun({
            apiKey: process.env.MAILGUN_API_KEY,
            domain: process.env.MAILGUN_DOMAIN
        });

        console.log('Mailgun client initialized successfully');

        // Try to send a simple test email
        const testEmailData = {
            from: `Test <noreply@${process.env.MAILGUN_DOMAIN}>`,
            to: process.env.ADMIN_EMAIL,
            subject: '🧪 Mailgun Configuration Test',
            html: `
                <h2>Mailgun Test Email</h2>
                <p>This is a test email to verify your Mailgun configuration is working correctly.</p>
                <p><strong>Domain:</strong> ${process.env.MAILGUN_DOMAIN}</p>
                <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                <p>If you received this email, your Mailgun configuration is working! 🎉</p>
            `,
            text: `
Mailgun Test Email

This is a test email to verify your Mailgun configuration is working correctly.

Domain: ${process.env.MAILGUN_DOMAIN}
Time: ${new Date().toISOString()}

If you received this email, your Mailgun configuration is working!
            `
        };

        console.log('Attempting to send test email...');
        const result = await mg.messages().send(testEmailData);
        console.log('Test email sent successfully:', result);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Mailgun configuration test passed! Check your email.',
                messageId: result.id,
                envStatus: envStatus,
                testDetails: {
                    domain: process.env.MAILGUN_DOMAIN,
                    recipientEmail: process.env.ADMIN_EMAIL,
                    timestamp: new Date().toISOString()
                }
            })
        };

    } catch (error) {
        console.error('Mailgun test failed:', error);
        console.error('Error details:', {
            message: error.message,
            statusCode: error.statusCode,
            stack: error.stack
        });

        let errorMessage = 'Mailgun test failed';
        let troubleshooting = [];

        if (error.statusCode === 401) {
            errorMessage = 'Authentication failed (401)';
            troubleshooting = [
                'Check that MAILGUN_API_KEY is correct and starts with "key-"',
                'Verify the API key in your Mailgun dashboard',
                'Ensure the API key has sending permissions'
            ];
        } else if (error.statusCode === 403) {
            errorMessage = 'Forbidden (403)';
            troubleshooting = [
                'Check that your domain is verified in Mailgun',
                'Ensure the API key has permission for this domain',
                'Verify your Mailgun plan allows sending'
            ];
        } else if (error.statusCode === 400) {
            errorMessage = 'Bad request (400)';
            troubleshooting = [
                'Check that MAILGUN_DOMAIN is correct',
                'Verify email addresses are valid',
                'Ensure domain format is correct (e.g., mg.yourdomain.com)'
            ];
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: errorMessage,
                statusCode: error.statusCode,
                details: error.message,
                troubleshooting: troubleshooting
            })
        };
    }
};