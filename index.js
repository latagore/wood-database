let rp = require('request-promise');
let cheerio = require('cheerio');
let _ = require('underscore');
let s = require('underscore.string');

const HOME_PAGE_URL = 'http://www.wood-database.com';
const CHEERIO_TRANSFORM = function (body) {
  return cheerio.load(body);
};

let options = {
  uri: HOME_PAGE_URL,
  transform: CHEERIO_TRANSFORM
};

const utils = {
  
  // takes a string of the form "2.0-3.0 ft"
  // and returns an object containing the min, the max and the unit
  // in the form {min: min, max: max, unit: unit}
  // returns min, max, or unit as undefined if they are missing.
  // returns undefined if the string does not meet the given format
  extractRange: function (string) {
    // matches "2.0-3.0 ft" and variants, capturing the first and second numbers
    let matches = string.match(/(\d+(?:\.\d+)?|\.d+)-(\d+(?:\.\d+)?|\.d+)\s+(\S+)/);

    if (!matches) {
      return undefined;
    }

    return {
      min: matches[1],
      max: matches[2],
      unit: matches[3]
    };
  },
  
  // takes a string of the form "2.0 ft"
  // and returns an object containing the value and the unit
  // in the form {value: value, unit: unit}
  // returns value or unit as undefined if they are missing.
  // returns undefined if the string does not meet the given format
  extractValueWithUnit: function (string) {
    let matches = string.match(/(\d+(?:\.\d+)?|\.d+|\d{1,3}(?:,\d{3})+)\s+(\S+)/);

    if (!matches) {
      return undefined;
    }

    return {
      value: utils.parseNumber(matches[1]),
      unit: matches[2]
    };
  },
  
  
  // parses any string, with or without thousands delimiters and returns a Number object.
  parseNumber(string) {
    if (_.isNumber(string)){
      return string;
    }
    if (!_.isString(string)) {
      throw new Error(`"${string}" is not a string.`);
    }
    if (!/(\d+(?:\.\d+)?|\.d+|\d{1,3}(?:,\d{3})+)/.test(string)){
      throw new Error(`"${string}" is not a valid number for parseNumber(). See docs.`);
    }
    return parseFloat(string.replace(/,\s*/g, ''));
  }
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
  woods = woods.filter((x) => x.name === "Macacauba"); // TODO remove me
  woods.forEach(wood => {
    sequence = sequence.then(() => {
      console.log(`loaded ${wood.name} page`);
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
    if (s(value).contains('No data available')) {
      return undefined;
    } else {
      return value.trim();
    }
  };
  
  // list of all the properties that have a single value and unit
  // example 1: "10 ft", example 2: "500 lb/f"
  const SINGLE_VALUE_AND_UNIT_PROPERTIES_LIST = [
   'average_dried_weight',
    'janka_hardness',
    'modulus_of_rupture',
    'elastic_modulus',
    'crushing_strength'
  ];
  const PLAIN_TEXT_PROPERTIES_LIST = [
    'distribution'
  ];
  woods.forEach(wood => {
      console.log(`processing ${wood.name}`);
    // each row element containing the statistics
    let $ = wood.original_page_cheerio;
    
    if (!$(TABLE_SELECTOR).length) {
      console.warn(`${wood.name} doesn't have a table of statistics. check the page manually?`);
      return;
    }
    
    wood.props = {};
    let entries = $(TABLE_SELECTOR).find('p');
    
    entries.each((i, elem) => {
      var el = $(elem);
      let name = el.find('a').text();
      let value = el.text().replace(name, ''); // remove leading name
      n_name = normalizeName(name); // used for wood.props.key
      n_value = normalizeValue(value);
      
      if (n_value === undefined) {
        wood.props[n_name] = undefined;
      } else if (s(n_name).contains('specific_gravity')) {
        wood.props.specific_gravity = new Map();
        
        // check that there are only two values for specific gravity
        let units = name.match(/\((.*)\)/);
        if (units && units[1]) {
          let values = n_value.split(', ');
          
          units[1].split(', ').forEach((unit, i) => {
            wood.props.specific_gravity.set(unit, values[i]);
          });
        } else {
          wood.props.specific_gravity.set('unknown', n_value);
        }
      } else if (s(n_name).contains('common_name')) {
        let common_names = new Set(n_value.split(/,\s+/));
        common_names.add(wood.name);
        wood.props.common_names = common_names;
      } else if (s(n_name).contains('tree_size')) {
        let values = n_value.split(/,\s+/);
        values.forEach((v) => {
          let range = utils.extractRange(v);
          if (_.isUndefined(range)){
            console.warn(`unknown tree size value "${v}" for ${wood.name}`);
            return;
          }
          
          let measurement;
          if (s(v).contains('tall')) {
            measurement = 'height';
          } else if (s(v).contains('diameter')) {
            measurement = 'diameter';
          } else {
            console.warn(`unknown tree size value "${v}" for ${wood.name}`);
            return;
          }
          
          if (_.isUndefined(range.min)) {
              console.warn(`unknown min ${measurement} for ${wood.name}, continuing anyways`);
          }
          if (_.isUndefined(range.max)) {
            console.warn(`unknown max ${measurement} for ${wood.name}, continuing anyways`);
          }
          if (_.isUndefined(range.unit)) {
            console.warn(`unknown ${measurement} unit for ${wood.name}, continuing anyways`);
          }
          
          wood.props[measurement] = range;
        });
      } else if (_.contains(SINGLE_VALUE_AND_UNIT_PROPERTIES_LIST, n_name)) {
        let prop = utils.extractValueWithUnit(value);
        if (_.isUndefined(prop)){
            console.warn(`unknown ${name} value "${value}" for ${wood.name}`);
            return;
          }
        if (_.isUndefined(prop.value)) {
          console.warn(`unknown ${name} value for ${wood.name}, continuing anyways`);
        }
        if (_.isUndefined(prop.unit)) {
          console.warn(`unknown ${name} unit for ${wood.name}, continuing anyways`);
        }
        
        wood.props[n_name] = prop;
      } else if (s(n_name).contains('scientific_name')) {
        let matches = n_value.match(/([^(]+)\s?\((.+)\)/);
        let names = new Set();
        if (matches && matches.length === 2) {
          // only one species is included under this wood
          names.add(n_value);
        } else if (matches && matches.length === 3) {
          // more than one species under this wood
          let species = matches[2].split(/,\s/);
          
          species.forEach(s => names.add(s));
        } else {
          names.add(n_value);
        }
        
        // plural property, since it can have more than one
        wood.props.scientific_names = names;
      } else if (s(n_name).contains('shrinkage')) {
        let prop = new Map();
        
        n_value.split(/,\s/).forEach(x => {
          let matches = x.match(/(.+?):\s+([^%]+)/);
          let shrinkageType = matches[1];
          let shrinkageValue = matches[2];
          
          // ignore the T/R ratio because we can compute that
          if (!s(shrinkageType).contains('T/R Ratio')) {
            prop.set(normalizeName(shrinkageType), utils.parseNumber(shrinkageValue));
          }
        });
        
        wood.props[n_name] = prop;
      } else {
        if (!_.contains(PLAIN_TEXT_PROPERTIES_LIST, n_name)) {
          console.warn(`unknown property ${n_name} for ${wood.name}. using raw value.`);
        }
        wood.props[n_name] = n_value;
      }
    });
  });
  
  debugger;
})
.catch(err => {
  console.log(`something went wrong`);
  console.log(err);
});