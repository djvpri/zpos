import { test, expect } from '@playwright/test';

test.describe('Kasir/POS', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    
    const email = process.env.TEST_USER_EMAIL || 'admin@test.com';
    const password = process.env.TEST_USER_PASSWORD || 'admin123';
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/\/(dashboard|kasir)/);
  });

  test('should navigate to kasir page', async ({ page }) => {
    await page.goto('/app');
    
    // Check kasir elements (default page after login)
    await expect(page.getByTestId('product-item').first()).toBeVisible({ timeout: 10000 });
  });

  test('should add product to cart', async ({ page }) => {
    await page.goto('/app');
    
    // Wait for products to load then click first product
    const firstProduct = page.getByTestId('product-item').first();
    await expect(firstProduct).toBeVisible({ timeout: 10000 });
    await firstProduct.click();
    
    // Check if cart has items (mobile floating cart badge)
    const cartCount = page.getByTestId('cart-count');
    await expect(cartCount).toBeVisible();
    await expect(cartCount).toHaveText('1');
  });

  test('should process payment', async ({ page }) => {
    await page.goto('/kasir');
    
    // Add product to cart
    const firstProduct = page.locator('[data-testid="product-item"]').first();
    await firstProduct.click();
    
    // Click bayar button
    await page.click('text=/bayar|pay/i');
    
    // Select payment method (Tunai)
    await page.click('text=/tunai|cash/i');
    
    // Confirm payment
    await page.click('button:has-text("Proses")');
    
    // Should show success message or receipt
    await expect(page.locator('text=/berhasil|success|struk/i')).toBeVisible({ timeout: 5000 });
  });
});
