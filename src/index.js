 var request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    path = require('path'),
    util = require('util'),
    _ = require('lodash'),
    g = require('generator-trees').g;

var htmlDirectory = 'html',
    wordsDirectory = 'words';

var workList = ['define', 'right', 'food'];

var dictionary = {};

if (!fs.existsSync(htmlDirectory)) fs.mkdirSync(htmlDirectory);
if (!fs.existsSync(wordsDirectory)) fs.mkdirSync(wordsDirectory);

sync(
  wordList(workList, processWord), result => console.log('Finished', _.map(result, r => r.word).join(', '), workList.length, 'words remaining'))
    .then(
      count => {
        console.log('Defined', count, 'words');
        console.log('Writing dictionary');
        fs.writeFileSync('dictionary.json', JSON.stringify(dictionary, null, '  '));
      },
      error => console.log('Error', util.inspect(error))
    );

function* wordList(words, process) {
  if (words.length == 0) throw Error('Empty words');

  while (words.length > 1) yield process(words.pop());

  return process(words.pop());
}

function processWord(word) {
  console.log('Processing', word, '...');
  return defineWord(word).then(storeWord).then(addNewWords);

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
    dictionary[word] = definition;
    _.each(definition, d => {
      var word = d.word,
          entry = dictionary[word];

      if (entry == undefined) {
        dictionary[word] = d;
        // not the best place for this!
        fs.writeFileSync(path.join(wordsDirectory, word + '.json'), JSON.stringify(d, null, '  '));
      }
    });

    return definition;
  }

  function addNewWords(definition) {
    console.log('adding', definition.length, 'new words', _.map(definition, d => d.word));
    _.each(definition, d => {
      _.each(d.parts, p => {
        _.each(p.definitions, d => addIfNew(_.map(d.definition.split(' '), word =>word.replace(/[^\w]/g, ''))));
      });
    });


    return definition;

    function addIfNew(words) {
      // console.log('Attempting to add words', words);
      _.each(words, word => {
        if (word && word.length > 0 &&
            dictionary[word] == undefined &&
            !_.contains(workList, word)) {

          console.log('Adding word', word);
          workList.push(word);
        }
      });
    }
  }

  function getWordHtml(word) {
    var nonce = 0;
    return new Promise((resolve, reject) => {
      readWordFromFile(word)
        .then(
          resolve,
          error => {
            console.log('Requesting definition for', word, '...');
            request({
              url: 'https://google.com/search?q=define+' + word,
              headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36 ' + (nonce++)
              }
            }, (error, response, html) => {
              console.log('Received definition for', word, '; processing...');
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
      return entry.find('[data-dobid="hdw"]').text().replace(/·/g, '');
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
}


// processWordList(words)
//   .then(printStats)
//   .then(
//     stats => console.log('List processed', stats),
//     error => console.log('Error Processing Word List', error));

// function processWordList(list) {
//   g.map(g.toGenerator(list), word => {

//   });
//   return new Promise((resolve, reject) => {
//     _.each(words, word => {
//       defineWord(word)
//         .then(storeWord)
//         .then(addNewWords)
//         .then(
//           def => console.log('def', util.inspect(dictionary, {depth: 7, colors: true})),
//           error => console.log('error', error));
//     });
//   });
// }

// function sync(generator) {
//   return new Promise((resolve, reject) => {
//     process(generator);

//     function process(generator) {
//       var {value, done} = generator.next();

//       value.then(() => {
//         if (done) resolve();
//         else process(generator);
//       }, reject);
//     }
//   });
// }

//What we really want is async generators
//https://github.com/jhusain/asyncgenerator

// async function* sync(generator) {}
//   while(true) {
//     var {value, done} = generator.next();

//     var result = await value.catch(error => result = error);

//     if (done) return result;
//     yield result;
//   }
// }

// sync((function* () {
//   yield new Promise((resolve, reject) => resolve(1));
//   yield new Promise((resolve, reject) => setTimeout(() => resolve(2), 1000));
//   return new Promise((resolve, reject) => setTimeout(() => resolve(3), 1000));
// })(), result => console.log(result)).then(result => console.log('done', result), error => console.log(error));


function sync(generator, notify) {
  return new Promise((resolve, reject) => {
    var count = 0;
    process(generator);

    function process(generator) {
      var {value, done} = generator.next();

      value
        .then(
          result => {
            count++;
            notify(result);
            if (done) resolve(count);
            else process(generator);
          },
          error => reject(error));
    }
  });
}

function async(generator, maxConcurrent) {

}

function demultiplex(generator, handlerConstructor, maxHandlers) {
  var availableHandlers = [];

  for (var i = 0; i < maxHandlers; i++) availableHandlers.push(handlerConstructor(i, maxHandlers));

  while (true) {
    var result = generator.next(),
        value = result.value;

    value.then(handlerFinished, handlerError);
  }

  function handlerFinished(handler, value) {
    availableHandlers.push(handler);
  }
}

function printStats(stats) {
  console.log('dictionary contains', _.keys(dictionary).length, 'words');
}