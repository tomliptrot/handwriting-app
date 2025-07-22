// Global variables
let currentCode = '';
let workerId = '';
let completedImages = 0;
let skippedCodes = 0;
let currentFile = null;
let sessionStartTime = null;
let sessionId = null;
let db = null;
let s3 = null;
let isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'|| window.location.hostname === '0.0.0.0' || window.location.protocol === 'file:' ;

// Cookie management for progress persistence
function setCookie(name, value, days = 7) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

function saveProgress() {
    const progressData = {
        workerId: workerId,
        completedImages: completedImages,
        skippedCodes: skippedCodes,
        sessionStartTime: sessionStartTime ? sessionStartTime.getTime() : null,
        sessionId: sessionId,
        currentCode: currentCode,
        timestamp: Date.now()
    };
    setCookie('handwriting_progress', JSON.stringify(progressData));
}

function loadProgress() {
    const progressCookie = getCookie('handwriting_progress');
    if (!progressCookie) return null;
    
    try {
        const progressData = JSON.parse(progressCookie);
        // Check if progress is less than 24 hours old
        if (Date.now() - progressData.timestamp > 24 * 60 * 60 * 1000) {
            deleteCookie('handwriting_progress');
            return null;
        }
        return progressData;
    } catch (error) {
        console.error('Error loading progress from cookie:', error);
        deleteCookie('handwriting_progress');
        return null;
    }
}

function clearProgress() {
    deleteCookie('handwriting_progress');
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeServices();
    updateTargetDisplay();
    showQRCodeOnDesktop();
    
    // Check for saved progress and restore if available
    const savedProgress = loadProgress();
    if (savedProgress) {
        restoreProgress(savedProgress);
    }
});

function restoreProgress(progressData) {
    // Restore variables
    workerId = progressData.workerId;
    completedImages = progressData.completedImages;
    skippedCodes = progressData.skippedCodes;
    sessionStartTime = progressData.sessionStartTime ? new Date(progressData.sessionStartTime) : null;
    sessionId = progressData.sessionId;
    currentCode = progressData.currentCode;
    
    // Update UI
    document.getElementById('workerIdDisplay').textContent = workerId;
    if (sessionStartTime) {
        document.getElementById('sessionTime').textContent = formatTime(sessionStartTime);
    }
    
    // Update progress display
    updateProgress();
    updateStats();
    
    if (APP_CONFIG.features.showStats) {
        document.getElementById('workerStats').style.display = 'block';
    }
    
    // Show appropriate interface
    if (completedImages >= APP_CONFIG.targetImages) {
        // Session was completed, show completion screen
        showCompletion();
    } else {
        // Resume session
        document.getElementById('workerSection').style.display = 'none';
        document.getElementById('mainInterface').style.display = 'block';
        document.getElementById('currentCode').textContent = currentCode;
        
        // Hide instructions if user has already uploaded at least one image
        if (completedImages > 0) {
            hideInstructionsAfterFirst();
        }
        
        // Show status message about restored progress
        showStatus(`Progress restored: ${completedImages}/${APP_CONFIG.targetImages} completed`, 'success');
    }
}

// Initialize Database services
async function initializeServices() {
    try {
        // Initialize AWS S3 for local development
        if (isLocalDevelopment && window.AWS && localConfig) {
            AWS.config.update({
                accessKeyId: localConfig.accessKeyId,
                secretAccessKey: localConfig.secretAccessKey,
                region: 'eu-west-2'
            });
            s3 = new AWS.S3();
            console.log('AWS S3 initialized for local development');
        }
        
        // Initialize Database
        if (DB_CONFIG.supabase.enabled) {
            // Load Supabase
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                db = supabase.createClient(DB_CONFIG.supabase.url, DB_CONFIG.supabase.key);
                console.log('Supabase initialized');
            };
            document.head.appendChild(script);
        } else if (DB_CONFIG.firebase.enabled) {
            // Initialize Firebase (if chosen)
            initializeFirebase();
        }
        
        console.log('Services initialized');
    } catch (error) {
        console.error('Service initialization error:', error);
        showStatus('Service initialization failed', 'error');
    }
}

// Worker initialization
async function initializeWorker() {
    const workerIdInput = document.getElementById('workerId');
    workerId = workerIdInput.value.trim();
    
    if (!workerId || !APP_CONFIG.workerIdPattern.test(workerId)) {
        alert('Worker ID must be 3-20 characters (letters and numbers only)');
        workerIdInput.focus();
        return;
    }
    
    try {
        // Check if worker exists in database
        const existingWorker = await getWorkerData(workerId);
        
        if (existingWorker && existingWorker.is_banned) {
            alert('This worker ID has been banned');
            return;
        }
        
        // Create or update worker session
        sessionStartTime = new Date();
        sessionId = generateSessionId();
        
        await createWorkerSession(workerId, sessionId);
        
        // Update UI
        document.getElementById('workerIdDisplay').textContent = workerId;
        document.getElementById('sessionTime').textContent = formatTime(sessionStartTime);
        
        if (APP_CONFIG.features.showStats) {
            document.getElementById('workerStats').style.display = 'block';
        }
        
        // Show main interface
        document.getElementById('workerSection').style.display = 'none';
        document.getElementById('mainInterface').style.display = 'block';
        
        // Generate first code
        generateNewCode();
        
        // Save initial progress
        saveProgress();
        
    } catch (error) {
        console.error('Worker initialization error:', error);
        alert('Failed to initialize worker. Please try again.');
    }
}

// Database operations
async function createWorkerSession(workerId, sessionId) {
    if (!db) return;
    
    try {
        // Insert or update worker
        const { error: workerError } = await db
            .from('workers')
            .upsert({
                worker_id: workerId,
                last_seen: new Date().toISOString(),
                total_sessions: 1,
                is_banned: false
            });
        
        if (workerError) throw workerError;
        
        // Create session record
        const { error: sessionError } = await db
            .from('sessions')
            .insert({
                session_id: sessionId,
                worker_id: workerId,
                started_at: new Date().toISOString(),
                target_images: APP_CONFIG.targetImages,
                completed_images: 0,
                skipped_codes: 0,
                status: 'active'
            });
        
        if (sessionError) throw sessionError;
        
    } catch (error) {
        console.error('Database error:', error);
        // Continue without database if it fails
    }
}

async function getWorkerData(workerId) {
    if (!db) return null;
    
    try {
        const { data, error } = await db
            .from('workers')
            .select('*')
            .eq('worker_id', workerId)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    } catch (error) {
        console.error('Get worker data error:', error);
        return null;
    }
}

async function logCodeGeneration(code) {
    if (!db) return;
    
    try {
        const { error } = await db
            .from('codes')
            .insert({
                session_id: sessionId,
                worker_id: workerId,
                code: code,
                generated_at: new Date().toISOString(),
                status: 'generated'
            });
        
        if (error) throw error;
    } catch (error) {
        console.error('Log code generation error:', error);
    }
}

async function logImageUpload(code, filename, s3Key) {
    if (!db) return;
    
    try {
        // Update code status
        const { error: codeError } = await db
            .from('codes')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                filename: filename,
                s3_key: s3Key
            })
            .eq('session_id', sessionId)
            .eq('code', code);
        
        if (codeError) throw codeError;
        
        // Update session
        const { error: sessionError } = await db
            .from('sessions')
            .update({
                completed_images: completedImages,
                last_activity: new Date().toISOString()
            })
            .eq('session_id', sessionId);
        
        if (sessionError) throw sessionError;
        
    } catch (error) {
        console.error('Log image upload error:', error);
    }
}

async function logCodeSkip(code) {
    if (!db) return;
    
    try {
        const { error } = await db
            .from('codes')
            .update({
                status: 'skipped',
                skipped_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)
            .eq('code', code);
        
        if (error) throw error;
    } catch (error) {
        console.error('Log code skip error:', error);
    }
}

async function completeSession() {
    if (!db) return;
    
    try {
        const endTime = new Date();
        const duration = Math.floor((endTime - sessionStartTime) / 1000);
        
        const { error } = await db
            .from('sessions')
            .update({
                status: 'completed',
                completed_at: endTime.toISOString(),
                duration_seconds: duration,
                completed_images: completedImages,
                skipped_codes: skippedCodes
            })
            .eq('session_id', sessionId);
        
        if (error) throw error;
    } catch (error) {
        console.error('Complete session error:', error);
    }
}

// Code generation
function generateRandomCode(n_letters = 3, n_numbers = 5) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    let code = '#';
    for (let i = 0; i < n_letters; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < n_numbers; i++) {
        code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return code;
}


async function generateNewCode() {
    currentCode = generateRandomCode();
    document.getElementById('currentCode').textContent = currentCode;
    
    // Log code generation
    await logCodeGeneration(currentCode);
    
    hideStatus();
    hidePhotoPreview();
}

async function skipCode() {
    if (!APP_CONFIG.features.allowSkipping) return;
    
    skippedCodes++;
    await logCodeSkip(currentCode);
    
    // Save progress after skipping
    saveProgress();
    
    generateNewCode();
}

// Photo handling
function takePhoto() {
    document.getElementById('cameraInput').click();
}

function retakePhoto() {
    hidePhotoPreview();
    currentFile = null;
}

function hidePhotoPreview() {
    document.getElementById('photoPreview').style.display = 'none';
}

function showPhotoPreview(file) {
    const preview = document.getElementById('photoPreview');
    const previewImage = document.getElementById('previewImage');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// File input handler
document.getElementById('cameraInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        if (validateFile(file)) {
            currentFile = file;
            if (APP_CONFIG.features.requirePreview) {
                showPhotoPreview(file);
            } else {
                uploadImage(file);
            }
        }
    }
});

// File validation
function validateFile(file) {
    if (!APP_CONFIG.allowedTypes.includes(file.type)) {
        showStatus('Please select a valid image file (JPEG, PNG, or WebP)', 'error');
        return false;
    }
    
    if (file.size > APP_CONFIG.maxFileSize) {
        showStatus(`File too large. Maximum size is ${APP_CONFIG.maxFileSize / 1024 / 1024}MB`, 'error');
        return false;
    }
    
    return true;
}

// Upload confirmation
function confirmUpload() {
    if (!currentFile) {
        showStatus('No photo selected', 'error');
        return;
    }
    
    uploadImage(currentFile);
}

// Upload image (local or Netlify function)
async function uploadImage(file) {
    showStatus('Uploading image...', 'info');
    showUploadProgress(0);
    
    try {
        const filename = generateFilename();
        let s3Key = `images/${filename}`;
        
        if (isLocalDevelopment && s3) {
            // Local development - direct S3 upload
            const params = {
                Bucket: 'ocr-handwriting-data-collection',
                Key: s3Key,
                Body: file,
                ContentType: file.type,
                Metadata: {
                    'worker-id': workerId,
                    'session-id': sessionId,
                    'original-code': currentCode,
                    'upload-timestamp': new Date().toISOString()
                }
            };
            
            const upload = s3.upload(params);
            
            // Track upload progress
            upload.on('httpUploadProgress', function(evt) {
                const percent = Math.round((evt.loaded * 100) / evt.total);
                showUploadProgress(percent);
            });
            
            await upload.promise();
            
        } else {
            // Production - Netlify function
            const base64Data = await fileToBase64(file);
            
            const payload = {
                imageData: base64Data,
                filename: filename,
                metadata: {
                    workerId: workerId,
                    sessionId: sessionId,
                    code: currentCode
                }
            };
            
            const response = await fetch('/.netlify/functions/upload-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Upload failed');
            }
        }
        
        // Log successful upload
        await logImageUpload(currentCode, filename, s3Key);
        
        completedImages++;
        updateProgress();
        updateStats();
        
        // Save progress after successful upload
        saveProgress();
        
        hideUploadProgress();
        showStatus('Image uploaded successfully!', 'success');
        
        if (completedImages >= APP_CONFIG.targetImages) {
            setTimeout(showCompletion, 1500);
        } else {
            // Hide instructions after first upload
            if (completedImages === 1) {
                hideInstructionsAfterFirst();
            }
            setTimeout(generateNewCode, 1500);
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        hideUploadProgress();
        showStatus('Upload failed. Please try again.', 'error');
    }
    
    // Reset file input
    document.getElementById('cameraInput').value = '';
    currentFile = null;
}

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Upload progress
function showUploadProgress(percent) {
    let progressEl = document.getElementById('uploadProgress');
    if (!progressEl) {
        progressEl = document.createElement('div');
        progressEl.id = 'uploadProgress';
        progressEl.className = 'upload-progress';
        progressEl.innerHTML = `
            <div>Upload Progress: <span id="uploadPercent">0</span>%</div>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" id="uploadProgressFill"></div>
            </div>
        `;
        document.querySelector('.camera-section').appendChild(progressEl);
    }
    
    document.getElementById('uploadPercent').textContent = percent;
    document.getElementById('uploadProgressFill').style.width = percent + '%';
}

function hideUploadProgress() {
    const progressEl = document.getElementById('uploadProgress');
    if (progressEl) {
        progressEl.remove();
    }
}

// Utility functions
function generateFilename() {
    const codeWithoutHash = currentCode.substring(1);
    return `${codeWithoutHash}_${workerId}.jpg`;
}

function generateSessionId() {
    return `sess_${workerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function updateTargetDisplay() {
    document.getElementById('targetCount').textContent = APP_CONFIG.targetImages;
    document.getElementById('targetCountInstructions').textContent = APP_CONFIG.targetImages;
    
    // Update video or hide if disabled
    const videoSection = document.getElementById('videoInstructions');
    if (APP_CONFIG.features.showVideo && APP_CONFIG.videoId !== 'YOUR_VIDEO_ID') {
        const iframe = videoSection.querySelector('iframe');
        iframe.src = `https://www.youtube.com/embed/${APP_CONFIG.videoId}`;
    } else {
        videoSection.style.display = 'none';
    }
}

function updateProgress() {
    document.getElementById('completedCount').textContent = completedImages;
    const percentage = (completedImages / APP_CONFIG.targetImages) * 100;
    document.getElementById('progressFill').style.width = percentage + '%';
}

function updateStats() {
    if (APP_CONFIG.features.showStats) {
        document.getElementById('totalImages').textContent = completedImages;
    }
}

async function showCompletion() {
    await completeSession();
    
    const completionCode = generateCompletionCode();
    const duration = Math.floor((new Date() - sessionStartTime) / 1000);
    
    document.getElementById('completionCode').textContent = completionCode;
    document.getElementById('finalCount').textContent = completedImages;
    document.getElementById('finalImageCount').textContent = completedImages;
    document.getElementById('sessionDuration').textContent = formatDuration(duration);
    document.getElementById('skippedCount').textContent = skippedCodes;
    
    // Clear saved progress since session is complete
    clearProgress();
    
    // Hide main interface and show completion screen
    document.getElementById('mainInterface').style.display = 'none';
    document.getElementById('completionScreen').style.display = 'block';
}

function generateCompletionCode() {
    const timestamp = Date.now().toString(36);
    const workerHash = workerId.slice(-4);
    const imageCount = completedImages.toString().padStart(2, '0');
    return `COMP-${workerHash}-${imageCount}-${timestamp}`.toUpperCase();
}

function formatTime(date) {
    return date.toLocaleTimeString();
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

// Status handling
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(hideStatus, 3000);
    }
}

function hideStatus() {
    document.getElementById('status').style.display = 'none';
}

// Show QR code only on desktop
function showQRCodeOnDesktop() {
    // Only show QR code on desktop (screen width > 768px)
    if (window.innerWidth <= 768) {
        document.getElementById('mobileQR').style.display = 'none';
    }
}

// Instructions toggle functionality
function toggleInstructions() {
    const content = document.getElementById('instructionsContent');
    const button = document.getElementById('toggleInstructions');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        button.textContent = 'Hide';
    } else {
        content.style.display = 'none';
        button.textContent = 'Show';
    }
}

function hideInstructionsAfterFirst() {
    const content = document.getElementById('instructionsContent');
    const button = document.getElementById('toggleInstructions');
    
    content.style.display = 'none';
    button.textContent = 'Show';
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && document.getElementById('workerSection').style.display !== 'none') {
        initializeWorker();
    }
    
    if (event.key === ' ' && document.getElementById('mainInterface').style.display !== 'none') {
        event.preventDefault();
        takePhoto();
    }
});

// Prevent accidental page reload
window.addEventListener('beforeunload', function(event) {
    if (completedImages > 0 && completedImages < APP_CONFIG.targetImages) {
        event.preventDefault();
        event.returnValue = 'You have unsaved progress. Are you sure you want to leave?';
    }
});