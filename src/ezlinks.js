const chromium = require('chrome-aws-lambda');

// const dotenv = require('dotenv');

(async () => {
  // dotenv.config()
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
  const page = await browser.newPage();
  await page.goto('https://hardingpark.ezlinksgolf.com/index.html#/search');

  await page.waitForSelector(".preSearch-center")
  await page.$eval('input[type="checkbox"]', check => check.checked = true);
  await page.$eval('input[type="checkbox"]', check => check.checked = true);
  await page.click('button[type="submit"]');
  await page.waitForSelector("#pickerDate")
  await page.$eval('#pickerDate', el => el.value = '03/23/2022');
  await page.waitForSelector("[ng-class='ec.courseNameClass']")
  const data = await page.evaluate(() => {
      const tds = Array.from(document.querySelectorAll('span[data-ng-bind="ec.teetimeTimeDisplay(t)"]'))
      return tds
  });
  const tag_name = await (await data[0].getProperty('tagName')).jsonValue()

  console.log(tag_name)




  // await page.click('button[type="submit"]');


})();
