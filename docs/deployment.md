# Deployment Guide

This guide covers AWS deployment, production configuration, and operational procedures for MyAgilityQs.

## Current Production Environment

### Live Services
- **API**: https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com/
- **Health Check**: https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com/health
- **Region**: us-east-1 (N. Virginia)

### AWS Resources

**Lambda Function**: `MyAgilityQs-HandleHttpRequest`
- Runtime: Node.js 22.x
- Memory: 128 MB
- Timeout: 30 seconds
- Environment: Production DynamoDB table

**DynamoDB Table**: `MyAgilityQs`
- Billing: On-demand
- GSI: GSI1 for cross-entity queries
- Backup: Point-in-time recovery enabled

**API Gateway**: HTTP API
- Custom domain: Not configured
- CORS: Enabled for all origins
- Authorization: JWT (Cognito)

**Cognito User Pool**: `us-east-1_808uxrU8E`
- Client ID: `31rckg6cckn32b8fsil5blhh4t`
- Google OAuth: Fully configured
- JWT expiration: 90 days

## Deployment Process

### Prerequisites

```bash
# AWS CLI configured
aws configure
aws sts get-caller-identity

# SAM CLI installed
sam --version

# Docker running
docker ps
```

### Server Deployment

```bash
# From server/ directory
cd server

# Build the application
npm run build

# Deploy to AWS
sam deploy --guided  # First time
sam deploy           # Subsequent deployments
```

**SAM Configuration**: `server/samconfig.toml`
```toml
[default.deploy.parameters]
stack_name = "MyAgilityQs"
s3_bucket = "aws-sam-cli-managed-default-samclisourcebucket-xxx"
s3_prefix = "MyAgilityQs"
region = "us-east-1"
confirm_changeset = true
capabilities = "CAPABILITY_IAM"
```

### Frontend Deployment

**Option 1: Static Hosting (Recommended)**

```bash
# Build for production
cd client
npm run build

# Deploy to S3 + CloudFront
aws s3 sync dist/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"
```

**Option 2: Vercel/Netlify**

```bash
# Connect GitHub repo to platform
# Set build command: npm run build
# Set publish directory: client/dist
# Set environment variables
```

## Environment Configuration

### Environment Variables

**Server (Lambda)**:
```bash
# Production
TABLE_NAME=MyAgilityQs
NODE_ENV=production
FRONTEND_URL=https://your-production-domain.com
COGNITO_USER_POOL_ID=us-east-1_808uxrU8E
COGNITO_CLIENT_ID=31rckg6cckn32b8fsil5blhh4t

# Development
TABLE_NAME=MyAgilityQs-Dev
NODE_ENV=development
FRONTEND_URL=http://localhost:5174
```

**Client (Build-time)**:
```bash
# client/.env.production
VITE_API_URL=https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com
VITE_APP_ENV=production

# client/.env.development
VITE_API_URL=http://localhost:3001
VITE_APP_ENV=development
```

### Cognito Configuration

**User Pool Settings**:
- Sign-in options: Email
- MFA: Disabled
- Password policy: Default AWS
- Account recovery: Email only

**App Client Settings**:
- Client type: Public
- Authentication flows: ALLOW_USER_SRP_AUTH, ALLOW_REFRESH_TOKEN_AUTH
- OAuth flows: Authorization code grant
- OAuth scopes: openid, email, profile
- Callback URLs: Production domain + `/auth/callback`
- Sign-out URLs: Production domain

**Hosted UI Domain**: `myagilityqs-auth.auth.us-east-1.amazoncognito.com`

## Security Configuration

### IAM Permissions

**Lambda Execution Role**: `MyAgilityQs-HandleHttpRequestRole`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem", 
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/MyAgilityQs",
        "arn:aws:dynamodb:us-east-1:*:table/MyAgilityQs/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### CORS Configuration

**API Gateway CORS**:
- Access-Control-Allow-Origin: Production domain
- Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
- Access-Control-Allow-Headers: Authorization, Content-Type

**Lambda CORS Headers**:
```typescript
{
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
}
```

## Monitoring & Observability

### CloudWatch Logs

**Log Groups**:
- `/aws/lambda/MyAgilityQs-HandleHttpRequest`
- `/aws/apigateway/MyAgilityQs`

**Log Retention**: 14 days (configurable)

### CloudWatch Metrics

**Key Metrics to Monitor**:
- Lambda duration and errors
- API Gateway 4xx/5xx errors
- DynamoDB throttled requests
- Cognito authentication failures

### Alarms

**Recommended Alarms**:
```bash
# Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name "MyAgilityQs-Lambda-Errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

## Database Management

### Backup Strategy

**Point-in-Time Recovery**: Enabled (last 35 days)
**On-Demand Backups**: Manual backups before major releases

```bash
# Create backup
aws dynamodb create-backup \
  --table-name MyAgilityQs \
  --backup-name "MyAgilityQs-$(date +%Y%m%d)"
```

### Data Migration

**Development to Production**:
```bash
# Export from dev table
aws dynamodb scan --table-name MyAgilityQs-Dev --output json > data-export.json

# Import to production (be careful!)
# Use AWS Data Pipeline or custom script
```

## Scaling Considerations

### DynamoDB Scaling
- **On-Demand**: Automatically scales, pay-per-request
- **Provisioned**: Set read/write capacity units if predictable load
- **Global Tables**: Multi-region if needed

### Lambda Scaling
- **Concurrent Executions**: Default 1000, can request increase
- **Reserved Concurrency**: Not needed for current load
- **Provisioned Concurrency**: Consider for production if cold starts become issue

### API Gateway Scaling
- **Rate Limiting**: 10,000 requests per second default
- **Throttling**: Automatic, no configuration needed
- **Caching**: Can enable response caching if needed

## Disaster Recovery

### RTO/RPO Targets
- **RTO**: 4 hours (time to recover service)
- **RPO**: 1 hour (acceptable data loss)

### Recovery Procedures

**Lambda Function Recovery**:
1. Re-deploy from last known good commit
2. Verify environment variables
3. Test health endpoint

**Database Recovery**:
1. Restore from point-in-time backup
2. Update connection strings if needed
3. Validate data integrity

**Complete Region Failure**:
1. Deploy stack to different region
2. Restore database from backup
3. Update DNS/CDN configuration
4. Update Cognito callback URLs

## Cost Optimization

### Current Cost Structure
- **Lambda**: ~$1-5/month (low usage)
- **DynamoDB**: ~$2-10/month (on-demand pricing)
- **API Gateway**: ~$1-3/month
- **Cognito**: Free tier (up to 50,000 MAUs)

### Optimization Strategies

**Lambda**:
- Use ARM64 architecture (20% cost savings)
- Optimize memory allocation
- Reduce package size

**DynamoDB**:
- Monitor unused indexes
- Optimize query patterns
- Consider provisioned capacity for steady load

**API Gateway**:
- Use HTTP API (cheaper than REST API)
- Enable compression
- Cache responses where appropriate

## Troubleshooting

### Common Production Issues

**Lambda Timeout**:
```bash
# Check CloudWatch logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/MyAgilityQs-HandleHttpRequest \
  --start-time $(date -d '1 hour ago' +%s)000
```

**DynamoDB Throttling**:
```bash
# Check metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=MyAgilityQs \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Cognito Authentication Issues**:
- Verify JWT token expiration
- Check user pool configuration
- Validate callback URLs

### Emergency Procedures

**Complete Service Outage**:
1. Check AWS Service Health Dashboard
2. Verify all environment variables
3. Re-deploy from known good state
4. Scale DynamoDB if throttling
5. Contact AWS Support if needed

**Data Corruption**:
1. Stop all writes immediately
2. Assess scope of corruption
3. Restore from last known good backup
4. Investigate root cause
5. Implement preventive measures

## Release Management

### Deployment Pipeline

**Development → Staging → Production**

1. **Feature Branch**: Development and testing
2. **Staging**: Full integration testing
3. **Production**: Monitored rollout

### Rollback Procedures

**Lambda Rollback**:
```bash
# List versions
aws lambda list-versions-by-function --function-name MyAgilityQs-HandleHttpRequest

# Rollback to previous version
aws lambda update-alias \
  --function-name MyAgilityQs-HandleHttpRequest \
  --name LIVE \
  --function-version $PREVIOUS_VERSION
```

**Database Rollback**:
- Point-in-time recovery (up to 35 days)
- Manual data fixes via admin scripts
- Schema migrations (rare)

### Health Checks

**Production Health Monitoring**:
```bash
# Automated health check
curl -f https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com/health

# Response should be:
# {"status":"healthy","timestamp":"2025-06-19T...Z"}
```