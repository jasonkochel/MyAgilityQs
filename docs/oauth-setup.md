# Google OAuth Setup Guide

This guide covers the complete setup of Google OAuth integration with AWS Cognito for MyAgilityQs.

## Overview

The Google OAuth integration allows users to sign in with their Google accounts while maintaining consistent user accounts across authentication methods (email/password and Google OAuth).

## Architecture

```
User → Google OAuth → Cognito Hosted UI → Application
     ↘                                  ↗
       Google Cloud Console ←→ AWS Cognito
```

**Key Features:**
- Account linking via email address
- Automatic user profile creation
- Seamless token management
- Production-ready security

## Part 1: Google Cloud Console Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Name it "MyAgilityQs" or similar

### Step 2: Enable Required APIs

1. Go to **APIs & Services** > **Library**
2. Search for and enable:
   - **Google+ API** (for profile information)
   - **Google Identity** (automatically enabled)

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** (unless you have Google Workspace)
3. Fill out required fields:

```
App name: MyAgilityQs
User support email: your-email@example.com
Developer contact email: your-email@example.com

App domain: (leave blank for development)
Authorized domains: (add your production domain when ready)
  - your-production-domain.com

Privacy Policy URL: (optional)
Terms of Service URL: (optional)
```

4. **Scopes**: Add these scopes
   - `openid`
   - `email` 
   - `profile`

5. **Test Users**: Add your email for testing during development

### Step 4: Create OAuth Client Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Choose **Web application**
4. Configure:

```
Name: MyAgilityQs Web Client

Authorized JavaScript origins:
  - http://localhost:5174 (for local development)
  - https://your-production-domain.com (when ready)

Authorized redirect URIs:
  - https://myagilityqs-auth.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
```

5. **Save the Client ID and Client Secret** - you'll need these for Cognito

## Part 2: AWS Cognito Configuration

### Step 1: Configure Identity Provider

1. Go to [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Navigate to User pools → `us-east-1_808uxrU8E`
3. Go to **Sign-in experience** tab
4. Scroll to **Federated identity provider sign-in**
5. Click **Add identity provider**
6. Select **Google**

### Step 2: Google Provider Settings

Configure the Google identity provider:

```
Provider name: Google
Google client ID: [YOUR_GOOGLE_CLIENT_ID from Step 1.4]
Google client secret: [YOUR_GOOGLE_CLIENT_SECRET from Step 1.4]
Authorize scopes: openid email profile

Attribute mapping:
  - Email → email ✓
  - Given name → given_name (optional)
  - Family name → family_name (optional)
```

### Step 3: Configure Cognito Domain

1. Go to **App integration** tab
2. Scroll to **Domain** section
3. If not already configured:
   - Choose **Cognito domain**
   - Enter: `myagilityqs-auth` (or your preferred prefix)
   - Click **Create**

**Your domain will be**: `https://myagilityqs-auth.auth.us-east-1.amazoncognito.com`

### Step 4: Update App Client Settings

1. Go to **App integration** tab
2. Find your app client (`31rckg6cckn32b8fsil5blhh4t`) and click **Edit**
3. Configure **Hosted UI settings**:

```
Allowed callback URLs:
  - http://localhost:5174/auth/callback (development)
  - https://your-production-domain.com/auth/callback (production)

Allowed sign-out URLs:
  - http://localhost:5174/ (development)
  - https://your-production-domain.com/ (production)

Identity providers:
  ✓ Cognito User Pool
  ✓ Google

OAuth 2.0 grant types:
  ✓ Authorization code grant

OpenID Connect scopes:
  ✓ OpenID
  ✓ Email
  ✓ Profile
```

## Part 3: Update Google OAuth Settings

Now that you have the Cognito domain, update Google Cloud Console:

### Update Redirect URIs

1. Go back to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth client
3. Under **Authorized redirect URIs**, ensure you have:
   ```
   https://myagilityqs-auth.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
   ```

## Part 4: Testing the Integration

### Test Cognito Hosted UI

1. Go to Cognito Console → App integration → App client
2. Click **View Hosted UI**
3. You should see:
   - "Sign in" button (username/password)
   - "Continue with Google" button

### Test Google Sign-In Flow

1. Click "Continue with Google"
2. Should redirect to Google login
3. After Google authentication, should redirect back to your callback URL
4. Should receive authorization code in URL parameters

### Test API Endpoints

```bash
# Test getting Google login URL
curl https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com/auth/google/login

# Should return:
{
  "loginUrl": "https://myagilityqs-auth.auth.us-east-1.amazoncognito.com/login?client_id=..."
}
```

## Part 5: Production Configuration

### Update Environment Variables

**Lambda Environment**:
```bash
FRONTEND_URL=https://your-production-domain.com
COGNITO_USER_POOL_ID=us-east-1_808uxrU8E
COGNITO_CLIENT_ID=31rckg6cckn32b8fsil5blhh4t
```

**Client Environment**:
```bash
# client/.env.production
VITE_API_URL=https://lsuz1b0sgj.execute-api.us-east-1.amazonaws.com
```

### Update OAuth URLs

1. **Google Cloud Console**: Add production domain to authorized origins and redirect URIs
2. **Cognito**: Add production callback URLs to app client settings

## Troubleshooting

### Common Issues

**"redirect_uri_mismatch" Error**:
- Verify redirect URI matches exactly in both Google and Cognito
- Check for trailing slashes, http vs https

**"invalid_client" Error**:
- Verify Client ID and Secret are correct in Cognito
- Check that Google API is enabled

**"scope" Error**:
- Ensure scopes match between Google, Cognito, and app
- Standard scopes: `openid email profile`

**Users Not Created in Database**:
- Check Lambda logs for errors during callback processing
- Verify DynamoDB permissions
- Check that email attribute is being mapped correctly

### Debug Mode

**Enable Debug Logging**:
```typescript
// In server code, temporarily add:
console.log('OAuth callback received:', event.body)
console.log('Google user info:', userInfo)
```

**Check CloudWatch Logs**:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/MyAgilityQs-HandleHttpRequest \
  --filter-pattern "OAuth"
```

## Security Considerations

### Production Security

1. **Client Secret Protection**: Never expose in client-side code
2. **HTTPS Only**: All OAuth redirects must use HTTPS in production
3. **Origin Validation**: Limit authorized origins to your domains only
4. **Token Expiration**: JWT tokens expire in 90 days (configurable)

### Account Linking Security

- Users are linked by email address
- Same user can use both Google and password authentication
- Database stores single user record regardless of auth method
- No duplicate accounts for same email

## Maintenance

### Rotating Client Secrets

1. Generate new secret in Google Cloud Console
2. Update secret in Cognito identity provider
3. No client-side changes needed (secret not exposed)

### Monitoring OAuth Usage

```bash
# Monitor Google OAuth usage
aws logs filter-log-events \
  --log-group-name /aws/lambda/MyAgilityQs-HandleHttpRequest \
  --filter-pattern "google"

# Check for OAuth errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/MyAgilityQs-HandleHttpRequest \
  --filter-pattern "ERROR.*oauth"
```

## Implementation Details

### Code Flow

1. **Frontend**: User clicks "Continue with Google"
2. **API Call**: `GET /auth/google/login` returns Cognito Hosted UI URL
3. **Redirect**: User redirected to Google via Cognito
4. **Google Auth**: User authenticates with Google
5. **Callback**: Google redirects to Cognito, then to `/auth/callback`
6. **Token Exchange**: `POST /auth/google/callback` exchanges code for tokens
7. **User Creation**: Backend creates/updates user profile in database
8. **Login Complete**: Frontend stores tokens and redirects to app

### Database Integration

**User Profile Creation**: When Google user signs in for first time:
```typescript
{
  PK: "USER#google-user-123",
  SK: "PROFILE", 
  email: "user@gmail.com",
  username: "User Name",
  cognitoSub: "google_12345...",
  createdAt: "2025-06-19T...",
  trackQsOnly: false  // Default preference
}
```

**Account Linking**: Same email can authenticate via multiple methods:
- Password users can later use Google OAuth
- Google users can later add password authentication
- Single user profile maintained regardless of auth method

This completes the Google OAuth setup. The integration provides a seamless authentication experience while maintaining security and user account consistency.