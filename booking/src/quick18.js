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
        // defaultViewport: chromium.defaultViewport,
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
                path: `${Date.now()}_quick18.png`,
                fullPage: true
            })
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: `${Date.now().toString()}_quick18.png`,
                Body: screenshot
            };
            await s3.putObject(params).promise()
            await browser.close()
        }
    });
    const DATE = event.date
    const URL = event.url
    const PLAYERS = event.players;
    const START = event.start
    const END = event.end
    const EMAIL = process.env.EMAIL
    const PASSWORD = process.env.PASSWORD
    let url = URL + `?teedate=${DATE.split('/')[2]}${DATE.split('/')[0]}${DATE.split('/')[1]}`
    await page.goto(url);
    await page.waitForSelector('#be_search_messages')
    await page.select(`#SearchForm_Players`, PLAYERS.toString())
    await page.click('[type="submit"]')
    await page.waitForSelector('#be_search_messages')
    const rankOnPage = await page.evaluate((start, end) => {
        const transformTimeToInt = (timeString) => {
            let total = 0;
            if (parseInt(timeString.split(':')[0]) !== 12) {
                total += (parseInt(timeString.split(':')[0]) * 60)
            }
            total += (parseInt(timeString.split(':')[1].substr(0,2)))
            if (timeString.includes('PM')) {
                total += 720;
            }
            return total
        }
        const start_int = transformTimeToInt(start)
        const end_int = transformTimeToInt(end)
        let elements = document.getElementsByClassName('mtrxTeeTimes');
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
        let btns = document.getElementsByClassName('teebutton')
        btns[2+((rankOnPage)*3)].click()
    }, rankOnPage);
    await page.waitForSelector(`input[value="${PLAYERS}"]`)
    await page.click(`input[value="${PLAYERS}"]`)
    await page.evaluate(() => {
         window.scrollTo(0, document.body.scrollHeight);
        document.querySelector('[type="submit"]').click()
    })

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
            browser.close();
            return {success: 'TEE TIME BOOKED!'};
        })
});
