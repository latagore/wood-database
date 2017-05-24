let rp = require('request-promise');
let cheerio = require('cheerio');

const HOME_PAGE_URL = 'http://www.wood-database.com';
const CHEERIO_TRANSFORM = function (body) {
  return cheerio.load(body);
};

let options = {
  uri: HOME_PAGE_URL,
  transform: CHEERIO_TRANSFORM
}

rp(options)
.catch((err) => {
  console.log(`something went wrong while crawling the home page`);
  console.log(err);
})
.then(($) => {
  // selectors for the left and right column, copy-pasted from Chrome DevTools
  const PARENT_SELECTOR = '#post-7 > div > div.fusion-fullwidth.fullwidth-box.hundred-percent-fullwidth > div > div:nth-child(4) > div, #post-7 > div > div.fusion-fullwidth.fullwidth-box.hundred-percent-fullwidth > div > div:nth-child(5) > div';

  let links = $(PARENT_SELECTOR).find("h3 a");
  let woods = [];
  for(let i = 0; i < links.length; i++) {
    let link = links.eq(i);
    console.log(`processing ${link.text()}`);
    let wood = {
      name: link.text(),
      original_page_uri: link.attr('href'),
      thumbnail: undefined // TODO
    };
    woods.push(wood);
  }

  // crawl each page
  // selector for the element containing the stats for a wood
  const TABLE_SELECTOR = '.post-content > div:nth-child(1) > div > div > div > div > div > table:nth-child(1) > tbody > tr > td:nth-child(2) > p:nth-child(1)';
  woods = woods.map(wood => {
    return rp({
      uri: wood.original_page_uri,
      transform: CHEERIO_TRANSFORM
    }).then($ => {
      wood.original_page = $;
      return wood;
    })
  });
  
  return Promise.all(woods);
})
.catch(err => {
  console.log(`something went wrong while looking up woods`);
  console.log(err);
})
.then(woods => {
  woods.forEach((i, wood) => {
    // each row element containing the statistics
    let $ = wood.original_page_cheerio;
    
    var entries = $(TABLE_SELECTOR).find('p');
    entries.each(() => {
      var el = $(this);
      let name = el.find(a).text();
      let value = el.text().replace(name, '');
      console.log();
    });
  })
})
.catch(err => {
  console.log(`something went wrong`);
  console.log(err);
})