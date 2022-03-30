const chromium = require('chrome-aws-lambda');
// const dotenv = require('dotenv');

exports.handler = async (event) => {
    // dotenv.config()
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
      const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(50000);
    await page.goto(event.url);
    const PLAYERS = event.players;
    const TIME = event.time
    const DATE = event.date
    const EMAIL = process.env.EMAIL
    const PASSWORD = process.env.PASSWORD


    let dateObject = new Date(parseInt(DATE.substring(6, 10)), parseInt(DATE.substring(0, 2)) - 1, parseInt(DATE.substring(3, 5)));
    let dateString = dateObject.toLocaleString("default", {weekday: "long"}) + ", " + monthNames[dateObject.getMonth()]
    if (dateObject.getDate() < 10) {
        dateString += " 0"
    } else {
        dateString += " "
    }
    dateString += dateObject.getDate() + ", " + dateObject.getFullYear()
    let COURSE_ID = -1;
    COURSE_ID = await page.evaluate(() => {
        return document.getElementById('customcaleder_0').parentElement.parentElement.parentElement.id.substring(7, 11)
    })
    if (COURSE_ID === undefined || COURSE_ID === -1 || COURSE_ID === null) {
        // browser.close();
        return {error: 'NO COURSE ID FOUND'};
    }
    await page.click(`#dnn_ctr${COURSE_ID}_DefaultView_ctl01_Calendar_dateInput`);
    let num_ = (await page.$$(`[title="${dateString}"`)).length
    if (num_ === 0) {
        await page.click(`#dnn_ctr${COURSE_ID}_DefaultView_ctl01_Calendar_calendar_NN`)
    }
    await page.click(`[title="${dateString}"`)
    await page.waitFor(5000);
    await page.waitForSelector('span.TeeBlock')
    let num = (await page.$$('span.TeeBlock')).length
    let counter = -1
    for (let i = 0; i < num; i++) {
        if (await page.evaluate((COURSE_ID, i, TIME) => {
            if (document.getElementById(`dnn_ctr${COURSE_ID}_DefaultView_ctl01_dlTeeTimes_lblTeeTime_${i}`).innerText === TIME) {
                return true
            }
        }, COURSE_ID, i, TIME)) {
            counter = i;
        }
    }
    if (counter === -1) {
        // await browser.close();
        return {error: 'NO TEE TIME FOUND'};
    }
    let special_counter = counter
    if (counter < 10) {
        special_counter = '0' + counter
    }
    let players_allowed = await page.evaluate((COURSE_ID, special_counter) => {
        return document.querySelector(`[name="dnn$ctr${COURSE_ID}$DefaultView$ctl01$dlTeeTimes$ctl${special_counter}$ddlNumPlayers"]`).children.length
    }, COURSE_ID, special_counter)
    if (PLAYERS > players_allowed - 1) {
        // await browser.close();
        return {error: 'PLAYER COUNT ERROR'};
    }
    await page.select(`select[name="dnn$ctr${COURSE_ID}$DefaultView$ctl01$dlTeeTimes$ctl${special_counter}$ddlNumPlayers"]`, PLAYERS.toString())
    await page.evaluate((COURSE_ID, counter) => {
        document.getElementById(`dnn_ctr${COURSE_ID}_DefaultView_ctl01_dlTeeTimes_lnkBook_${counter}`).click()
    }, COURSE_ID, counter)
    await page.waitForSelector('[placeholder="Email"]')
    let n = await page.evaluate(() => {
        return document.querySelector('[placeholder="Email"]').id
    })
    let q = await page.evaluate(() => {
        return document.querySelector('[placeholder="Password"]').id
    })

    await page.waitFor(1000);
    await page.waitForSelector(`#${n}`, {visible: true, timeout: 60000});
    await page.focus(`#${n}`);
    await page.type(`#${n}`, EMAIL, {delay: 100});
    await page.waitFor(1000);
    await page.waitForSelector(`#${q}`, {visible: true, timeout: 60000});
    await page.focus(`#${q}`);
    await page.type(`#${q}`, PASSWORD, {delay: 100})

    let c = await page.evaluate(() => {
        return document.querySelector('[data-name="Login"]').id
    })

    await page.click(`#${c}`)
    await page.waitForSelector(`#dnn_ctr${COURSE_ID}_DefaultView_ctl01_countdown`, {visible: true, timeout: 120000});
    let payment_option = (await page.$$('#PayAtCourse')).length > 0
    if (payment_option) {
        await page.evaluate(() => {
            document.getElementById('PayAtCourse').click()
        })
    }

    let fNames = ['Sam', 'Daniel', 'John']
    let lNames = ['Jacobs', 'Elliot', 'Packard']
    for (let i = 0; i < PLAYERS - 1; i++) {
        await page.waitForSelector(`#selectOption_${i + 2}`, {visible: true, timeout: 120000});
        await page.select(`#selectOption_${i + 2}`, '2')
        await page.evaluate((i, fName, lName) => {
            document.getElementById(`txtMemberLookUpFirstName_${i}`).value = fName;
            document.getElementById(`txtMemberLookUpLastName_${i}`).value = lName;
            document.getElementById(`btnMemberLookUpNext_${i}`).click()

        }, i + 2, fNames[i], lNames[i])
    }


    await page.evaluate(() => {
        document.querySelector('[value="Confirm Reservation"]').click()
    })
    if (payment_option) {
        page.waitForSelector(`#mat-expansion-panel-header-0`)
            .then(() => {
                // browser.close();
                return {success: 'TEE TIME BOOKED!'};
            })
    } else {
        page.waitForSelector(`#dnn_ctr${COURSE_ID}_DefaultView_ctl01_lblConfirmatonNumber`)
            .then(() => {
                // browser.close();
                return {success: 'TEE TIME BOOKED!'};
            })
    }


};
