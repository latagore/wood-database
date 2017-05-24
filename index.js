let request = require('request');
let cheerio = require('cheerio');

const HOME_PAGE_URL = 'http://www.wood-database.com';
request(HOME_PAGE_URL, (error, response, html) => {
  if (error) return;
  
  let $ = cheerio.load(html);
  // selectors for the left and right column, copy-pasted from Chrome DevTools
  const PARENT_SELECTOR = '#post-7 > div > div.fusion-fullwidth.fullwidth-box.hundred-percent-fullwidth > div > div:nth-child(4) > div, #post-7 > div > div.fusion-fullwidth.fullwidth-box.hundred-percent-fullwidth > div > div:nth-child(5) > div';
  
  let links = $(PARENT_SELECTOR).find("a");
  for(let i = 0; i < links.length; i++) {
    console.log(links[i].attribs.href);
  }
});