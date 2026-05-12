const https = require('https');
const options = {
  hostname: 'www.tesourodireto.com.br',
  path: '/json/br/com/b3/tesourodireto/service/api/treasurybondpriceandsavings.json',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm',
    'Sec-Fetch-Mode': 'cors'
  }
};
const req = https.request(options, res => {
  console.log('STATUS:', res.statusCode);
});
req.end();
