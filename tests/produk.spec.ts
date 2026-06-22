import { test, expect } from '@playwright/test';

test.describe('Produk Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    
    const email = process.env.TEST_USER_EMAIL || 'admin@test.com';
    const password = process.env.TEST_USER_PASSWORD || 'admin123';
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/(dashboard|kasir)/);
  });

  test('should navigate to produk page', async ({ page }) => {
    await page.goto('/app');
    
    // Click Produk tab in sidebar
    await page.getByRole('button', { name: /produk/i }).click();
    
    // Check add product button exists
    await expect(page.getByTestId('add-product-btn')).toBeVisible();
  });

  test('should create new product', async ({ page }) => {
    await page.goto('/produk');
    
    // Click tambah button
    await page.click('text=/tambah produk|add product/i');
    
    // Fill product form
    await page.fill('input[name="nama"]', 'Test Product Playwright');
    await page.fill('input[name="harga"]', '50000');
    await page.fill('input[name="stok"]', '10');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show success message
    await expect(page.locator('text=/berhasil|success/i')).toBeVisible({ timeout: 5000 });
    
    // Product should appear in list
    await expect(page.locator('text=Test Product Playwright')).toBeVisible();
  });

  test('should edit product', async ({ page }) => {
    await page.goto('/produk');
    
    // Click edit on first product
    const editButton = page.locator('[data-testid="edit-product"]').first();
    await editButton.click();
    
    // Update product name
    const nameInput = page.locator('input[name="nama"]');
    await nameInput.fill('Updated Product Name');
    
    // Save changes
    await page.click('button[type="submit"]');
    
    // Should show success
    await expect(page.locator('text=/berhasil|success/i')).toBeVisible({ timeout: 5000 });
  });

  test('should delete product', async ({ page }) => {
    await page.goto('/produk');
    
    // Click delete on first product
    const deleteButton = page.locator('[data-testid="delete-product"]').first();
    await deleteButton.click();
    
    // Confirm deletion
    await page.click('button:has-text("Ya")');
    
    // Should show success
    await expect(page.locator('text=/berhasil|success|dihapus/i')).toBeVisible({ timeout: 5000 });
  });
});
