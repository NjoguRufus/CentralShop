AI POS System – Project Guide

This document explains every page, its purpose, and the key components used across the app. It also outlines the core architecture so you can extend or maintain the system.

Overview

- Tech stack: React + TypeScript, Vite, Tailwind CSS, Firebase (Auth + Firestore), Cloudinary (media), react-router-dom.
- Structure highlights:
  - `src/pages/*`: App pages (routes)
  - `src/components/*`: Shared UI and feature components
  - `src/contexts/*`: Global state (Auth, Theme, Notifications)
  - `src/hooks/*`: Reusable hooks for data and settings
  - `src/config/*`: Third-party service configuration (Firebase, Cloudinary)



Pages

Login (`src/pages/Login.tsx`)
- Purpose: Sign in existing users via Firebase Auth.
- Key actions:
  - Validates user credentials and initializes `AuthContext`.
  - Redirects to the appropriate route after authentication.
- Components: `AuthForm`, `Card`, `FormInput`, `Button`.

Setup (`src/pages/Setup.tsx`)
- Purpose: First-time shop setup (creating initial admin/shop metadata).
- Key actions:
  - Persists initial shop settings under `shops/{shopId}`.
  - May initialize sample data for a smoother first run.
- Components: `Card`, `FormInput`, `Button`.

Developer Dashboard (`src/pages/DeveloperDashboard.tsx`)
- Purpose: Internal tools for the `astraronix` role.
- Key actions:
  - Utilities to seed sample data, manage admin claims, or debug state.
- Components: `Card`, `Button`.

Dashboard (`src/pages/Dashboard.tsx`)
- Purpose: High-level business overview.
- Key features:
  - Summary cards (sales, expenses, customers, inventory status).
  - “View past revenue” via modal with date filtering (day/week/month/year/custom).
  - Theming-aware UI for light/dark modes.
- Components: `Card`, `StatsCard`, `SalesChart`, `Button`, `DateInput`, `Select`, `Modal`.

Inventory (`src/pages/Inventory.tsx`)
- Purpose: Manage products/stock.
- Key features:
  - Add/edit products with image upload (drag-and-drop).
  - Low/out-of-stock highlighting.
  - Optional auto-fill using image scanning service (frontend prepared; endpoint can analyze images to pre-fill fields).
- Components: `Card`, `Table`, `FormInput`, `Button`, `Modal`, `AvatarUpload`.
- Firestore: `shops/{shopId}/products/*`.

POS (`src/pages/POSSystem.tsx`)
- Purpose: Point-of-Sale screen for processing orders.
- Key features:
  - Cart, checkout flow, payment method selection.
- Components: `Card`, `Table`, `Button`, `CheckoutModal`, `ReceiptPrinter`.
- Firestore: `shops/{shopId}/orders/*`.

Customers (`src/pages/Customers.tsx`)
- Purpose: Manage customers.
- Key features:
  - Add/edit customer profiles.
  - List and search.
- Components: `Card`, `Table`, `FormInput`, `Button`, `Modal`.
- Firestore: `shops/{shopId}/customers/*`.

Orders (`src/pages/Orders.tsx`)
- Purpose: View/filter orders.
- Key features:
  - Status and category filters (custom `Select`), inline category create.
  - Displays order date column.
- Components: `Card`, `Table`, `Select`, `FormInput`, `Button`.
- Firestore:
  - Orders: `shops/{shopId}/orders/*`
  - Categories: `shops/{shopId}/orderCategories/*`

Invoicing (`src/pages/Invoicing.tsx`)
- Purpose: Create and manage invoices.
- Key features:
  - Themed date selection with `DateInput`.
  - Tracks totals and status.
- Components: `Card`, `FormInput`, `DateInput`, `Button`, `Modal`.
- Firestore: `shops/{shopId}/invoices/*`.

Suppliers (`src/pages/Suppliers.tsx`)
- Purpose: Manage suppliers.
- Key features:
  - Add/edit suppliers with status selector (custom `Select`).
- Components: `Card`, `Table`, `FormInput`, `Select`, `Button`, `Modal`.
- Firestore: `shops/{shopId}/suppliers/*`.

Expenses (`src/pages/Expenses.tsx`)
- Purpose: Track business expenses and categories.
- Key features:
  - Create/edit/delete expenses.
  - Manage expense categories, including inline “Add new category”.
  - Revenue minus Expenses container: computes net for selected period with `Select` + `DateInput`.
- Components: `Card`, `Table`, `FormInput`, `Select`, `DateInput`, `Button`, `Modal`.
- Firestore:
  - Expenses: `shops/{shopId}/expenses/*`
  - Categories: `shops/{shopId}/expenseCategories/*`

Services (`src/pages/Services.tsx`)
- Purpose: Manage services and bookings.
- Key features:
  - Create services and schedule bookings.
  - Uses themed `Select` and `TimeInput` for UX consistency.
- Components: `Card`, `FormInput`, `Select`, `TimeInput`, `Button`, `Modal`.
- Firestore:
  - Services: `shops/{shopId}/services/*`
  - Bookings: `shops/{shopId}/serviceBookings/*`

Stock Reports (`src/pages/StockReports.tsx`)
- Purpose: Configure and view stock-related summaries.
- Key features:
  - Report type and period via custom `Select`.
  - Custom ranges via themed `DateInput`.
- Components: `Card`, `Select`, `DateInput`, `Button`.
- Firestore: `shops/{shopId}/stockReports/*`

Employees (`src/pages/Employees.tsx`)
- Purpose: Manage employees and roles.
- Key features:
  - List/filter employees.
  - Role/status pickers via custom `Select`.
- Components: `Card`, `Table`, `Select`, `FormInput`, `Button`, `Modal`.
- Firestore: `users/*` (scoped reads; see rules)

Settings (`src/pages/Settings.tsx`)
- Purpose: Configure business info, theme, payments, and other system options.
- Key features:
  - Business info (logo/name), theme (light/dark/primary color), payment settings.
- Components: `Card`, `FormInput`, `Select`, `DateInput`, `Button`, `Modal`, `ConfirmationModal`.
- Firestore: `shops/{shopId}/settings/*`


Shared Components

Layout (`src/components/Layout/*`)
- `Layout.tsx`: Shell containing `Sidebar`, `Header`, routed `Outlet`, notifications and profile modal.
- `Header.tsx`: Top bar with actions (menu, profile, notifications) and theming.
- `Sidebar.tsx`: Navigation menu, role-aware links.

Modals and dialogs
- `Modal.tsx`: Base modal with theme-aware styling.
- `ConfirmationModal.tsx`: Confirm actions with consistent UI.
- `ProfileModal.tsx`: View/update profile details.
- `CheckoutModal.tsx`: Finalize POS orders (payment, confirmation).

Themed UI inputs (`src/components/UI/*`)
- `Button.tsx`: Button variants, primary/outline styles.
- `Card.tsx`: Elevated container, dark-mode contrast tuned.
- `FormInput.tsx`: Text/number/color inputs with consistent styling.
- `Select.tsx`: Custom dropdown with keyboard/mouse support, optional “Add new…” action.
- `DateInput.tsx`: Themed date picker, dark/light mode friendly.
- `TimeInput.tsx`: Themed time picker with 15-min steps.
- `Table.tsx`: Simple, responsive table for lists.

Other feature components
- `AvatarUpload.jsx`: Image uploader (drag-and-drop), used e.g. for products or profile.
- `ReceiptPrinter.tsx`: Print-friendly receipt for POS orders.


Contexts

- `AuthContext.tsx`: Auth state and current user profile. Exposes `user` (Firebase Auth) and `currentUser` (user doc with role + `shopId`).
- `ThemeContext.tsx`: Global theme (light/dark) and primary color.
- `NotificationContext.tsx`: Trigger in-app toasts/notifications.


Hooks

- `useAuth.ts`: Access `AuthContext` values safely in components.
- `useTheme.ts`: Access and set the current theme.
- `usePaymentSettings.ts`: Convenience hook to read payment-related settings.
- `useCustomerLookup.ts`: Search/find customers.


Config and Services

- `config/firebase.ts`: Initializes Firebase app, exports `db` (Firestore) and Auth references.
- `config/cloudinary.ts`: Cloudinary upload configuration.
- `utils/*`: Setup and data utilities (e.g., seeding admins/products, debug helpers).


Firestore Data Model (high level)

- `shops/{shopId}` (metadata)
- `shops/{shopId}/settings/{docId}`
- `shops/{shopId}/products/{productId}`
- `shops/{shopId}/orders/{orderId}`
- `shops/{shopId}/customers/{customerId}`
- `shops/{shopId}/suppliers/{supplierId}`
- `shops/{shopId}/expenses/{expenseId}`
- `shops/{shopId}/expenseCategories/{categoryId}`
- `shops/{shopId}/orderCategories/{categoryId}`
- `shops/{shopId}/services/{serviceId}`
- `shops/{shopId}/serviceBookings/{bookingId}`
- `shops/{shopId}/stockReports/{reportId}`
- `users/{uid}`

See `firestore.rules` for access constraints (currently permissive for signed-in reads/writes in most collections during testing).


Theming & Styling

- Tailwind classes with dark-mode variants are used throughout.
- Global dark-mode improvements in `src/index.css` ensure good text contrast and preserve accent colors. Status badges can use `badge-text-dark` for legibility on colored backgrounds.


Run & Build

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build` then serve `dist/`

If you use Cloudinary or other external services, ensure environment variables and configurations are set in your environment (see `config/*`).


Extending the System

- Add a page: create a component under `src/pages/`, add a route in `src/App.tsx`, and link in `Sidebar.tsx` if needed.
- Add a collection: follow existing Firestore patterns (shop-scoped subcollections), update rules, and build a themed UI with the shared components.



