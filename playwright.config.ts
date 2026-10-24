import {defineConfig, devices} from "@playwright/test";

const port = Number(process.env.PORT || 4173);
const baseURL = 'http://127.0.0.1:' + port;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['github'], ['html', {open: 'never'}]] : [['list']],
    use: {
        baseURL,
        trace: 'retain-on-failure',
        // The share link offers a copy button, and reading it back needs this.
        permissions: ['clipboard-read', 'clipboard-write'],
        // What the service worker answers never reaches page.route, so it
        // stays out of the way; pwa.spec.ts turns it back on.
        serviceWorkers: 'block',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    args: [
                        // Both peers live in this one browser, so let them
                        // exchange local addresses instead of mDNS names that
                        // nothing on a build server can resolve.
                        '--disable-features=WebRtcHideLocalIpsWithMdns',
                    ],
                },
            },
        },
    ],
    webServer: {
        // Build first: the tests are about the bundle that gets deployed.
        command: 'npm run build && node e2e/static-server.js',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
