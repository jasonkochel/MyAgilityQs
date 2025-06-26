# Deployment Notes for Photo Upload Feature

## Issue Resolved
The initial SAM deployment failed due to an incorrect S3 ARN format in the IAM policy. This has been fixed in the template.

### Changes Made:
1. **Fixed S3 ARN Format**: Changed from `!Sub "${FrontendBucket}/dog-photos/*"` to `!Sub "${FrontendBucket.Arn}/dog-photos/*"`
2. **Updated CORS Origins**: Added both development ports (5174, 3000) to ensure compatibility

### CORS Policy Reset
**Important**: When CloudFormation manages S3 bucket CORS configuration, it replaces any manually configured CORS policies. This is expected behavior.

The template now includes the complete CORS configuration, so after successful deployment:
- ✅ CORS will be automatically configured
- ✅ No manual CORS setup needed
- ✅ Environment-specific origins (dev vs prod)

### Next Steps:
1. Deploy with: `sam deploy`
2. Verify CORS configuration is applied automatically
3. Test photo upload functionality

### Manual CORS Policy No Longer Needed
Since the CORS configuration is now in the SAM template, you should **not** manually add CORS policies to the S3 bucket. CloudFormation will manage this automatically.

If you need to modify CORS settings:
1. Update the `template.yaml` file
2. Redeploy with `sam deploy`
3. CloudFormation will apply the changes

### Troubleshooting:
If deployment still fails, check:
- AWS credentials are configured
- No bucket name conflicts
- IAM permissions for CloudFormation

### CORS Origins:
- **Production**: `https://myagilityqs.com` (AWS deployment)
- **Development**: `http://localhost:5174` (local Vite dev server)