let rp = require('request-promise');
let cheerio = require('cheerio');

const HOME_PAGE_URL = 'http://www.wood-database.com';
let options = {
  uri: HOME_PAGE_URL,
  transform: function (body) {
    return cheerio.load(body);
  }
}

rp(options)
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
        page: link.attr('href'),
        thumbnail: undefined // TODO
      };
      woods.push(wood);
    }

    console.log("done!");
  })
  .catch((err) => {
    console.log("something went wrong");
    console.log(err);
  });
