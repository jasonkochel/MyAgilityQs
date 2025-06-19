# Google OAuth Setup for MyAgilityQs

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Name it "MyAgilityQs" or similar

## Step 2: Enable Google+ API

1. Go to **APIs & Services** > **Library**
2. Search for "Google+ API"
3. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** (unless you have Google Workspace)
3. Fill out the required fields:
   - **App name**: MyAgilityQs
   - **User support email**: your-email@example.com
   - **Developer contact email**: your-email@example.com
   - **App domain**: Leave blank for now (we'll add production domain later)
   - **Authorized domains**: Add your domain when you have one

## Step 4: Create OAuth Client ID

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Choose **Web application**
4. Configure:
   - **Name**: MyAgilityQs Web Client
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (for local development)
     - Add your production domain later
   - **Authorized redirect URIs**:
     - `https://your-cognito-domain.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
     - We'll get this URL from Cognito setup

## Step 5: Save Credentials

1. Copy the **Client ID** and **Client Secret**
2. We'll need these for Cognito configuration

## Important Notes

- Keep the Client Secret secure
- The redirect URI must match exactly what Cognito expects
- We'll update the authorized domains when we deploy to production
