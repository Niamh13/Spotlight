// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

// cmd.exe mis-parses a forward-slash relative path like '../mvnw' as the
// command '..' followed by a '/mvnw' switch, so build an OS-native path and
// pick the matching wrapper script instead of hardcoding a Unix-style command.
const mvnw = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';
const mvnwPath = path.join(__dirname, '..', mvnw);
const pomPath = path.join(__dirname, '..', 'pom.xml');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // shared MySQL database across the whole e2e run - keep it serial
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
  // MySQL database + port 8099, see application-e2e.properties) so these specs
  // never touch a developer's own dev instance or its data.
  webServer: {
    command: `"${mvnwPath}" -q -f "${pomPath}" spring-boot:run -Dspring-boot.run.profiles=e2e`,
    url: 'http://localhost:8099/api/nominations',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
