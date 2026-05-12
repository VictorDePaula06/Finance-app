fetch('https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent('https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm'))
  .then(r => r.text())
  .then(t => {
    const matches = t.match(/https:\/\/www\.tesourodireto\.com\.br\/json\/[^"']+/g);
    console.log(matches ? [...new Set(matches)] : 'No JSON found');
  })
  .catch(console.error);
