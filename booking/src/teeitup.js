const chromium = require('chrome-aws-lambda');
const dotenv = require('dotenv');
const AWS = require("aws-sdk");
const Sentry = require("@sentry/serverless");
Sentry.AWSLambda.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(async (event) => {
    dotenv.config()
    const browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
    });
    const s3 = new AWS.S3();
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(50000);
    process.on('unhandledRejection', async (err) => {
        console.error(err)
        if (process.env.ENV === 'prod') {
            const screenshot = await page.screenshot({
                path: `${Date.now()}_teeitup.png`,
                fullPage: true
            })
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: `${Date.now().toString()}_teeitup.png`,
                Body: screenshot
            };
            await s3.putObject(params).promise()
            await browser.close()
        }
    });
    const PLAYERS = event.players;
    const START = event.start
    const END = event.end
    const DATE = event.date
    const COURSE_ID = event.courseId

    const makeURL = () => {
        let url = event.url
        url += `?course=${COURSE_ID}`;
        url += `&date=${DATE.split('/')[2]}-${DATE.split('/')[0]}-${DATE.split('/')[1]}`
        url += `&holes=18`
        url += `&golfers=${PLAYERS}`
        return url
    }
    let url = makeURL()
    await page.goto(url);
    const EMAIL = process.env.EMAIL
    const PASSWORD = process.env.PASSWORD
    const PHONE = process.env.PHONE
    const CARD = {
        num: process.env.CREDIT_CARD_NUM,
        month: process.env.CREDIT_CARD_EXP_MONTH,
        year: process.env.CREDIT_CARD_EXP_YEAR,
        cvv: process.env.CREDIT_CARD_CVV,
        zipCode: process.env.CREDIT_CARD_ZIP,
        addr: process.env.CREDIT_CARD_ADDR,
        name: process.env.CREDIT_CARD_NAME,
        country: process.env.CREDIT_CARD_COUNTRY
    }
    await page.waitForSelector('[placeholder="Enter Promo"]')
    const rankOnPage = await page.evaluate((start, end) => {
        const transformTimeToInt = (timeString) => {
            let total = 0;
            if (parseInt(timeString.split(':')[0]) !== 12) {
                total += (parseInt(timeString.split(':')[0]) * 60)
            }
            total += (parseInt(timeString.split(':')[1].split(" ")[0]))
            if (timeString.split(" ")[1] === "PM") {
                total += 720;
            }
            return total
        }
        const start_int = transformTimeToInt(start)
        const end_int = transformTimeToInt(end)
        let elements = document.querySelectorAll('[data-testid="teetimes-tile-time"]');
        for (let i = 0; i < elements.length; i++) {
            let time = transformTimeToInt(elements[i].innerText)
            if (time >= start_int && time <= end_int) {
                return i
            }
        }
        return -1
    }, START, END);
    if (rankOnPage < 0) {
        console.log('NO TEE TIME FOUND')
        await browser.close();
        return {error: 'NO TEE TIME FOUND'};
    }
    await page.evaluate((rankOnPage) => {
        let rateBtns = document.querySelectorAll('[data-testid="teetimes_choose_rate_button"]')
        let buyBtns = document.querySelectorAll('[data-testid="teetimes_book_now_button"]')
        let cls = null
        if (rateBtns.length > 0) {
            cls = rateBtns[0].classList[0];
        } else {
            cls = buyBtns[0].classList[0];
        }
        let teeTime = document.getElementsByClassName(cls)[rankOnPage]
        teeTime.click();
    }, rankOnPage);
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
    await page.waitFor(4000);

    await page.waitForSelector(`[data-testid="terms-and-conditions-checkbox"]`)
    if(await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="payment-options-card"]').length > 0
    })) {


        await page.waitForSelector(`[data-testid="payment-options-card"]`)
        const dueNow = await page.evaluate(() => {
            return document.querySelector('[data-testid="due-now-value"]').innerText
        })
        if (dueNow !== "$0.00") {
            console.log('PAYMENT INCONVENIENCE')
            await browser.close();
            return {error: 'PAYMENT INCONVENIENCE'};
        }
        let inputValues = {
            '[placeholder="Card Number *"]': CARD.num,
            '[name="Payment.CC.CVVCode"]': CARD.cvv,
            // '[name="Payment.Name"]': CARD.name,
            '[name="Payment.Address.Line1"]': CARD.addr,
            '[name="Payment.Address.PostalCode"]': CARD.zipCode,
            '[name="tl.customerMobile"]': PHONE
        }
        // console.log(inputValues)
        let selectValues = {
            '[name="Payment.CC.ExpirationMonth"]': CARD.month,
            '[name="Payment.CC.ExpirationYear"]': CARD.year,
            '[name="Payment.Address.Country"]':  CARD.country
        }
        // await page.waitForSelector([name="Payment.CC.ExpirationMonth"], {visible: true, timeout: 60000});
        for(let i = 0; i < Object.keys(selectValues).length; i++){
            await page.evaluate((key, val) => {
                document.querySelector(key).previousElementSibling.click()
                document.querySelector(`[data-value="${val}"]`).click()
            }, Object.keys(selectValues)[i], Object.values(selectValues)[i])
        }
        await page.waitFor(3000)
        for (let i = 0; i < Object.keys(inputValues).length; i++) {
            await page.evaluate((key, value) => {
                window.console.log(key, document.querySelector(key))
                document.querySelector(key).value = value
            }, Object.keys(inputValues)[i], Object.values(inputValues)[i])
            await page.focus(Object.keys(inputValues)[i]);
            await page.type(Object.keys(inputValues)[i], Object.values(inputValues)[i], {delay: 100});
            await page.waitFor(1000);
        }
    }
    await page.click(`[data-testid="terms-and-conditions-checkbox"]`)


    await page.waitForSelector(`[data-testid="make-your-reservation-btn"]`)
    await page.click(`[data-testid="make-your-reservation-btn"]`)


    return page.waitForSelector(`[data-testid="confirmation-due-at-course-value"]`)
            .then(() => {
                browser.close();
                return {success: 'TEE TIME BOOKED!'};
            })
});
