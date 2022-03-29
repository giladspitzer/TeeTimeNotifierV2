const puppeteer = require('puppeteer');
const dotenv = require('dotenv');


(async () => {
    dotenv.config()
    const browser = await puppeteer.launch({headless: false, autoClose: true});
    const page = await browser.newPage();
    await page.goto('https://baylandswalking.quick18.com/teetimes/course/1026/teetime/202204101140?psid=5432&p=0');

    const PLAYERS = 2;
    const EMAIL = process.env.EMAIL
    const PASSWORD = process.env.PASSWORD
    let players_available = (await page.$$(`input[value="${PLAYERS}"]`)).length === 1
    if(!players_available){
        console.error('PLAYER COUNT ERROR')
        await browser.close();
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
            console.warn('TEE TIME BOOKED!')
            browser.close();
        })
})();
