/**
 * Draws the app icons the manifest and index.html point at: the chat bubble
 * from public/logo.svg in white on the turquoise, the way the navbar shows it.
 * Run it again after changing the logo: npm run icons
 */
const path = require('node:path');
const {chromium} = require('@playwright/test');

const BUBBLE = 'M7 3h18a5 5 0 0 1 5 5v11a5 5 0 0 1-5 5H15l-7 5v-5H7a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z';
const TURQUOISE = '#00d1b2';

/**
 * The bubble on a 512 square. `corner` rounds the square off; `scale` is how
 * big the bubble is drawn, which is 28 units wide and centred on (16, 16).
 */
function icon(corner, scale) {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="${corner}" fill="${TURQUOISE}"/>
            <path d="${BUBBLE}" fill="#fff" transform="translate(256 256) scale(${scale}) translate(-16 -16)"/>
        </svg>`;
}

// Shown as they are, so they bring their own rounded corners.
const plain = icon(112, 10.5);

// Cut to whatever shape the platform likes (Android, iOS), so they fill the
// square and keep the bubble inside the middle 80%, which every mask leaves.
const fullBleed = icon(0, 9.5);

const files = [
    {file: 'icons/icon-192.png', size: 192, svg: plain},
    {file: 'icons/icon-512.png', size: 512, svg: plain},
    {file: 'icons/maskable-512.png', size: 512, svg: fullBleed},
    {file: 'apple-touch-icon.png', size: 180, svg: fullBleed},
];

(async () => {
    const browser = await chromium.launch();

    for (const {file, size, svg} of files) {
        const page = await browser.newPage({viewport: {width: size, height: size}});
        await page.setContent(`<body style="margin: 0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
        await page.screenshot({path: path.resolve(__dirname, '..', 'public', file), omitBackground: true});
        await page.close();
        console.log('Wrote public/' + file);
    }

    await browser.close();
})();
