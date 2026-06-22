# Testing Guide - ZPos

## Quick Start

```bash
# Run all tests
npm test

# Interactive mode (recommended for development)
npm run test:ui

# See browser while testing
npm run test:headed

# Debug a specific test
npm run test:debug tests/auth.spec.ts
```

## Test Coverage

✅ **Implemented:**
- Authentication (login, invalid credentials)
- Kasir/POS (add to cart, payment flow)
- Produk management (CRUD operations)

📋 **TODO:**
1. Add `data-testid` attributes to components
2. Create test user in Supabase (`admin@test.com`)
3. Update selectors after inspecting actual HTML
4. Add laporan/reports tests
5. Add barcode scanning tests
6. Test offline functionality (PWA)

## Component Updates Needed

To make tests more reliable, add these `data-testid` attributes:

### Kasir page
```tsx
// Product list item
<div data-testid="product-item">

// Cart count badge
<span data-testid="cart-count">

// Payment buttons
<button data-testid="payment-tunai">
<button data-testid="payment-qris">
<button data-testid="payment-transfer">
```

### Produk page
```tsx
// Action buttons
<button data-testid="edit-product">
<button data-testid="delete-product">

// Form inputs (already have name attributes, but for consistency)
<input data-testid="product-name" name="nama">
<input data-testid="product-price" name="harga">
<input data-testid="product-stock" name="stok">
```

## CI/CD Setup

Tests run automatically on GitHub Actions. Need to set these secrets in repo settings:

- `TEST_USER_EMAIL` = admin@test.com
- `TEST_USER_PASSWORD` = admin123
- `NEXT_PUBLIC_SUPABASE_URL` = (your Supabase URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your Supabase anon key)

## Running Specific Tests

```bash
# Single file
npx playwright test tests/auth.spec.ts

# Single test case
npx playwright test -g "should login with valid credentials"

# By tag (if you add test.describe tags)
npx playwright test --grep @smoke
```

## Debugging Tips

1. Use `--headed` to see the browser
2. Use `--debug` for step-by-step execution
3. Add `await page.pause()` in test code for breakpoint
4. Check `playwright-report/` for screenshots on failure

## Next Steps

1. Run tests locally to see which selectors need updating
2. Add missing `data-testid` attributes
3. Create test database or tenant for isolated testing
4. Expand test coverage (laporan, settings, etc.)
