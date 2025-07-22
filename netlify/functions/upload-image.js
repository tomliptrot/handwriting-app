const AWS = require('aws-sdk');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_AWS_ACCESS_KEY,
  secretAccessKey: process.env.S3_AWS_SECRET_ACCESS_KEY,
  region: 'eu-west-2'
});

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse the request body
    const body = JSON.parse(event.body);
    const { imageData, filename, metadata } = body;

    if (!imageData || !filename) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: imageData, filename' }),
      };
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    
    // Determine content type from base64 string
    const contentTypeMatch = imageData.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
    const contentType = contentTypeMatch ? contentTypeMatch[1] : 'image/jpeg';

    const s3Key = `images/${filename}`;
    
    const params = {
      Bucket: 'ocr-handwriting-data-collection',
      Key: s3Key,
      Body: imageBuffer,
      ContentType: contentType,
      Metadata: {
        'worker-id': metadata?.workerId || 'unknown',
        'session-id': metadata?.sessionId || 'unknown',
        'original-code': metadata?.code || 'unknown',
        'upload-timestamp': new Date().toISOString()
      }
    };

    const result = await s3.upload(params).promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        location: result.Location,
        key: result.Key,
        bucket: result.Bucket
      }),
    };

  } catch (error) {
    console.error('Upload error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Upload failed',
        message: error.message 
      }),
    };
  }
};