# AWS S3 Setup for Photo Upload Feature

## Overview
The photo upload feature uses AWS S3 with presigned URLs for direct client-to-S3 uploads. This requires proper S3 bucket configuration including CORS settings.

## Required AWS Configuration

### 1. S3 Bucket Setup
- **Bucket Name**: `myagilityqs-frontend`
- **Region**: `us-east-1` (or set `AWS_REGION` environment variable)
- **Public Access**: Configured for web hosting (existing)

### 2. S3 CORS Configuration

The bucket must have the following CORS configuration to allow uploads from your client application:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT",
            "POST",
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "https://myagilityqs.com",
            "http://localhost:5174"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

**To apply this configuration:**
1. Go to AWS S3 Console
2. Select the `myagilityqs-frontend` bucket
3. Go to the "Permissions" tab
4. Scroll down to "Cross-origin resource sharing (CORS)"
5. Click "Edit"
6. Paste the JSON configuration above
7. Click "Save changes"

### 3. IAM Role Permissions

The Lambda execution role needs the following S3 permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::myagilityqs-frontend/dog-photos/*"
        }
    ]
}
```

### 4. Environment Variables

Ensure these environment variables are set in your Lambda function:
- `AWS_REGION`: The AWS region (defaults to us-east-1 if not set)

## Troubleshooting CORS Issues

### Common CORS Error
```
Access to fetch at 'https://myagilityqs-frontend.s3.us-east-1.amazonaws.com/...' 
from origin 'http://localhost:5174' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Solution**: Apply the CORS configuration above to your S3 bucket.

### Testing CORS Configuration
1. Open browser developer tools
2. Go to Network tab
3. Try uploading a photo
4. Check if there's a preflight OPTIONS request to S3
5. Verify the OPTIONS response includes proper CORS headers

### File Path Structure
Uploaded photos are stored with this path pattern:
```
dog-photos/{dogId}/{timestamp}.{extension}
```

Example:
```
dog-photos/4fbef0b0-f1f0-4887-a35c-b5a3b2730181/1750902648844.png
```

### Accessing Uploaded Photos
Photos are accessible via HTTPS at:
```
https://myagilityqs.com/dog-photos/{dogId}/{timestamp}.{extension}
```

This works because the S3 bucket is already configured for static website hosting.

## Verification Steps

1. **Check CORS Configuration**: Upload a photo and verify no CORS errors
2. **Verify File Upload**: Check that the file appears in the S3 bucket
3. **Test Photo Display**: Confirm photos display correctly in the app
4. **Test Cropping**: Verify virtual cropping works as expected

## Security Notes

- Presigned URLs expire after 5 minutes for security
- Each upload generates a unique timestamped filename
- Metadata includes dogId, userId, and upload timestamp
- Only authenticated users can generate presigned URLs
- Users can only upload photos for their own dogs