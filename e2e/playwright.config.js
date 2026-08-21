// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // shared H2 file DB across the whole e2e run - keep it serial
  workers: 1,
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:8099',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Boots the real Spring Boot app on the isolated 'e2e' profile (separate
  // H2 file DB + port 8099, see application-e2e.properties) so these specs
  // never touch a developer's own dev instance or its data.
  webServer: {
    command: '../mvnw -q -f ../pom.xml spring-boot:run -Dspring-boot.run.profiles=e2e',
    url: 'http://localhost:8099/api/nominations',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
