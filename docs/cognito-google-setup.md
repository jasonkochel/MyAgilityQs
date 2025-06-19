# AWS Cognito Google OAuth Setup Guide

## Your Current Cognito Configuration

- **User Pool ID**: `us-east-1_808uxrU8E`
- **Region**: `us-east-1`
- **Client ID**: `31rckg6cckn32b8fsil5blhh4t` (from previous setup)

## Step 1: Configure Google Identity Provider in Cognito

### 1.1 Go to AWS Cognito Console

1. Navigate to [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Select **User pools**
3. Find and click on your User Pool: `us-east-1_808uxrU8E`

### 1.2 Add Google as Identity Provider

1. Click **Sign-in experience** tab
2. Scroll down to **Federated identity provider sign-in**
3. Click **Add identity provider**
4. Select **Google**

### 1.3 Configure Google Provider Settings

Fill in the following:

- **Provider name**: `Google` (this will be used in API calls)
- **Google client ID**: `[YOUR_GOOGLE_CLIENT_ID from Step 1]`
- **Google client secret**: `[YOUR_GOOGLE_CLIENT_SECRET from Step 1]`
- **Authorize scopes**: `openid email profile`
- **Attribute mapping**:
  - Email → email
  - Given name → given_name (optional)
  - Family name → family_name (optional)

### 1.4 Configure Cognito Domain (Required for OAuth)

1. Go to **App integration** tab
2. Scroll to **Domain**
3. If you don't have a domain, create one:
   - Choose **Cognito domain**
   - Enter a unique domain prefix (e.g., `myagilityqs-auth`)
   - Click **Create**
4. **Save this domain URL** - you'll need it for Google OAuth setup

Your Cognito domain will be: `https://[your-prefix].auth.us-east-1.amazoncognito.com`

### 1.5 Update App Client Settings

1. Go to **App integration** tab
2. Find your app client and click **Edit**
3. Under **Hosted UI settings**:
   - **Allowed callback URLs**: Add your frontend URLs
     - `http://localhost:5173/auth/callback` (development)
     - `https://your-production-domain.com/auth/callback` (production)
   - **Allowed sign-out URLs**: Add your frontend URLs
     - `http://localhost:5173/` (development)
     - `https://your-production-domain.com/` (production)
   - **Identity providers**: Check both `Cognito User Pool` and `Google`
   - **OAuth flows**: Check `Authorization code grant`
   - **OAuth scopes**: Check `openid`, `email`, `profile`

## Step 2: Update Google OAuth Settings

Now go back to Google Cloud Console and update your OAuth client:

### 2.1 Update Redirect URIs

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth client
3. Under **Authorized redirect URIs**, add:
   - `https://[your-cognito-domain].auth.us-east-1.amazoncognito.com/oauth2/idpresponse`

## Step 3: Test the Configuration

### 3.1 Test Hosted UI

1. Go to Cognito Console → App integration → App client
2. Click **View Hosted UI**
3. You should see both "Sign in" and "Continue with Google" options
4. Test Google sign-in to verify the connection works

### 3.2 Test URL Format

The hosted UI URL will look like:

```
https://[your-domain].auth.us-east-1.amazoncognito.com/login?client_id=31rckg6cckn32b8fsil5blhh4t&response_type=code&scope=openid+email+profile&redirect_uri=http://localhost:5173/auth/callback
```

## Important URLs to Save

- **Cognito Domain**: `https://[your-prefix].auth.us-east-1.amazoncognito.com`
- **Login URL**: `https://[your-domain].auth.us-east-1.amazoncognito.com/login`
- **OAuth URL**: `https://[your-domain].auth.us-east-1.amazoncognito.com/oauth2/authorize`

## Next Steps

After completing this setup, we'll:

1. Update the frontend to handle OAuth flows
2. Add Google sign-in button to login page
3. Handle the OAuth callback
4. Update backend to handle federated users
5. Implement account linking functionality
