const mailgun = require('mailgun-js');

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Initialize Mailgun
        const mg = mailgun({
            apiKey: process.env.MAILGUN_API_KEY,
            domain: process.env.MAILGUN_DOMAIN
        });

        // Parse request body
        const { 
            workerId, 
            completedImages, 
            sessionDuration, 
            completionCode, 
            skippedCodes,
            sessionStartTime 
        } = JSON.parse(event.body);

        // Validate required fields
        if (!workerId || !completedImages || !completionCode) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Format session start time
        const startTime = sessionStartTime ? new Date(sessionStartTime).toLocaleString() : 'Unknown';

        // Prepare email data
        const emailData = {
            from: `OCR Data Collection <noreply@${process.env.MAILGUN_DOMAIN}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `✅ Task Completed: Worker ${workerId} (${completedImages} images)`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c5aa0; border-bottom: 2px solid #2c5aa0; padding-bottom: 10px;">
                        🎯 New Task Completion
                    </h2>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">Session Details</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Worker ID:</td>
                                <td style="padding: 8px 0; color: #333;">${workerId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Images Completed:</td>
                                <td style="padding: 8px 0; color: #333;">${completedImages}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Session Duration:</td>
                                <td style="padding: 8px 0; color: #333;">${sessionDuration}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Codes Skipped:</td>
                                <td style="padding: 8px 0; color: #333;">${skippedCodes || 0}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Started At:</td>
                                <td style="padding: 8px 0; color: #333;">${startTime}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; border-left: 4px solid #2c5aa0;">
                        <h4 style="margin-top: 0; color: #2c5aa0;">Completion Code</h4>
                        <code style="background-color: #fff; padding: 5px 10px; border-radius: 3px; font-size: 16px; color: #333;">
                            ${completionCode}
                        </code>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                        <p>This is an automated notification from your OCR Data Collection system.</p>
                        <p>Time sent: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            `,
            text: `
New Task Completion

Worker ID: ${workerId}
Images Completed: ${completedImages}
Session Duration: ${sessionDuration}
Codes Skipped: ${skippedCodes || 0}
Started At: ${startTime}
Completion Code: ${completionCode}

Time sent: ${new Date().toLocaleString()}
            `
        };

        // Send email
        const result = await mg.messages().send(emailData);
        
        console.log('Email sent successfully:', result);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST'
            },
            body: JSON.stringify({ 
                success: true, 
                message: 'Email sent successfully',
                messageId: result.id 
            })
        };

    } catch (error) {
        console.error('Error sending email:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to send email',
                details: error.message 
            })
        };
    }
};