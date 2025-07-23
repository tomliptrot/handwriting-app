# S3 File Structure Migration Guide

This guide helps you migrate your existing S3 files from the old format (`code_workerid.jpg`) to the new organized structure (`workerid/code.jpg`).

## Prerequisites

1. **Node.js installed** on your machine
2. **AWS CLI configured** with credentials that have S3 read/write access
3. **Install AWS SDK**: `npm install aws-sdk`

## Quick Start

### 1. Preview the Migration (Recommended First Step)
```bash
node migrate-s3-structure.js --dry-run
```
This shows you exactly what files would be migrated without making any changes.

### 2. Run the Migration
```bash
node migrate-s3-structure.js
```
This performs the actual migration.

### 3. Verify Migration Success
```bash
node migrate-s3-structure.js --verify
```
This confirms all files have been successfully migrated.

## What the Script Does

### **Before Migration:**
```
s3://ocr-handwriting-data-collection/
└── images/
    ├── ABC12345_worker001.jpg
    ├── DEF67890_worker001.jpg
    ├── GHI11111_worker002.jpg
    └── JKL22222_worker002.jpg
```

### **After Migration:**
```
s3://ocr-handwriting-data-collection/
└── images/
    ├── worker001/
    │   ├── ABC12345.jpg
    │   └── DEF67890.jpg
    └── worker002/
        ├── GHI11111.jpg
        └── JKL22222.jpg
```

## Safety Features

✅ **Dry Run Mode**: Preview changes before executing  
✅ **Verification**: Confirms copy was successful before deleting original  
✅ **Duplicate Protection**: Skips files already in new format  
✅ **Error Handling**: Stops if copy fails, preserving original files  
✅ **Progress Tracking**: Shows detailed progress during migration  
✅ **Metadata Preservation**: Keeps all original file metadata  

## Step-by-Step Instructions

### 1. Install Dependencies
```bash
cd /path/to/your/handwriting-app
npm install aws-sdk
```

### 2. Configure AWS Credentials
Make sure your AWS credentials are configured:
```bash
aws configure list
```

If not configured:
```bash
aws configure set aws_access_key_id YOUR_ACCESS_KEY
aws configure set aws_secret_access_key YOUR_SECRET_KEY
aws configure set default.region eu-west-2
```

### 3. Run Dry Run First
```bash
node migrate-s3-structure.js --dry-run
```

**Expected Output:**
```
📋 Scanning S3 bucket for files to migrate...
📊 Found 150 files to migrate

📈 Migration Summary:
  👤 worker001: 45 files
  👤 worker002: 32 files
  👤 worker003: 28 files
  ...

🔍 Files that would be migrated:
  📁 images/ABC12345_worker001.jpg → images/worker001/ABC12345.jpg
  📁 images/DEF67890_worker001.jpg → images/worker001/DEF67890.jpg
  ...
```

### 4. Run the Actual Migration
If the dry run looks correct:
```bash
node migrate-s3-structure.js
```

**Expected Output:**
```
🚀 Starting S3 file structure migration
📍 Bucket: ocr-handwriting-data-collection
🌍 Region: eu-west-2

📊 Found 150 files to migrate

📈 Migration Summary:
  👤 worker001: 45 files
  👤 worker002: 32 files
  ...

🔄 Starting migration...
[1/150] ✅ images/ABC12345_worker001.jpg → images/worker001/ABC12345.jpg
[2/150] ✅ images/DEF67890_worker001.jpg → images/worker001/DEF67890.jpg
...

📊 Migration Complete!
  ✅ Successful: 150
  ❌ Errors: 0
```

### 5. Verify Migration
```bash
node migrate-s3-structure.js --verify
```

**Expected Output:**
```
🔍 Verifying migration...
📋 Scanning S3 bucket for files to migrate...
📊 Found 0 files to migrate
✅ Verification successful! No old format files found.
```

## Troubleshooting

### **Permission Errors**
```
Error: Access Denied
```
**Solution**: Ensure your AWS credentials have `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, and `s3:ListBucket` permissions.

### **Network Timeouts**
```
Error: RequestTimeout
```
**Solution**: The script includes automatic rate limiting. If you continue to see timeouts, you can modify the delay in the script.

### **Partial Migration**
If the migration stops partway through:
1. Run `node migrate-s3-structure.js --verify` to see remaining files
2. Run `node migrate-s3-structure.js` again - it will skip already migrated files
3. The script is idempotent and safe to run multiple times

### **Check What Failed**
If some files show errors, you can:
1. Check the error messages in the output
2. Run with `--verbose` for more details: `node migrate-s3-structure.js --verbose`
3. Fix any issues and re-run the migration

## Important Notes

- **The script is SAFE**: It copies files to new locations and only deletes originals after verifying the copy was successful
- **Idempotent**: Safe to run multiple times - skips already migrated files
- **Preserves Metadata**: All original file metadata is maintained
- **No Downtime**: Your app continues to work during migration (new files use new structure, script handles old files)

## Post-Migration

After successful migration:
1. Your S3 bucket will be organized by worker ID
2. New uploads will automatically use the new structure
3. You can use the updated AWS CLI commands to download files by worker

### Download by Worker (Post-Migration)
```bash
# Download all files from specific worker
aws s3 sync s3://ocr-handwriting-data-collection/images/worker001/ ./worker001/ --region eu-west-2

# List all workers
aws s3 ls s3://ocr-handwriting-data-collection/images/ --region eu-west-2
```