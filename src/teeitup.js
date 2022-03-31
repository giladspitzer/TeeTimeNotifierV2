const chromium = require('chrome-aws-lambda');
const dotenv = require('dotenv');

// exports.handler = async (event) => {
(async () => {
    dotenv.config()
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(50000);
    // await page.goto(event.url);
    // const PLAYERS = event.players;
    // const TIME = event.time
    // const DATE = event.date
    await page.goto("https://corica-park-resident.book.teeitup.golf/?course=54f14e720c8ad60378b04ff3,54f14b6f0c8ad60378b00fff&date=2022-04-01&end=12&start=05");
    const PLAYERS = 4;
    const TIME = "8:45 AM"
    const EMAIL = process.env.EMAIL
    const PASSWORD = process.env.PASSWORD

    await page.waitForSelector('[placeholder="Enter Promo"]')
    const timeAvailable = await page.evaluate((TIME) => {
        let available = false;
        document.querySelectorAll('[data-testid="teetimes-tile-time"]').forEach((e) => {
            if(e.innerText === TIME){
                available = true;
            }
        })
        return available
    }, TIME);
    if(!timeAvailable){
        await browser.close();
        return {error: 'NO TEE TIME FOUND'};
    }
    const pplAvailable = await page.evaluate((TIME) => {
        let cls = null;
        let e = document.querySelectorAll('[data-testid="teetimes-tile-time"]').forEach((e) => {
            if(e.innerText === TIME){
                cls = e.className;
            }
        })
        return document.getElementsByClassName(cls)[0].parentElement.nextElementSibling.lastElementChild.firstElementChild.lastElementChild.innerText
    }, TIME);
    if(!pplAvailable || (PLAYERS > 1 && pplAvailable[4] !== PLAYERS.toString())){
        await browser.close();
        return {error: 'PLAYER COUNT ERROR'};
    }
    await page.evaluate((TIME) => {
        let cls = null;
        let e = document.querySelectorAll('[data-testid="teetimes-tile-time"]').forEach((e) => {
            if(e.innerText === TIME){
                cls = e.className;
            }
        })
        return document.getElementsByClassName(cls)[0].parentElement.parentElement.lastElementChild.click()
    }, TIME);


    await page.waitForSelector(`[data-testid="button-value-${PLAYERS}"]`)
    await page.click(`[data-testid="button-value-${PLAYERS}"]`)
    await page.waitForSelector('[data-testid="modal-rate-proceed-to-checkout-btn"]')
    await page.click(`[data-testid="modal-rate-proceed-to-checkout-btn"]`)


    await page.waitForSelector(`#txtUsername[type="text"]`, {visible: true, timeout: 60000});
    await page.focus(`#txtUsername[type="text"]`);
    await page.type(`#txtUsername[type="text"]`, EMAIL, {delay: 100});
    await page.waitFor(1000);
    await page.waitForSelector(`#txtPassword`, {visible: true, timeout: 60000});
    await page.focus(`#txtPassword`);
    await page.type(`#txtPassword`, PASSWORD, {delay: 100})
    await page.click(`[data-testid="login-button"]`)


    await page.waitForSelector(`[data-testid="payment-options-card"]`)

        // TODO -- ADD PAYMENT


    await page.waitForSelector(`[data-testid="terms-and-conditions-checkbox"]`)
    await page.click(`[data-testid="terms-and-conditions-checkbox"]`)



    await page.waitForSelector(`[data-testid="make-your-reservation-btn"]`)
    // await page.click(`[data-testid="make-your-reservation-btn"]`)



    return page.waitForSelector(`[data-testid="confirmation-due-at-course-value"]`)
            .then(() => {
                browser.close();
                return {success: 'TEE TIME BOOKED!'};
            })
})();
