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
    await page.goto("https://the-course-at-wente-vineyards.book.teeitup.com/?course=54f14b650c8ad60378b00f3e&date=2022-04-21");
    const PLAYERS = 4;
    const TIME = "3:20 PM"
    const EMAIL = process.env.EMAIL
    const PASSWORD = process.env.PASSWORD

    await page.waitForSelector('[placeholder="Enter Promo"]')
    const rankOnPage = await page.evaluate((TIME) => {
        let available = -1;
        let elements = document.querySelectorAll('[data-testid="teetimes-tile-time"]');
        for(let i = 0; i < elements.length; i++){
            if(elements[i].innerText === TIME){
                available = i;
            }
        }
        return available
    }, TIME);
    if(rankOnPage < 0){
        await browser.close();
        return {error: 'NO TEE TIME FOUND'};
    }
    const pplAvailable = await page.evaluate((TIME, rankOnPage) => {
        return document.querySelectorAll('[data-testid="teetimes-tile-available-players"]')[rankOnPage].innerText
    }, TIME, rankOnPage);
    if(!pplAvailable || !pplAvailable.includes(PLAYERS.toString())){
        await browser.close();
        return {error: 'PLAYER COUNT ERROR'};
    }
    await page.evaluate((TIME, rankOnPage) => {
        let rateBtns = document.querySelectorAll('[data-testid="teetimes_choose_rate_button"]')
        let buyBtns = document.querySelectorAll('[data-testid="teetimes_book_now_button"]')
        let cls = null
        if(rateBtns.length > 0){
            cls = rateBtns[0].classList[0];
        }else{
            cls = buyBtns[0].classList[0];
        }
        let teeTime = document.getElementsByClassName(cls)[rankOnPage]
        teeTime.click();
    }, TIME, rankOnPage);


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



    // return page.waitForSelector(`[data-testid="confirmation-due-at-course-value"]`)
    //         .then(() => {
    //             browser.close();
    //             return {success: 'TEE TIME BOOKED!'};
    //         })
})();
