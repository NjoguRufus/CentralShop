# Dynamic User Collection System

## Overview

The system now supports dynamic user collections based on the shop/business name. When an admin account is created, it's saved to a collection named `{ShopName}Users` (e.g., `CentralShopUsers`, `MyBusinessUsers`).

## How It Works

### 1. Admin Account Creation

When creating the first admin account via `/setup`:
- User provides: Name, Email, Password, **Shop Name**
- System creates:
  - Firebase Auth account
  - Shop document in `shops` collection
  - Admin user in `{ShopName}Users` collection (e.g., `CentralShopUsers`)

**Example:**
- Shop Name: "CentralShop"
- User Collection: `CentralShopUsers`
- Admin saved to: `CentralShopUsers/{userId}`

### 2. Subsequent User Creation

When creating employees/users after the admin:
- All users are saved to the same dynamic collection: `{ShopName}Users`
- The collection name is determined by the current user's `shopName` field
- Users are also saved to `{ShopName}Employees` for backward compatibility

### 3. User Lookup (Authentication)

When a user logs in, the system checks in this order:
1. **Dynamic User Collection** (`{ShopName}Users`) - based on default SHOP_NAME from config
2. **Old Users Collection** (`users`) - for backward compatibility
3. **Employees Collection** (`{ShopName}Employees`) - for backward compatibility

## Configuration

### Shop Name Configuration

The default shop name is set in `src/config/shopConfig.ts`:

```typescript
export const SHOP_NAME = 'CentralShop';
```

This is used as a fallback when shop name is not available.

### Dynamic Collection Name Function

```typescript
getUserCollectionName(shopId?: string, shopName?: string): string
```

- If `shopName` is provided: Returns `{shopName}Users`
- Otherwise: Returns `{SHOP_NAME}Users` (from config)

## Files Modified

1. **`src/config/shopConfig.ts`**
   - Added `getUserCollectionName()` function
   - Added `'users'` to special cases in `getShopCollectionName()`

2. **`src/utils/setupFirstAdmin.ts`**
   - Updated to use `getUserCollectionName()` 
   - Saves admin to dynamic collection: `{ShopName}Users`
   - Sets role to `mainAdmin` (first admin)

3. **`src/contexts/AuthContext.tsx`**
   - Updated to check dynamic user collection first
   - Falls back to old collections for backward compatibility

4. **`src/pages/Employees.tsx`**
   - Updated employee creation to save to dynamic user collection
   - Also saves to employees collection for backward compatibility

## Example Flow

### Creating First Admin

1. User goes to `/setup`
2. Selects "Admin" account type
3. Enters:
   - Name: "John Doe"
   - Email: "admin@centralshop.com"
   - Password: "password123"
   - Shop Name: "CentralShop"
4. System creates:
   - Firebase Auth: `admin@centralshop.com`
   - Shop: `shops/{shopId}` with name "CentralShop"
   - User: `CentralShopUsers/{userId}` with role `mainAdmin`

### Creating Employee

1. Admin goes to `/employees`
2. Clicks "Add Employee"
3. Enters employee details
4. System creates:
   - Firebase Auth: `employee@centralshop.com`
   - User: `CentralShopUsers/{userId}` (same collection as admin)
   - Employee: `CentralShopEmployees/{employeeId}` (for backward compatibility)

## Multi-Business Support

The system supports multiple businesses:

- **Business A** (Shop Name: "CentralShop")
  - Users saved to: `CentralShopUsers`
  
- **Business B** (Shop Name: "MyBusiness")
  - Users saved to: `MyBusinessUsers`

Each business has its own isolated user collection.

## Backward Compatibility

The system maintains backward compatibility:
- Still checks old `users` collection
- Still checks `employees` collection
- Existing users can still log in

## Firestore Rules

Make sure your Firestore rules allow access to the dynamic user collections:

```javascript
match /{shopName}Users/{userId} {
  allow read, write: if request.auth != null;
}
```

## Testing

1. **Create Admin:**
   - Go to `/setup`
   - Create admin with shop name "TestShop"
   - Verify user is saved to `TestShopUsers` collection

2. **Create Employee:**
   - Login as admin
   - Go to `/employees`
   - Create new employee
   - Verify employee is saved to `TestShopUsers` collection

3. **Login:**
   - Logout
   - Login with admin credentials
   - Verify user is found in `TestShopUsers` collection

## Notes

- The shop name is used to create the collection name
- Spaces in shop names are removed (e.g., "My Shop" → "MyShopUsers")
- The first admin has role `mainAdmin`
- All subsequent users are saved to the same collection as the admin
- The collection name is dynamic and depends on the business using the system

