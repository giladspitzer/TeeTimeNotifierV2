const chromium = require('chrome-aws-lambda');
const dotenv = require('dotenv');
const AWS = require("aws-sdk");


(async () => {
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
    await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.2.1.min.js'})
    process.on('unhandledRejection', async (err) => {
        console.error(err)
        if (process.env.ENV === 'prod') {
            const screenshot = await page.screenshot({
                path: `${Date.now()}_ezlinks.png`,
                fullPage: true
            })
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: `${Date.now().toString()}_ezlinks.png`,
                Body: screenshot
            };
            await s3.putObject(params).promise()
            await browser.close()
        }
    });
    await page.goto('https://hardingpark.ezlinksgolf.com/index.html#/preSearch');
    const PLAYERS = 2;
    const START = "3:30 PM"
    const END = "4:30 PM"
    const DATE = "4/18/2022"
    const USERNAME = process.env.USERNAME
    const PASSWORD = process.env.PASSWORD
    const PHONE = process.env.PHONE
    const COURSE_ID = 5999
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
    await page.waitForNetworkIdle()
    await page.waitForSelector("#dateInput")
    // add while to catch err in submit
    await page.evaluate((date, courseId) => {
        $('#dateInput').datepicker('show')
        let filters = document.querySelectorAll('filter.title')
        if(filters.length > 0){
            for(let i = 0; i < filters.length; i++){
                if(filters[i].innerText !== "Public"){
                    filters[i].click()
                }
            }
        }
        let days = document.getElementsByClassName('ui-state-default')
        if (days[days.length-1].parentElement.getAttribute('data-month') !== (parseInt(date.split('/')[0]) - 1).toString() ||
            days[days.length-1].parentElement.getAttribute('data-year') !== date.split('/')[2]) {
            document.getElementsByClassName('ui-datepicker-next ui-corner-all')[0].click()
            days = document.getElementsByClassName('ui-state-default')
        }
        for (let i = 0; i < days.length; i++) {
            if (days[i].innerText === date.split('/')[1]) {
                days[i].click()
            }
        }
        document.querySelector(`input[value="${courseId}"]`).click()
        document.querySelector('button[type="submit"]').click()
    }, DATE, COURSE_ID);

    await page.waitForSelector('[aria-labelledby="players-button"]')
    await page.evaluate((players) => {
        document.querySelector('[aria-labelledby="players-button"]').children[players - 1].click()
    }, PLAYERS);
    await page.waitForNetworkIdle()
    for(let i = 0; i < 10; i++){
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        })
        await page.waitFor(750)
    }
    let nthTeeTimer = await page.evaluate((start, end) => {
        const transformTimeToInt = (timeString) => {
            let total = 0;
            total += (parseInt(timeString.split(':')[0]) * 60)
            total += (parseInt(timeString.split(':')[1].split(" ")[0]))
            if (timeString.split(" ")[1] === "PM") {
                total += 720;
            }
            return total
        }
        const start_int = transformTimeToInt(start)
        const end_int = transformTimeToInt(end)
        let nthTeeTime = -1;
        const times = document.getElementsByClassName('time ng-binding')
        for(let i = 0; i < times.length; i++){
            let time = transformTimeToInt(times[i].innerText);
            if(time >= start_int && time <= end_int){
                nthTeeTime = i;
                break
            }
        }
        return nthTeeTime;
    }, START, END)
    if(nthTeeTimer === -1){
        return {error: 'No Time Found'};
    }
    await page.evaluate((nthTeeTimer) => {
        document.getElementsByClassName('player-info')[nthTeeTimer].lastElementChild.click()
    }, nthTeeTimer)
    await page.waitForSelector('#addToCartBtn', {visible: true, timeout: 60000})
    await page.evaluate(() => {document.getElementById("addToCartBtn").click()})
    await page.waitForSelector(`[name="login"]`, {visible: true, timeout: 60000});
    await page.focus(`[name="login"]`);
    await page.type(`[name="login"]`, USERNAME, {delay: 100});
    await page.waitFor(1000);
    await page.waitForSelector(`[name="password"]`, {visible: true, timeout: 60000});
    await page.focus(`[name="password"]`);
    await page.type(`[name="password"]`, PASSWORD, {delay: 100})
    await page.evaluate(() => {document.querySelector("button[type=\"submit\"]").click()})
    await page.waitForNetworkIdle()
    await page.waitForSelector('button[type="submit"]', {visible: true, timeout: 60000});
    if((await page.$$("#cardNumber")).length === 1){
        await page.focus(`#cardNumber`);
        await page.type(`#cardNumber`, CARD.num, {delay: 100});
        await page.waitFor(1000);
        await page.focus(`input[name="holderName"]`);
        await page.type(`input[name="holderName"]`, CARD.name, {delay: 100});
        await page.select(`#month`, CARD.month.toString())
        await page.select(`#year`, CARD.year.toString())

    }
    await page.evaluate(() => {document.querySelector("button[type=\"submit\"]").click()})
    await page.waitForSelector('#topFinishBtn', {visible: true, timeout: 60000});
    await page.evaluate(() => {document.getElementById("topFinishBtn").click()})
})();
