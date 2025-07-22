// AWS Configuration
const localConfig = window.LOCAL_CONFIG || {};
window.AWS_CONFIG = {
    region: 'eu-west-2',
    bucketName: 'ocr-handwriting-data-collection',
    accessKeyId: localConfig.accessKeyId || window.S3_AWS_ACCESS_KEY || 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: localConfig.secretAccessKey || window.S3_AWS_SECRET_ACCESS_KEY || 'YOUR_SECRET_ACCESS_KEY',
    
    // Optional: Use IAM roles instead of keys (recommended for production)
    // roleArn: 'arn:aws:iam::123456789012:role/OCRUploadRole'
};


// Database Configuration
window.DB_CONFIG = {
    // Option 1: Supabase (recommended - free tier available)
    supabase: {
        url: 'https://kfngqdkbwscbwuwwosuu.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbmdxZGtid3NjYnd1d3dvc3V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NzU0NDUsImV4cCI6MjA2ODE1MTQ0NX0.ax-XZZzkN282Rmi4h34SSyuxNTcCgC-EeB47T4I9d-0',
        enabled: true
    },
    
    // Option 2: Firebase Firestore
    firebase: {
        apiKey: 'your-api-key',
        authDomain: 'your-project.firebaseapp.com',
        projectId: 'your-project-id',
        enabled: false
    },
    
    // Option 3: Simple backend API
    backend: {
        baseUrl: 'https://your-api.com',
        enabled: false
    }
};

// App Configuration
window.APP_CONFIG = {
    targetImages: 30,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    
    // Quality control
    minImageWidth: 400,
    minImageHeight: 300,
    
    // Worker validation
    workerIdPattern: /^[a-zA-Z0-9]{3,20}$/,
    
    // Feature flags
    features: {
        showStats: true,
        allowSkipping: true,
        trackTiming: true,
        requirePreview: true
    }
};