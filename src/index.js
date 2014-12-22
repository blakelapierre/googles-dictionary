var request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    path = require('path'),
    util = require('util'),
    _ = require('lodash');

var htmlDirectory = 'html';

var words = ['define', 'right', 'food'];

var dictionary = {};

if (!fs.existsSync(htmlDirectory)) fs.mkdirSync(htmlDirectory);

processWordList(words);

console.log('dictionary contains', _.keys(dictionary).length, 'words');

function processWordList(list) {
  return new Promise((resolve, reject) => {
    _.each(words, word => {
      defineWord(word)
        .then(storeWord)
        .then(addNewWords)
        .then(
          def => console.log('def', util.inspect(dictionary, {depth: 7, colors: true})),
          error => console.log('error', error));
    });
  });
}

function defineWord(word) {
  return new Promise((resolve, reject) => {
    getWordHtml(word)
      .then(
        html => {
          var $ = cheerio.load(html);


          fs.writeFile(getWordFileName(word), html, error => {
            if (error) reject(error);

            resolve(extractDefinition($, word));
          });
        },
        error => reject(error));

  });
}

function storeWord(definition) {
  _.each(definition, d => {
    var word = d.word,
        entry = dictionary[word];

    if (entry == undefined) dictionary[word] = d;
  });

  return definition;
}

function addNewWords(definition) {
  console.log('woah', definition);
}

function getWordHtml(word) {
  return new Promise((resolve, reject) => {
    readWordFromFile(word)
      .then(
        resolve,
        error => {
          console.log('Requesting defintion for', word, '...');
          request({
            url: 'https://google.com/search?q=define+' + word,
            headers: {
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36'
            }
          }, (error, response, html) => {
            if (error) reject(error);
            resolve(html);
          });
        }
      );
  });
}

function readWordFromFile(word) {
  return new Promise((resolve, reject) => {
    fs.readFile(getWordFileName(word), (error, data) => {
      if (error) reject(error);
      else resolve(data.toString());
    });
  });
}

function extractDefinition($, word) {
  return $('.lr_dct_ent')
          .map(extractEntry)
          .get();

  function extractEntry(index, entry) {
    entry = $(entry);

    return {
      word: extractWord(entry),
      syllables: extractSyllables(entry),
      pronunciation: extractPronunciation(entry),
      parts: extractParts(entry)
    };
  }

  function extractWord(entry) {
    return entry.find('[data-dobid="hdw"]').text().replace('·', '');
  }

  function extractSyllables(entry) {
    return entry.find('[data-dobid="hdw"]').text().split('·');
  }

  function extractPronunciation(entry) {
    return entry.find('.lr_dct_ph span').text();
  }

  function extractParts(entry) {
    return entry.find('.lr_dct_sf_h')
                .map((index, element) => {
                  var part = entry.find(element),
                      variants = part.next('div'),
                      definitions = part.next().next();

                  return {
                    part: part.text(),
                    variants: extractPartVariants(variants),
                    definitions: extractDefinitions(definitions)
                  };
                })
                .get();

    function extractPartVariants(part) {
      return part
                .children()
                .map((index, other) => {
                  var parts = $(other).text().split(':');

                  return {
                    part: (parts[0].replace(/^;\s/, '') || '').trim(),
                    variant: (parts[1] || '').trim()
                  };
                })
                .get();
    }
  }

  function extractDefinitions(definitions) {
    return definitions
                      .find('ol.lr_dct_sf_sens li [data-dobid="dfn"]')
                      .map((index, element) => {
                        var definition = $(element),
                            examples = definition.next().find('span').text();

                        // The next element could by synonyms or antonyms, let's check!
                        var nyms = definition.next().next(),
                            text = nyms.text(),
                            parts = text.split(':'),
                            synonyms,
                            antonyms;


                        if (parts[0] == 'synonyms') {
                          synonyms = _.map(parts[1].split(','), word => word.trim());

                          nyms = definition.next().next().next();
                          text = nyms.text();
                          parts = text.split(':');
                          // fall through!
                        }

                        if (parts[0] == 'antonyms') {
                          antonyms = _.map(parts[1].split(','), word => word.trim());
                        }

                        var ret = {
                          definition: definition.text()
                        };

                        if (examples.length > 0) ret.examples = [examples];
                        if (synonyms) ret.synonyms = synonyms;
                        if (antonyms) ret.antonyms = antonyms;

                        return ret;
                      }).get();
  }
}

function getWordFileName(word) {
  return path.join(htmlDirectory, word);
}
// function* () {
//     if (ready) yield doSTuff();
//     else yield promise();
// }

