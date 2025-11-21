# Firestore Rules Update

## Changes Made

### 1. Dynamic User Collections
Added support for dynamic user collections (e.g., `CentralShopUsers`, `MyBusinessUsers`):

```javascript
// Dynamic User Collections: {ShopName}Users/{userId}
match /{shopUsers}/{userId} {
  allow read: if isSignedIn() && shopUsers.matches('.*Users$');
  allow create: if isSignedIn() && shopUsers.matches('.*Users$');
  allow update, delete: if isSignedIn() && shopUsers.matches('.*Users$');
}
```

### 2. Shop Creation During Setup
Updated shop creation rules to allow authenticated users to create shops during setup:

```javascript
match /shops/{shopId} {
  allow read: if isShopMember(shopId) || isAstraronix() || isSignedIn();
  allow create: if isSignedIn(); // Allow during setup
  allow update, delete: if isAstraronix();
}
```

### 3. Products Collection Query Support
Added `list` permission for products to support offline sync queries:

```javascript
match /{shopProducts}/{productId} {
  allow read, list: if isSignedIn() && shopProducts.matches('.*Products$');
  // ... rest of rules
}
```

## Deploying Rules

To deploy the updated rules to Firebase:

```bash
firebase deploy --only firestore:rules
```

Or use the Firebase Console:
1. Go to Firebase Console
2. Select your project
3. Go to Firestore Database
4. Click on "Rules" tab
5. Copy and paste the updated rules
6. Click "Publish"

## Testing

After deploying, test:
1. Creating admin account via `/setup`
2. Syncing products (should no longer show permission errors)
3. Creating employees
4. Reading user data

## Notes

- Rules allow authenticated users to create shops during setup
- Dynamic user collections are accessible to all authenticated users
- Products can be read and listed by authenticated users (needed for offline sync)
- These rules are permissive for development - tighten in production based on your security requirements

