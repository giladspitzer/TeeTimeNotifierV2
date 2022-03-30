const chromium = require('chrome-aws-lambda');
// const dotenv = require('dotenv');


exports.handler = async (event) => {
    // dotenv.config()
      const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.goto(event.url);

    const PLAYERS = event.players;
    const EMAIL = process.env.EMAIL
    const PASSWORD = process.env.PASSWORD
    let players_available = (await page.$$(`input[value="${PLAYERS}"]`)).length === 1
    if (!players_available) {
        // await browser.close();
        return {error: 'PLAYER COUNT ERROR'};
    }
    await page.click(`input[value="${PLAYERS}"]`)
    await page.click('.be_details_checkout_btn')

    await page.waitForSelector('#EmailAddress');
    await page.waitForSelector('#Password');
    await page.evaluate((EMAIL, PASSWORD) => {
        document.getElementById('EmailAddress').value = EMAIL
        document.getElementById('Password').value = PASSWORD
    }, EMAIL, PASSWORD)
    await page.click('button[type="submit"]');


    await page.waitForSelector('#submitButton', {visible: true, timeout: 60000});
    await page.evaluate(() => {
        document.getElementById('submitButton').click()
    })

    page.waitForSelector('.be_confirm_details_col1')
        .then(() => {
            // browser.close();
            return {success: 'TEE TIME BOOKED!'};
        })
};
