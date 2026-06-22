# Playwright Tests - ZPos

## Setup

1. **Install dependencies** (already done):
```bash
npm install
```

2. **Create test credentials** in Supabase:
- Email: `admin@test.com`
- Password: `admin123`
- Or update `.env.test.local` with your test credentials

3. **Copy test environment**:
```bash
cp .env.test .env.test.local
# Edit .env.test.local with real test credentials
```

## Running Tests

### Local Development

```bash
# Run all tests (headless)
npm test

# Run with UI mode (interactive)
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed

# Debug specific test
npm run test:debug tests/auth.spec.ts

# View test report
npm run test:report
```

### CI/CD (GitHub Actions)

Tests run automatically on push/PR to `main`, `master`, or `dev` branches.

**Required GitHub Secrets:**
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Test Structure

```
tests/
├── auth.spec.ts      # Login, logout tests
├── kasir.spec.ts     # POS/cashier flow tests
├── produk.spec.ts    # Product CRUD tests
└── README.md         # This file
```

## Writing Tests

### Add data-testid attributes to components

For easier testing, add `data-testid` attributes to key elements:

```tsx
// Example: Product item
<div data-testid="product-item" onClick={handleClick}>
  <h3>{product.nama}</h3>
  <button data-testid="add-to-cart">Tambah</button>
</div>

// Example: Cart count
<span data-testid="cart-count">{cartItems.length}</span>

// Example: Edit/Delete buttons
<button data-testid="edit-product">Edit</button>
<button data-testid="delete-product">Hapus</button>
```

### Test best practices

- Use `data-testid` for stable selectors (better than text/class)
- Wait for elements with `toBeVisible()` timeouts
- Clean up test data after each run
- Use `beforeEach` for common setup (login)
- Test user flows, not implementation details

## Next Steps

1. ✅ Tests created - need to add `data-testid` attributes to components
2. Create test user in Supabase
3. Configure GitHub secrets for CI/CD
4. Run tests locally to verify selectors match actual HTML
5. Add more test cases (laporan, barcode scanning, etc.)

## Notes

- Tests currently use placeholder selectors
- Update selectors after inspecting actual component HTML
- Consider creating a test database/tenant for isolation
- Face login tests can be added later with mock camera API
