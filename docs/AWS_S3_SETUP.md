# AWS S3 Setup for Photo Upload Feature

> **Note:** S3 CORS configuration and Lambda IAM permissions are now applied
> automatically by `template.yaml` (`FrontendBucket.CorsConfiguration` and
> `ApiFunction.Policies`). This document is kept as a reference for what those
> resources do and how to debug CORS issues — you should not need to apply
> any of this manually.

## Overview
The photo upload feature uses AWS S3 with presigned URLs for direct client-to-S3 uploads. The Lambda generates a short-lived presigned URL, the client PUTs the file directly to S3, then updates the dog record with the resulting URL.

## What `template.yaml` Configures

### 1. S3 Bucket
- **Bucket Name**: `myagilityqs-frontend` (prod) / `myagilityqs-frontend-dev` (non-prod)
- **Region**: `us-east-1`
- **Public Access**: Blocked at the bucket level; CloudFront serves files via Origin Access Control.

### 2. S3 CORS Configuration

Applied automatically by the template:

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

**Manual application is not needed** — the template applies this on every
`sam deploy`. If you've manually edited the bucket's CORS in the console
and need to revert: re-deploy via SAM and CloudFormation will reapply the
template's config (overwrites manual changes).

### 3. IAM Role Permissions

Applied automatically by the template via `ApiFunction.Policies`:

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