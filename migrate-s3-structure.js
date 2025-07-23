#!/usr/bin/env node

/**
 * S3 Migration Script
 * Migrates existing files from "images/code_workerid.jpg" to "images/workerid/code.jpg"
 * 
 * Usage:
 *   node migrate-s3-structure.js --dry-run    # See what would be migrated
 *   node migrate-s3-structure.js             # Perform actual migration
 *   node migrate-s3-structure.js --verify    # Verify migration was successful
 */

const AWS = require('aws-sdk');
const path = require('path');

// Configuration
const BUCKET_NAME = 'ocr-handwriting-data-collection';
const REGION = 'eu-west-2';
const IMAGES_PREFIX = 'images/';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerify = args.includes('--verify');
const isVerbose = args.includes('--verbose');

// Configure AWS
const s3 = new AWS.S3({
    region: REGION,
    // Will use credentials from environment or AWS config
});

/**
 * Parse filename to extract worker ID and code
 * Handles formats like: ABC12345_worker123.jpg -> { code: 'ABC12345', workerId: 'worker123' }
 */
function parseOldFilename(filename) {
    // Remove .jpg extension
    const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    
    // Split by last underscore to separate code from worker ID
    const lastUnderscoreIndex = nameWithoutExt.lastIndexOf('_');
    
    if (lastUnderscoreIndex === -1) {
        return null; // Invalid format
    }
    
    const code = nameWithoutExt.substring(0, lastUnderscoreIndex);
    const workerId = nameWithoutExt.substring(lastUnderscoreIndex + 1);
    
    // Get file extension
    const extension = filename.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
    
    return { code, workerId, extension };
}

/**
 * Generate new S3 key from parsed filename
 */
function generateNewKey(parsed) {
    return `${IMAGES_PREFIX}${parsed.workerId}/${parsed.code}.${parsed.extension}`;
}

/**
 * List all files in the images/ prefix that match the old format
 */
async function listOldFormatFiles() {
    console.log('📋 Scanning S3 bucket for files to migrate...');
    
    const allFiles = [];
    let continuationToken = null;
    
    do {
        const params = {
            Bucket: BUCKET_NAME,
            Prefix: IMAGES_PREFIX,
            ContinuationToken: continuationToken
        };
        
        const response = await s3.listObjectsV2(params).promise();
        
        for (const object of response.Contents || []) {
            const key = object.Key;
            const filename = path.basename(key);
            
            // Skip files that are already in the new format (contain subdirectories)
            const relativePath = key.replace(IMAGES_PREFIX, '');
            if (relativePath.includes('/')) {
                if (isVerbose) {
                    console.log(`⏭️  Skipping (already migrated): ${key}`);
                }
                continue;
            }
            
            // Try to parse the filename
            const parsed = parseOldFilename(filename);
            if (parsed) {
                allFiles.push({
                    oldKey: key,
                    newKey: generateNewKey(parsed),
                    filename: filename,
                    ...parsed
                });
            } else {
                console.log(`⚠️  Could not parse: ${filename}`);
            }
        }
        
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    console.log(`📊 Found ${allFiles.length} files to migrate`);
    return allFiles;
}

/**
 * Copy object to new location
 */
async function copyObject(oldKey, newKey) {
    const copyParams = {
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${oldKey}`,
        Key: newKey,
        MetadataDirective: 'COPY' // Preserve existing metadata
    };
    
    await s3.copyObject(copyParams).promise();
}

/**
 * Delete old object
 */
async function deleteObject(key) {
    const deleteParams = {
        Bucket: BUCKET_NAME,
        Key: key
    };
    
    await s3.deleteObject(deleteParams).promise();
}

/**
 * Verify that a file exists at the new location
 */
async function verifyFileExists(key) {
    try {
        await s3.headObject({
            Bucket: BUCKET_NAME,
            Key: key
        }).promise();
        return true;
    } catch (error) {
        if (error.statusCode === 404) {
            return false;
        }
        throw error;
    }
}

/**
 * Perform the migration
 */
async function migrate() {
    console.log('🚀 Starting S3 file structure migration');
    console.log(`📍 Bucket: ${BUCKET_NAME}`);
    console.log(`🌍 Region: ${REGION}`);
    
    if (isDryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
    }
    
    const filesToMigrate = await listOldFormatFiles();
    
    if (filesToMigrate.length === 0) {
        console.log('✅ No files need migration!');
        return;
    }
    
    // Group by worker ID for better organization
    const byWorker = {};
    filesToMigrate.forEach(file => {
        if (!byWorker[file.workerId]) {
            byWorker[file.workerId] = [];
        }
        byWorker[file.workerId].push(file);
    });
    
    console.log(`\n📈 Migration Summary:`);
    Object.keys(byWorker).forEach(workerId => {
        console.log(`  👤 ${workerId}: ${byWorker[workerId].length} files`);
    });
    
    if (isDryRun) {
        console.log('\n🔍 Files that would be migrated:');
        filesToMigrate.forEach(file => {
            console.log(`  📁 ${file.oldKey} → ${file.newKey}`);
        });
        return;
    }
    
    // Confirm before proceeding
    console.log(`\n⚠️  This will migrate ${filesToMigrate.length} files.`);
    console.log('Each file will be copied to the new location and then deleted from the old location.');
    
    // In a real script, you might want to add a confirmation prompt here
    // For now, we'll proceed automatically
    
    let successCount = 0;
    let errorCount = 0;
    
    console.log('\n🔄 Starting migration...');
    
    for (let i = 0; i < filesToMigrate.length; i++) {
        const file = filesToMigrate[i];
        const progress = `[${i + 1}/${filesToMigrate.length}]`;
        
        try {
            // Check if destination already exists
            const destExists = await verifyFileExists(file.newKey);
            if (destExists) {
                console.log(`${progress} ⏭️  Already exists: ${file.newKey}`);
                // Still delete the old file if it exists
                await deleteObject(file.oldKey);
                successCount++;
                continue;
            }
            
            // Copy to new location
            await copyObject(file.oldKey, file.newKey);
            
            // Verify copy was successful
            const copyVerified = await verifyFileExists(file.newKey);
            if (!copyVerified) {
                throw new Error('Copy verification failed');
            }
            
            // Delete old file
            await deleteObject(file.oldKey);
            
            console.log(`${progress} ✅ ${file.oldKey} → ${file.newKey}`);
            successCount++;
            
        } catch (error) {
            console.error(`${progress} ❌ Failed to migrate ${file.oldKey}: ${error.message}`);
            errorCount++;
        }
        
        // Add small delay to avoid rate limiting
        if (i % 10 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log(`\n📊 Migration Complete!`);
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    
    if (errorCount > 0) {
        console.log('\n⚠️  Some files failed to migrate. Check the errors above.');
        process.exit(1);
    }
}

/**
 * Verify migration was successful
 */
async function verifyMigration() {
    console.log('🔍 Verifying migration...');
    
    const oldFormatFiles = await listOldFormatFiles();
    
    if (oldFormatFiles.length === 0) {
        console.log('✅ Verification successful! No old format files found.');
    } else {
        console.log(`❌ Verification failed! Found ${oldFormatFiles.length} files still in old format:`);
        oldFormatFiles.forEach(file => {
            console.log(`  📁 ${file.oldKey}`);
        });
        process.exit(1);
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        if (isVerify) {
            await verifyMigration();
        } else {
            await migrate();
        }
    } catch (error) {
        console.error('💥 Migration failed:', error.message);
        if (isVerbose) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Migration interrupted by user');
    process.exit(0);
});

// Print usage if no valid arguments
if (process.argv.length < 2) {
    console.log(`
Usage:
  node migrate-s3-structure.js --dry-run    # Preview what would be migrated
  node migrate-s3-structure.js             # Perform migration
  node migrate-s3-structure.js --verify    # Verify migration completed
  node migrate-s3-structure.js --verbose   # Show detailed output

Options:
  --dry-run   Show what would be migrated without making changes
  --verify    Check that migration was successful
  --verbose   Show detailed output including skipped files
`);
    process.exit(0);
}

// Run the script
main();