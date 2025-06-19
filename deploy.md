# MyAgilityQs Production Deployment Guide

## 🚀 Production Deployment Steps

### Prerequisites
- AWS CLI configured with appropriate permissions
- SAM CLI installed
- Domain `myagilityqs.com` registered in Route 53

### 1. Build and Deploy Infrastructure

```bash
# Deploy to production (creates all AWS resources)
npm run deploy:prod
```

This will create:
- ✅ Route 53 Hosted Zone for myagilityqs.com
- ✅ SSL Certificate (ACM) with DNS validation
- ✅ S3 Bucket for frontend
- ✅ CloudFront Distribution with custom domain
- ✅ Lambda function + API Gateway
- ✅ DynamoDB table
- ✅ All DNS records

### 2. Domain Setup

After the first deployment, you'll need to:

1. **Update Domain Name Servers**: 
   - Go to Route 53 in AWS Console
   - Copy the 4 name servers from the hosted zone
   - Update your domain registrar to use these name servers

2. **Wait for DNS Propagation**: This can take 24-48 hours

3. **Certificate Validation**: The SSL certificate will auto-validate via DNS

### 3. Deploy Frontend

```bash
# Build and upload frontend to S3 + invalidate CloudFront
npm run deploy:frontend
```

### 4. Update Google OAuth

Update your Google OAuth configuration:
- **Authorized JavaScript origins**: Add `https://myagilityqs.com`
- **Authorized redirect URIs**: Add `https://myagilityqs.com/auth/callback`

## 🔧 Development vs Production

### Development
```bash
npm run deploy:dev    # Uses localhost CORS
```

### Production
```bash
npm run deploy:prod   # Uses myagilityqs.com domain
```

## 📊 Stack Outputs

After deployment, get important URLs:

```bash
# Get all stack outputs
aws cloudformation describe-stacks --stack-name my-agility-qs --query 'Stacks[0].Outputs'

# Get just the website URL
aws cloudformation describe-stacks --stack-name my-agility-qs --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' --output text
```

## 🔄 Updates

### Backend Updates (Lambda/API)
```bash
npm run deploy:prod
```

### Frontend Updates
```bash
npm run deploy:frontend
```

### Full Stack Update
```bash
npm run deploy:prod && npm run deploy:frontend
```

## 📝 Environment Configuration

The stack automatically configures:
- **Production**: Uses `https://myagilityqs.com` for CORS
- **Development**: Uses `http://localhost:5174` for CORS
- **Database**: Separate tables (`MyAgilityQs` vs `MyAgilityQs-Dev`)

## 🚨 Important Notes

1. **Certificate Creation**: First deployment takes ~5-10 minutes for SSL certificate
2. **DNS Propagation**: Full DNS propagation can take 24-48 hours
3. **CloudFront**: Cache invalidation can take 5-15 minutes
4. **Cognito**: Uses existing user pool (shared between dev/prod)

## 🛠 Troubleshooting

### Certificate Issues
```bash
# Check certificate status
aws acm list-certificates --region us-east-1
```

### DNS Issues
```bash
# Check hosted zone
aws route53 list-hosted-zones
```

### Frontend Not Loading
```bash
# Check S3 bucket contents
aws s3 ls s3://myagilityqs-frontend/

# Check CloudFront distribution
aws cloudfront list-distributions
```