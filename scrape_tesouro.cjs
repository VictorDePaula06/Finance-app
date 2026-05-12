const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Navigate to the main site to get cookies/pass Cloudflare
  await page.goto('https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // Wait for Cloudflare to clear
  
  // Now fetch the JSON endpoint directly
  await page.goto('https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondpriceandsavings.json');
  await page.waitForTimeout(2000);
  
  const content = await page.evaluate(() => document.body.innerText);
  try {
    const json = JSON.parse(content);
    if (json.response && json.response.TrsrBondPricLogList) {
        fs.writeFileSync('live_tesouro.json', JSON.stringify(json.response.TrsrBondPricLogList, null, 2));
        console.log('Successfully saved ' + json.response.TrsrBondPricLogList.length + ' bonds!');
    } else {
        console.log('JSON structure missing TrsrBondPricLogList');
        console.log(content.substring(0, 500));
    }
  } catch(e) {
    console.log('Failed to parse JSON. Content was:');
    console.log(content.substring(0, 500));
  }
  
  await browser.close();
})();
