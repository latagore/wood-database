let rp = require('request-promise');
let cheerio = require('cheerio');

const HOME_PAGE_URL = 'http://www.wood-database.com';
const CHEERIO_TRANSFORM = function (body) {
  return cheerio.load(body);
};

let options = {
  uri: HOME_PAGE_URL,
  transform: CHEERIO_TRANSFORM
};

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
    let wood = {
      name: link.text(),
      original_page_uri: link.attr('href'),
      thumbnail: undefined // TODO
    };
    woods.push(wood);
  }
  console.log(`found ${woods.length} wood pages`);
  
  // load each page
  let sequence = Promise.resolve();
  let wood_pages = [];
  woods = woods.slice(-10); // TODO remove me
  woods.forEach(wood => {
    sequence = sequence.then(() => {
      console.log(`loaded ${wood.name} page`)
      return rp({
        uri: wood.original_page_uri,
        transform: CHEERIO_TRANSFORM
      })
      .then(($) => {
        wood.original_page_cheerio = $;
        
      });
    });
  });
  
  return sequence.then(() => {
    return woods;
  });
})
.catch(err => {
  console.log(`something went wrong while looking up woods`);
  console.log(err);
})
.then(woods => {
  // selector for the element containing the stats for a wood
  const TABLE_SELECTOR = 'table:first-child > tbody > tr > td:nth-child(2)';
  const normalizeName = function(name) {
    return name
      .replace(/\s*:\s*$/, '') // remove ending semi-colon
      .replace(/\s+/g, '_')
      .toLocaleLowerCase()
      .trim();
  };
  const normalizeValue = function(value) {
    if (value.lastIndexOf('No data available') !== -1) {
      return undefined;
    } else {
      return value.trim();
    }
  };
  woods.forEach(wood => {
      console.log(`processing ${wood.name}`);
    // each row element containing the statistics
    let $ = wood.original_page_cheerio;
    
    if (!$(TABLE_SELECTOR).length) {
      console.warn(`${wood.name} doesn't have a table of statistics. check the page manually?`);
      return;
    }
    
    wood.props = {};
    var entries = $(TABLE_SELECTOR).find('p');
    entries.each((i, elem) => {
      var el = $(elem);
      let name = el.find('a').text();
      let value = el.text().replace(name, ''); // remove leading name
      name = normalizeName(name);
      value = normalizeValue(value);
      // TODO account for multiple values with specific gravity
      wood.props[name] = value;
    });
  });
  
  debugger;
})
.catch(err => {
  console.log(`something went wrong`);
  console.log(err);
});