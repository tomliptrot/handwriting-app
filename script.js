/**
 * OCR Handwriting Data Collection App
 * Main application script with organized modules
 */

// ========================================
// 1. CONFIGURATION AND GLOBALS
// ========================================

/**
 * Application state management
 */
const AppState = {
    currentCode: '',
    workerId: '',
    completedImages: 0,
    skippedCodes: 0,
    currentFile: null,
    sessionStartTime: null,
    sessionId: null
};

/**
 * External services
 */
const Services = {
    db: null,
    s3: null
};

/**
 * Environment detection
 */
const Environment = {
    isLocalDevelopment: window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.hostname === '0.0.0.0' || 
                       window.location.protocol === 'file:'
};

/**
 * Cached DOM elements for performance
 */
const DOMElements = {
    // Populated on DOMContentLoaded
    workerSection: null,
    mainInterface: null,
    completionScreen: null,
    currentCode: null,
    status: null,
    progressFill: null,
    completedCount: null,
    // ... will be populated in initializeDOMCache()
};

// ========================================
// 2. UTILITY FUNCTIONS
// ========================================

/**
 * Cookie management utilities
 */
const CookieManager = {
    /**
     * Set a cookie with specified name, value, and expiration
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {number} days - Expiration in days
     */
    set(name, value, days = 7) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = name + "=" + value + ";" + expires + ";path=/";
    },

    /**
     * Get cookie value by name
     * @param {string} name - Cookie name
     * @returns {string|null} Cookie value or null if not found
     */
    get(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },

    /**
     * Delete a cookie
     * @param {string} name - Cookie name
     */
    delete(name) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
};

/**
 * Utility functions
 */
const Utils = {
    /**
     * Generate a unique session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
        return `sess_${AppState.workerId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    },

    /**
     * Generate filename for uploaded image
     * @returns {string} Filename
     */
    generateFilename() {
        const codeWithoutHash = AppState.currentCode.substring(1);
        return `${codeWithoutHash}.jpg`;
    },

    /**
     * Generate completion code
     * @returns {string} Completion code
     */
    generateCompletionCode() {
        const timestamp = Date.now().toString(36);
        const workerHash = AppState.workerId.slice(-4);
        const imageCount = AppState.completedImages.toString().padStart(2, '0');
        return `COMP-${workerHash}-${imageCount}-${timestamp}`.toUpperCase();
    },

    /**
     * Format time display
     * @param {Date} date - Date to format
     * @returns {string} Formatted time
     */
    formatTime(date) {
        return date.toLocaleTimeString();
    },

    /**
     * Format duration in seconds to readable format
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    },

    /**
     * Convert file to base64
     * @param {File} file - File to convert
     * @returns {Promise<string>} Base64 string
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }
};

// ========================================
// 3. PROGRESS MANAGEMENT
// ========================================

/**
 * Progress persistence using cookies
 */
const ProgressManager = {
    /**
     * Save current progress to cookies
     */
    save() {
        const progressData = {
            workerId: AppState.workerId,
            completedImages: AppState.completedImages,
            skippedCodes: AppState.skippedCodes,
            sessionStartTime: AppState.sessionStartTime ? AppState.sessionStartTime.getTime() : null,
            sessionId: AppState.sessionId,
            currentCode: AppState.currentCode,
            timestamp: Date.now()
        };
        CookieManager.set('handwriting_progress', JSON.stringify(progressData));
    },

    /**
     * Load progress from cookies
     * @returns {Object|null} Progress data or null if not found/expired
     */
    load() {
        const progressCookie = CookieManager.get('handwriting_progress');
        if (!progressCookie) return null;

        try {
            const progressData = JSON.parse(progressCookie);
            // Check if progress is less than 24 hours old
            if (Date.now() - progressData.timestamp > 24 * 60 * 60 * 1000) {
                this.clear();
                return null;
            }
            return progressData;
        } catch (error) {
            console.error('Error loading progress from cookie:', error);
            this.clear();
            return null;
        }
    },

    /**
     * Clear saved progress
     */
    clear() {
        CookieManager.delete('handwriting_progress');
    },

    /**
     * Restore progress from saved data
     * @param {Object} progressData - Saved progress data
     */
    restore(progressData) {
        // Restore application state
        AppState.workerId = progressData.workerId;
        AppState.completedImages = progressData.completedImages;
        AppState.skippedCodes = progressData.skippedCodes;
        AppState.sessionStartTime = progressData.sessionStartTime ? new Date(progressData.sessionStartTime) : null;
        AppState.sessionId = progressData.sessionId;
        AppState.currentCode = progressData.currentCode;

        // Update UI
        UIManager.updateWorkerDisplay();
        UIManager.updateProgress();
        UIManager.updateStats();

        if (APP_CONFIG.features.showStats) {
            DOMElements.workerStats.style.display = 'block';
        }

        // Show appropriate interface
        if (AppState.completedImages >= APP_CONFIG.targetImages) {
            // Session was completed, show completion screen
            CompletionManager.show();
        } else {
            // Resume session
            UIManager.showMainInterface();
            DOMElements.currentCode.textContent = AppState.currentCode;

            // Hide instructions if user has already uploaded at least one image
            if (AppState.completedImages > 0) {
                UIManager.hideInstructionsAfterFirst();
            }

            // Show status message about restored progress
            UIManager.showStatus(`Progress restored: ${AppState.completedImages}/${APP_CONFIG.targetImages} completed`, 'success');
        }
    }
};

// ========================================
// 4. DATABASE OPERATIONS
// ========================================

/**
 * Database operations with consistent error handling
 */
const DatabaseManager = {
    /**
     * Execute database operation with consistent error handling
     * @param {Function} operation - Database operation function
     * @param {string} errorMessage - Error message for logging
     * @returns {Promise<any>} Operation result or null on error
     */
    async execute(operation, errorMessage = 'Database operation failed') {
        if (!Services.db) return null;
        
        try {
            return await operation();
        } catch (error) {
            console.error(errorMessage, error);
            return null;
        }
    },

    /**
     * Create or update worker session
     * @param {string} workerId - Worker ID
     * @param {string} sessionId - Session ID
     */
    async createWorkerSession(workerId, sessionId) {
        return this.execute(async () => {
            // Insert or update worker
            const { error: workerError } = await Services.db
                .from('workers')
                .upsert({
                    worker_id: workerId,
                    last_seen: new Date().toISOString(),
                    total_sessions: 1,
                    is_banned: false
                });

            if (workerError) throw workerError;

            // Create session record
            const { error: sessionError } = await Services.db
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
        }, 'Failed to create worker session');
    },

    /**
     * Get worker data
     * @param {string} workerId - Worker ID
     * @returns {Promise<Object|null>} Worker data or null
     */
    async getWorkerData(workerId) {
        return this.execute(async () => {
            const { data, error } = await Services.db
                .from('workers')
                .select('*')
                .eq('worker_id', workerId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        }, 'Failed to get worker data');
    },

    /**
     * Log code generation
     * @param {string} code - Generated code
     */
    async logCodeGeneration(code) {
        return this.execute(async () => {
            const { error } = await Services.db
                .from('codes')
                .insert({
                    session_id: AppState.sessionId,
                    worker_id: AppState.workerId,
                    code: code,
                    generated_at: new Date().toISOString(),
                    status: 'generated'
                });

            if (error) throw error;
        }, 'Failed to log code generation');
    },

    /**
     * Log image upload
     * @param {string} code - Code that was uploaded
     * @param {string} filename - File name
     * @param {string} s3Key - S3 key
     */
    async logImageUpload(code, filename, s3Key) {
        return this.execute(async () => {
            // Update code status
            const { error: codeError } = await Services.db
                .from('codes')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    filename: filename,
                    s3_key: s3Key
                })
                .eq('session_id', AppState.sessionId)
                .eq('code', code);

            if (codeError) throw codeError;

            // Update session
            const { error: sessionError } = await Services.db
                .from('sessions')
                .update({
                    completed_images: AppState.completedImages,
                    last_activity: new Date().toISOString()
                })
                .eq('session_id', AppState.sessionId);

            if (sessionError) throw sessionError;
        }, 'Failed to log image upload');
    },

    /**
     * Log code skip
     * @param {string} code - Code that was skipped
     */
    async logCodeSkip(code) {
        return this.execute(async () => {
            const { error } = await Services.db
                .from('codes')
                .update({
                    status: 'skipped',
                    skipped_at: new Date().toISOString()
                })
                .eq('session_id', AppState.sessionId)
                .eq('code', code);

            if (error) throw error;
        }, 'Failed to log code skip');
    },

    /**
     * Complete session
     */
    async completeSession() {
        return this.execute(async () => {
            const endTime = new Date();
            const duration = Math.floor((endTime - AppState.sessionStartTime) / 1000);

            const { error } = await Services.db
                .from('sessions')
                .update({
                    status: 'completed',
                    completed_at: endTime.toISOString(),
                    duration_seconds: duration,
                    completed_images: AppState.completedImages,
                    skipped_codes: AppState.skippedCodes
                })
                .eq('session_id', AppState.sessionId);

            if (error) throw error;
        }, 'Failed to complete session');
    }
};

// ========================================
// 5. SERVICE INITIALIZATION
// ========================================

/**
 * Initialize external services
 */
const ServiceManager = {
    /**
     * Initialize all services
     */
    async initialize() {
        try {
            await this.initializeAWS();
            await this.initializeDatabase();
            console.log('Services initialized');
        } catch (error) {
            console.error('Service initialization error:', error);
            UIManager.showStatus('Service initialization failed', 'error');
        }
    },

    /**
     * Initialize AWS S3 for local development
     */
    async initializeAWS() {
        if (Environment.isLocalDevelopment && window.AWS && window.localConfig) {
            AWS.config.update({
                accessKeyId: window.localConfig.accessKeyId,
                secretAccessKey: window.localConfig.secretAccessKey,
                region: 'eu-west-2'
            });
            Services.s3 = new AWS.S3();
            console.log('AWS S3 initialized for local development');
        }
    },

    /**
     * Initialize database connection
     */
    async initializeDatabase() {
        if (DB_CONFIG.supabase.enabled) {
            await this.initializeSupabase();
        } else if (DB_CONFIG.firebase.enabled) {
            await this.initializeFirebase();
        }
    },

    /**
     * Initialize Supabase
     */
    async initializeSupabase() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                Services.db = window.supabase.createClient(DB_CONFIG.supabase.url, DB_CONFIG.supabase.key);
                console.log('Supabase initialized');
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * Initialize Firebase (placeholder)
     */
    async initializeFirebase() {
        // Firebase initialization logic would go here
        console.log('Firebase initialization not implemented');
    }
};

// ========================================
// 6. UI MANAGEMENT
// ========================================

/**
 * UI management and DOM manipulation
 */
const UIManager = {
    /**
     * Initialize DOM element cache
     */
    initializeDOMCache() {
        DOMElements.workerSection = document.getElementById('workerSection');
        DOMElements.mainInterface = document.getElementById('mainInterface');
        DOMElements.completionScreen = document.getElementById('completionScreen');
        DOMElements.currentCode = document.getElementById('currentCode');
        DOMElements.status = document.getElementById('status');
        DOMElements.progressFill = document.getElementById('progressFill');
        DOMElements.completedCount = document.getElementById('completedCount');
        DOMElements.workerIdDisplay = document.getElementById('workerIdDisplay');
        DOMElements.sessionTime = document.getElementById('sessionTime');
        DOMElements.workerStats = document.getElementById('workerStats');
        DOMElements.totalImages = document.getElementById('totalImages');
        DOMElements.photoPreview = document.getElementById('photoPreview');
        DOMElements.instructionsContent = document.getElementById('instructionsContent');
        DOMElements.toggleInstructions = document.getElementById('toggleInstructions');
    },

    /**
     * Show main interface
     */
    showMainInterface() {
        DOMElements.workerSection.style.display = 'none';
        DOMElements.mainInterface.style.display = 'block';
    },

    /**
     * Update worker display
     */
    updateWorkerDisplay() {
        DOMElements.workerIdDisplay.textContent = AppState.workerId;
        if (AppState.sessionStartTime) {
            DOMElements.sessionTime.textContent = Utils.formatTime(AppState.sessionStartTime);
        }
    },

    /**
     * Update progress display
     */
    updateProgress() {
        DOMElements.completedCount.textContent = AppState.completedImages;
        const percentage = (AppState.completedImages / APP_CONFIG.targetImages) * 100;
        DOMElements.progressFill.style.width = percentage + '%';
    },

    /**
     * Update statistics display
     */
    updateStats() {
        if (APP_CONFIG.features.showStats) {
            DOMElements.totalImages.textContent = AppState.completedImages;
        }
    },

    /**
     * Update target count displays
     */
    updateTargetDisplay() {
        document.getElementById('targetCount').textContent = APP_CONFIG.targetImages;
        document.getElementById('targetCountInstructions').textContent = APP_CONFIG.targetImages;

        // Update initial page video
        const videoSection = document.getElementById('videoInstructions');
        this.configureVideo(videoSection);

        // Update task page video
        const taskVideoSection = document.getElementById('taskVideoInstructions');
        this.configureVideo(taskVideoSection);
    },

    /**
     * Configure video display
     * @param {HTMLElement} videoSection - Video section element
     */
    configureVideo(videoSection) {
        if (APP_CONFIG.features.showVideo && APP_CONFIG.videoId !== 'YOUR_VIDEO_ID') {
            const iframe = videoSection.querySelector('iframe');
            iframe.src = `https://www.youtube.com/embed/${APP_CONFIG.videoId}`;
        } else {
            videoSection.style.display = 'none';
        }
    },

    /**
     * Show QR code on desktop only
     */
    showQRCodeOnDesktop() {
        const qrSection = document.getElementById('mobileQR');
        if (window.innerWidth <= 768) {
            qrSection.style.display = 'none';
        } else {
            qrSection.style.display = 'block';
        }
    },

    /**
     * Show status message
     * @param {string} message - Status message
     * @param {string} type - Message type (success, error, info)
     */
    showStatus(message, type) {
        DOMElements.status.textContent = message;
        DOMElements.status.className = `status ${type}`;
        DOMElements.status.style.display = 'block';

        if (type === 'success') {
            setTimeout(() => this.hideStatus(), 3000);
        }
    },

    /**
     * Hide status message
     */
    hideStatus() {
        DOMElements.status.style.display = 'none';
    },

    /**
     * Show photo preview
     * @param {File} file - Image file
     */
    showPhotoPreview(file) {
        const previewImage = document.getElementById('previewImage');

        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            DOMElements.photoPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    /**
     * Hide photo preview
     */
    hidePhotoPreview() {
        DOMElements.photoPreview.style.display = 'none';
    },

    /**
     * Show upload progress
     * @param {number} percent - Progress percentage
     */
    showUploadProgress(percent) {
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
    },

    /**
     * Hide upload progress
     */
    hideUploadProgress() {
        const progressEl = document.getElementById('uploadProgress');
        if (progressEl) {
            progressEl.remove();
        }
    },

    /**
     * Toggle instructions visibility
     */
    toggleInstructions() {
        if (DOMElements.instructionsContent.style.display === 'none') {
            DOMElements.instructionsContent.style.display = 'block';
            DOMElements.toggleInstructions.textContent = 'Hide';
        } else {
            DOMElements.instructionsContent.style.display = 'none';
            DOMElements.toggleInstructions.textContent = 'Show';
        }
    },

    /**
     * Hide instructions after first upload
     */
    hideInstructionsAfterFirst() {
        DOMElements.instructionsContent.style.display = 'none';
        DOMElements.toggleInstructions.textContent = 'Show';
    }
};

// ========================================
// 7. CODE GENERATION
// ========================================

/**
 * Code generation functionality
 */
const CodeGenerator = {
    /**
     * Generate random code with specified format
     * @param {number} nLetters - Number of letters
     * @param {number} nNumbers - Number of numbers
     * @returns {string} Generated code
     */
    generateRandomCode(nLetters = 3, nNumbers = 5) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';

        let code = '#';
        for (let i = 0; i < nLetters; i++) {
            code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        for (let i = 0; i < nNumbers; i++) {
            code += numbers.charAt(Math.floor(Math.random() * numbers.length));
        }
        return code;
    },

    /**
     * Generate new code and update UI
     */
    async generateNewCode() {
        AppState.currentCode = this.generateRandomCode();
        DOMElements.currentCode.textContent = AppState.currentCode;

        // Log code generation
        await DatabaseManager.logCodeGeneration(AppState.currentCode);

        UIManager.hideStatus();
        UIManager.hidePhotoPreview();
    },

    /**
     * Skip current code
     */
    async skipCode() {
        if (!APP_CONFIG.features.allowSkipping) return;

        AppState.skippedCodes++;
        await DatabaseManager.logCodeSkip(AppState.currentCode);

        // Save progress after skipping
        ProgressManager.save();

        this.generateNewCode();
    }
};

// ========================================
// 8. WORKER MANAGEMENT
// ========================================

/**
 * Worker initialization and management
 */
const WorkerManager = {
    /**
     * Initialize worker session
     */
    async initialize() {
        const workerIdInput = document.getElementById('workerId');
        AppState.workerId = workerIdInput.value.trim();

        if (!this.validateWorkerId(AppState.workerId)) {
            UIManager.showStatus('Worker ID must be 3-20 characters (letters and numbers only)', 'error');
            workerIdInput.focus();
            return;
        }

        try {
            // Check if worker exists and is not banned
            const existingWorker = await DatabaseManager.getWorkerData(AppState.workerId);

            if (existingWorker && existingWorker.is_banned) {
                UIManager.showStatus('This worker ID has been banned', 'error');
                return;
            }

            // Create session
            AppState.sessionStartTime = new Date();
            AppState.sessionId = Utils.generateSessionId();

            await DatabaseManager.createWorkerSession(AppState.workerId, AppState.sessionId);

            // Update UI
            UIManager.updateWorkerDisplay();

            if (APP_CONFIG.features.showStats) {
                DOMElements.workerStats.style.display = 'block';
            }

            // Show main interface and generate first code
            UIManager.showMainInterface();
            await CodeGenerator.generateNewCode();

            // Save initial progress
            ProgressManager.save();

        } catch (error) {
            console.error('Worker initialization error:', error);
            UIManager.showStatus('Failed to initialize worker. Please try again.', 'error');
        }
    },

    /**
     * Validate worker ID format
     * @param {string} workerId - Worker ID to validate
     * @returns {boolean} True if valid
     */
    validateWorkerId(workerId) {
        return workerId && APP_CONFIG.workerIdPattern.test(workerId);
    }
};

// ========================================
// 9. FILE HANDLING AND UPLOAD
// ========================================

/**
 * File handling and upload functionality
 */
const FileManager = {
    /**
     * Validate uploaded file
     * @param {File} file - File to validate
     * @returns {boolean} True if valid
     */
    validateFile(file) {
        if (!APP_CONFIG.allowedTypes.includes(file.type)) {
            UIManager.showStatus('Please select a valid image file (JPEG, PNG, or WebP)', 'error');
            return false;
        }

        if (file.size > APP_CONFIG.maxFileSize) {
            UIManager.showStatus(`File too large. Maximum size is ${APP_CONFIG.maxFileSize / 1024 / 1024}MB`, 'error');
            return false;
        }

        return true;
    },

    /**
     * Handle file selection
     * @param {File} file - Selected file
     */
    handleFileSelection(file) {
        if (this.validateFile(file)) {
            AppState.currentFile = file;
            if (APP_CONFIG.features.requirePreview) {
                UIManager.showPhotoPreview(file);
            } else {
                this.uploadImage(file);
            }
        }
    },

    /**
     * Upload image file
     * @param {File} file - File to upload
     */
    async uploadImage(file) {
        UIManager.showStatus('Uploading image...', 'info');
        UIManager.showUploadProgress(0);

        try {
            const filename = Utils.generateFilename();
            const s3Key = `images/${AppState.workerId}/${filename}`;

            if (Environment.isLocalDevelopment && Services.s3) {
                await this.uploadToS3Direct(file, s3Key);
            } else {
                await this.uploadViaNetlify(file, filename, s3Key);
            }

            // Log successful upload
            await DatabaseManager.logImageUpload(AppState.currentCode, filename, s3Key);

            // Update progress
            AppState.completedImages++;
            UIManager.updateProgress();
            UIManager.updateStats();

            // Save progress after successful upload
            ProgressManager.save();

            UIManager.hideUploadProgress();
            UIManager.showStatus('Image uploaded successfully!', 'success');

            // Check if completed
            if (AppState.completedImages >= APP_CONFIG.targetImages) {
                setTimeout(() => CompletionManager.show(), 1500);
            } else {
                // Hide instructions after first upload
                if (AppState.completedImages === 1) {
                    UIManager.hideInstructionsAfterFirst();
                }
                setTimeout(() => CodeGenerator.generateNewCode(), 1500);
            }

        } catch (error) {
            console.error('Upload error:', error);
            UIManager.hideUploadProgress();
            UIManager.showStatus('Upload failed. Please try again.', 'error');
        }

        // Reset file input
        document.getElementById('cameraInput').value = '';
        AppState.currentFile = null;
    },

    /**
     * Upload directly to S3 (local development)
     * @param {File} file - File to upload
     * @param {string} s3Key - S3 key
     */
    async uploadToS3Direct(file, s3Key) {
        const params = {
            Bucket: 'ocr-handwriting-data-collection',
            Key: s3Key,
            Body: file,
            ContentType: file.type,
            Metadata: {
                'worker-id': AppState.workerId,
                'session-id': AppState.sessionId,
                'original-code': AppState.currentCode,
                'upload-timestamp': new Date().toISOString()
            }
        };

        const upload = Services.s3.upload(params);

        // Track upload progress
        upload.on('httpUploadProgress', (evt) => {
            const percent = Math.round((evt.loaded * 100) / evt.total);
            UIManager.showUploadProgress(percent);
        });

        await upload.promise();
    },

    /**
     * Upload via Netlify function (production)
     * @param {File} file - File to upload
     * @param {string} filename - Filename
     * @param {string} s3Key - S3 key path
     */
    async uploadViaNetlify(file, filename, s3Key) {
        const base64Data = await Utils.fileToBase64(file);

        const payload = {
            imageData: base64Data,
            filename: filename,
            s3Key: s3Key,
            metadata: {
                workerId: AppState.workerId,
                sessionId: AppState.sessionId,
                code: AppState.currentCode
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
};

// ========================================
// 10. COMPLETION MANAGEMENT
// ========================================

/**
 * Session completion functionality
 */
const CompletionManager = {
    /**
     * Send completion email notification
     * @param {string} completionCode - Completion code
     * @param {string} sessionDuration - Session duration
     */
    async sendCompletionEmail(completionCode, sessionDuration) {
        try {
            const emailData = {
                workerId: AppState.workerId,
                completedImages: AppState.completedImages,
                sessionDuration: sessionDuration,
                completionCode: completionCode,
                skippedCodes: AppState.skippedCodes,
                sessionStartTime: AppState.sessionStartTime ? AppState.sessionStartTime.getTime() : null
            };

            const response = await fetch('/.netlify/functions/send-completion-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(emailData)
            });

            const result = await response.json();

            if (result.success) {
                console.log('Completion email sent successfully');
            } else {
                console.error('Failed to send completion email:', result.error);
            }
        } catch (error) {
            console.error('Error sending completion email:', error);
            // Don't show error to user - email failure shouldn't affect their completion
        }
    },

    /**
     * Show completion screen
     */
    async show() {
        await DatabaseManager.completeSession();

        const completionCode = Utils.generateCompletionCode();
        const duration = Math.floor((new Date() - AppState.sessionStartTime) / 1000);

        // Update completion screen
        document.getElementById('completionCode').textContent = completionCode;
        document.getElementById('finalCount').textContent = AppState.completedImages;
        document.getElementById('finalImageCount').textContent = AppState.completedImages;
        document.getElementById('sessionDuration').textContent = Utils.formatDuration(duration);
        document.getElementById('skippedCount').textContent = AppState.skippedCodes;

        // Send completion email notification
        await this.sendCompletionEmail(completionCode, Utils.formatDuration(duration));

        // Clear saved progress since session is complete
        ProgressManager.clear();

        // Show completion screen
        DOMElements.mainInterface.style.display = 'none';
        DOMElements.completionScreen.style.display = 'block';
    }
};

// ========================================
// 11. EVENT HANDLERS
// ========================================

/**
 * Event handler setup
 */
const EventHandlers = {
    /**
     * Initialize all event handlers
     */
    initialize() {
        this.setupFileInput();
        this.setupKeyboardShortcuts();
        this.setupBeforeUnload();
    },

    /**
     * Setup file input handler
     */
    setupFileInput() {
        document.getElementById('cameraInput').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                FileManager.handleFileSelection(file);
            }
        });
    },

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            try {
                if (event.key === 'Enter' && DOMElements.workerSection.style.display !== 'none') {
                    WorkerManager.initialize();
                }

                if (event.key === ' ' && DOMElements.mainInterface.style.display !== 'none') {
                    event.preventDefault();
                    this.takePhoto();
                }
            } catch (error) {
                console.error('Keyboard shortcut error:', error);
            }
        });
    },

    /**
     * Setup page unload protection
     */
    setupBeforeUnload() {
        window.addEventListener('beforeunload', (event) => {
            if (AppState.completedImages > 0 && AppState.completedImages < APP_CONFIG.targetImages) {
                event.preventDefault();
                return 'You have unsaved progress. Are you sure you want to leave?';
            }
        });
    },

    /**
     * Take photo (trigger file input)
     */
    takePhoto() {
        document.getElementById('cameraInput').click();
    },

    /**
     * Retake photo
     */
    retakePhoto() {
        UIManager.hidePhotoPreview();
        AppState.currentFile = null;
    },

    /**
     * Confirm upload
     */
    confirmUpload() {
        if (!AppState.currentFile) {
            UIManager.showStatus('No photo selected', 'error');
            return;
        }
        FileManager.uploadImage(AppState.currentFile);
    }
};

// ========================================
// 12. APPLICATION INITIALIZATION
// ========================================

/**
 * Main application initialization
 */
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Initialize DOM cache
        UIManager.initializeDOMCache();
        
        // Initialize services
        await ServiceManager.initialize();
        
        // Setup UI
        UIManager.updateTargetDisplay();
        UIManager.showQRCodeOnDesktop();
        
        // Setup event handlers
        EventHandlers.initialize();
        
        // Check for saved progress and restore if available
        const savedProgress = ProgressManager.load();
        if (savedProgress) {
            ProgressManager.restore(savedProgress);
        }
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Application initialization error:', error);
        UIManager.showStatus('Application failed to initialize', 'error');
    }
});

// ========================================
// 13. GLOBAL FUNCTIONS (for HTML onclick handlers)
// ========================================

// Global functions needed for HTML onclick handlers
window.initializeWorker = () => WorkerManager.initialize();
window.takePhoto = () => EventHandlers.takePhoto();
window.retakePhoto = () => EventHandlers.retakePhoto();
window.confirmUpload = () => EventHandlers.confirmUpload();
window.skipCode = () => CodeGenerator.skipCode();
window.toggleInstructions = () => UIManager.toggleInstructions();