# SideKick Setup Guide

This guide will help you set up the SideKick MVP project with Firebase and required services.

## Prerequisites

- Node.js 18+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Google Cloud Platform account
- Stripe account (for payments)
- OpenAI API key

## 1. Firebase Project Setup

### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., "sidekick-mvp")
4. Enable Google Analytics (optional)
5. Create project

### Enable Firebase Services
1. **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google OAuth (configure OAuth consent screen)
   - Add authorized domains for your app

2. **Firestore Database**:
   - Go to Firestore Database
   - Create database in production mode
   - Choose location (us-central1 recommended)

3. **Cloud Functions**:
   - Go to Functions
   - Upgrade to Blaze plan (required for external API calls)

4. **Hosting**:
   - Go to Hosting
   - Get started and follow setup

### Configure Firebase Project
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. In your project directory: `firebase init`
4. Select:
   - Firestore
   - Functions
   - Hosting
   - Use existing project and select your Firebase project

## 2. Environment Configuration

### Frontend Environment Variables
1. Copy `.env.example` to `.env.local`
2. Fill in your Firebase config (found in Firebase console > Project settings > General > Your apps):
```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_STRIPE_PUBLIC_KEY=pk_test_your-stripe-public-key
```

### Firebase Functions Configuration
Set up function configuration (replace with your actual values):
```bash
firebase functions:config:set openai.api_key="sk-your-openai-api-key"
firebase functions:config:set stripe.secret_key="sk_test_your-stripe-secret-key"
firebase functions:config:set stripe.webhook_secret="whsec_your-webhook-secret"
firebase functions:config:set app.url="https://your-domain.com"
```

## 3. Stripe Setup

### Create Stripe Account
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create account and complete setup
3. Get your API keys from Developers > API keys

### Create Products and Prices
1. Go to Products in Stripe Dashboard
2. Create "Monthly Pro" product
3. Add price: $99/month
4. Copy the price ID (starts with `price_`)
5. Update `SUBSCRIPTION_PLANS` in `src/types/subscription.ts` with actual price ID

### Set up Webhooks
1. Go to Developers > Webhooks
2. Add endpoint: `https://your-project-id.cloudfunctions.net/handleStripeWebhook`
3. Listen to events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook secret and add to Firebase config

## 4. OpenAI API Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create account and add payment method
3. Go to API Keys and create new key
4. Add to Firebase functions config

## 5. Installation and Development

### Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install functions dependencies
cd functions
npm install
cd ..
```

### Development
```bash
# Start Firebase emulators
npm run firebase:emulators

# In another terminal, start frontend
npm run dev
```

### Build and Deploy
```bash
# Build for production
npm run build

# Deploy to Firebase
npm run firebase:deploy
```

## 6. Firestore Security Rules

The project includes security rules in `firestore.rules`. Deploy them:
```bash
firebase deploy --only firestore:rules
```

## 7. Domain Configuration

### Add Custom Domain (Optional)
1. Go to Hosting in Firebase Console
2. Add custom domain
3. Follow DNS configuration steps
4. Update `app.url` in Firebase functions config

### Update CORS Settings
Add your domain to:
- Firebase Authentication authorized domains
- Stripe webhook allowed domains

## 8. Testing

### Test Payment Flow
1. Use Stripe test card: `4242 4242 4242 4242`
2. Any future expiry date and CVC
3. Test subscription creation and cancellation

### Test OpenAI Integration
1. Create account and send messages
2. Verify responses are generated correctly
3. Test usage limits for free tier

## 9. Monitoring and Analytics

### Firebase Analytics
1. Enable Google Analytics in Firebase Console
2. View user metrics in Analytics dashboard

### Error Monitoring
1. Check Firebase Functions logs
2. Monitor Stripe webhook delivery
3. Review OpenAI usage in OpenAI dashboard

## 10. Security Checklist

- [ ] Enable App Check for production
- [ ] Set up proper CORS origins
- [ ] Configure Firebase Security Rules
- [ ] Enable 2FA for all service accounts
- [ ] Set up proper IAM permissions
- [ ] Use environment variables for secrets
- [ ] Enable webhook signature verification

## Troubleshooting

### Common Issues
1. **Firebase emulators not starting**: Check port conflicts
2. **OpenAI API errors**: Verify API key and billing setup
3. **Stripe webhook failures**: Check endpoint URL and secret
4. **Authentication errors**: Verify OAuth configuration

### Development Tips
- Use Firebase emulators for local development
- Test with Stripe CLI for webhook testing
- Monitor Firebase Functions logs for debugging
- Use React DevTools for frontend debugging

## Support

For issues:
1. Check Firebase Console for errors
2. Review function logs
3. Check Stripe Dashboard for payment issues
4. Review OpenAI usage dashboard

## Next Steps

After MVP setup:
1. Add more AI models (Claude, Gemini)
2. Implement browser extension
3. Add document processing
4. Implement usage analytics
5. Add enterprise features