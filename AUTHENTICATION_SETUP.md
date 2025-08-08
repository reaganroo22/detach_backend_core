# Authentication Setup Guide

## ✅ Completed Configuration

### 1. Package Installation
- ✅ `expo-apple-authentication` - Added to package.json
- ✅ `@react-native-google-signin/google-signin` - Added to package.json

### 2. App Configuration (app.json)
- ✅ `usesAppleSignIn: true` - Enables Apple Sign-In capability
- ✅ Google Sign-In plugin configured with URL scheme
- ✅ Apple Authentication plugin added

### 3. Authentication Context (AuthContext.tsx)
- ✅ Google Sign-In configured with webClientId: `853021963659-e42d9v8klqddiibodqm2bids30c3tftr.apps.googleusercontent.com`
- ✅ Apple Sign-In using native `expo-apple-authentication`
- ✅ Both methods use `supabase.auth.signInWithIdToken()` for authentication

### 4. Login Screen (LoginScreen.tsx)
- ✅ Native `AppleAuthentication.AppleAuthenticationButton` for iOS
- ✅ Native `GoogleSigninButton` for Google authentication
- ✅ Proper error handling and loading states

## 🔧 Required Supabase Dashboard Configuration

### Apple Provider Setup
1. Go to Supabase Dashboard > Authentication > Providers > Apple
2. Enable Apple provider
3. Add these Client IDs:
   - `com.temperance.app` (your main bundle ID)
   - `host.exp.Exponent` (for Expo Go testing)
   - `com.temperance.app.dev` (for development builds)
   - `com.temperance.app.preview` (for preview builds)

### Google Provider Setup  
1. Go to Supabase Dashboard > Authentication > Providers > Google
2. Enable Google provider
3. Add this Client ID:
   - `853021963659-e42d9v8klqddiibodqm2bids30c3tftr.apps.googleusercontent.com`

## 📱 Authentication Flow

### Apple Sign-In
1. User taps Apple Sign-In button
2. Native iOS authentication dialog appears
3. User authenticates with Face ID/Touch ID/Passcode
4. App receives `identityToken`
5. Token sent to Supabase via `signInWithIdToken({ provider: 'apple', token })`
6. Supabase creates/updates user session

### Google Sign-In  
1. User taps Google Sign-In button
2. Native Google Sign-In flow opens
3. User selects Google account and grants permission
4. App receives `idToken`
5. Token sent to Supabase via `signInWithIdToken({ provider: 'google', token })`
6. Supabase creates/updates user session

## 🚀 Next Steps

1. **Install Dependencies**: Run `npm install` to install new packages
2. **Configure Supabase Dashboard**: Add the Client IDs as listed above
3. **Build Development Version**: Run `eas build --profile development --platform ios`
4. **Test Authentication**: Install on device and test both sign-in methods

## 📋 Key Files Modified

- `package.json` - Added authentication packages
- `app.json` - Added plugins and iOS configuration
- `contexts/AuthContext.tsx` - Complete authentication implementation
- `components/LoginScreen.tsx` - Native authentication buttons
- `lib/supabase.ts` - Already configured correctly

## ⚠️ Important Notes

- **Expo Go Limitation**: Native authentication requires development build, won't work in Expo Go
- **iOS Only**: Apple Sign-In only works on iOS 13+ devices
- **Bundle ID Matching**: Ensure bundle ID in app.json matches your Apple Developer Console App ID
- **URL Schemes**: Google Sign-In URL scheme configured from your plist file