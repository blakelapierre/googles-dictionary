require('./util/promisePolyfill');

let request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    path = require('path'),
    util = require('util'),
    _ = require('lodash'),
    g = require('generator-trees').g,
    { ratelimit } = require('./util/ratelimit'),
    { constant } = require('./util/distributions/constant'),
    { or } = require('./util/promisePolyfill');

let htmlDirectory = 'html',
    wordsDirectory = 'words';

let wordList = ['define', 'right', 'food'];

let dictionary = {};

let indentation = '  ';

if (!fs.existsSync(htmlDirectory)) fs.mkdirSync(htmlDirectory);
if (!fs.existsSync(wordsDirectory)) fs.mkdirSync(wordsDirectory);

sync(
  g.map(g.modifiableStack(wordList), processWord),
  (result, count) => {
    console.log(count, 'words processed,', wordList.length, 'words remaining');
  },
  error => console.log('Process error', error)
).then(
  count => {
    console.log('Defined', count, 'words');
    console.log('Writing dictionary');
    fs.writeFileSync('dictionary.json', JSON.stringify(dictionary, null, '  '));
  },
  error => console.log('Error', util.inspect(error))
);


// let work = ratelimit(1000, constant)
//   .per
//     .hour(g.map(g.modifiableStackAlt(wordList), processWord))
//   .sync(notify, notifyError);
// console.log('work', work);
//   // work.then(success, failed);

//   work.then(result => console.log('woah', result), error => console.log('woah', error));

console.log('done. i\'m out!');

function notify(result, count) {
  console.log(count, 'words processed,', wordList.length, 'words remaining');
}

function notifyError(error) {
  console.log('Process error', error);
}

function success(count) {
  console.log('Defined', count, 'words');
  console.log('Writing dictionary');
  fs.writeFileSync('dictionary.json', JSON.stringify(dictionary, null, '  '));
}

function failed(error) {
  console.error('Error', error.stack);
}

// async(
//   1,
//   g.map(g.modifiableStack(wordList), word => {
//     return new Promise((resolve, reject) => {
//       console.log(word);
//       resolve(word);
//     });
//   }),
//   count => console.log(count),
//   error => console.log(error)
// ).then(
//   count => {
//     console.log('Finished', count);
//   },
//   error => console.log('error', error)
// );

function processWord(word) {
  console.log('processWord');
  return getWordHtml(word).then(processHtml)
                          // .then([storeWord, writeWordJSON, addNewWords]);
                        .then(storeWord(word))
                        .then(writeWordJSON(word))
                        .then(addNewWords(word));

  function getWordHtml(word) {
      let nonce = 0;
      return new Promise((resolve, reject) => {
        readWordFromFile(word)
          .then(
            result => {
              console.log('result', result);
              resolve(result);
            },
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
    // return or([readWordFromFile, getWordFromGoogle], word);
    // return readWordFromFile(word).or(getWordFromGoogle, word);
  }

  function readWordFromFile(word) {
    console.log('finding', word);
    let promise = new Promise((resolve, reject) => {
      fs.readFile(getWordFileName(word), (error, data) => {
        if (error) {
          console.log('read error', error);
          reject(error);
        }
        else {
          console.log('found', word);
          resolve(data.toString());
        }
      });
    });
    console.log('promise', promise);
    return promise;
  }

  function getWordFromGoogle(word) {
    console.log('Requesting definition for', word, '...');
    return new Promise((resolve, reject) => {
      request({
        url: 'https://google.com/search?q=define+' + word,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36'
        }
      }, (error, response, html) => {
        console.log('Received definition for', word, '; processing...');
        if (error) reject(error);
        else resolve(html);
      });
    });
  }


  function processHtml(html) {
    console.log('processing html');
    return new Promise((resolve, reject) => {
      let $ = cheerio.load(html);

      fs.writeFile(getWordFileName(word), html, error => {
        if (error) reject(error);

        let definitions = extract($, word);
        if (definitions.length > 0) resolve(definitions);
        else reject('Did not find any definitions for ' + word);
      });

      function extract($, word) {
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
                        let part = entry.find(element),
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
                        let parts = $(other).text().split(':');

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
                    let definition = $(element),
                        examples = definition.next().find('span').text();

                    // The next element could be synonyms or antonyms, let's check!
                    let nyms = definition.next().next(),
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

                    let ret = {
                      definition: definition.text()
                    };

                    if (examples.length > 0) ret.examples = [examples];
                    if (synonyms) ret.synonyms = synonyms;
                    if (antonyms) ret.antonyms = antonyms;

                    return ret;
                  })
                  .get();
        }
      }
    });
  }

  function storeWord(definition) {
    console.log('storing word');
    var added = [word];

    dictionary[word] = definition;
    _.each(definition, d => {
      if (dictionary[d.word] === undefined) {
        dictionary[d.word] = d;
        added.push(d.word);
      }
    });

    console.log('Added words', added);

    return definition;
  }

  function writeWordJSON(definition) {
    return new Promise((resolve, reject) => {
      var fileName = path.join(wordsDirectory, word + '.json');


      fs.writeFile(fileName, JSON.stringify(definition, null, indentation), error => {
        if (error) reject(error);
        else resolve(definition);
      });
    });
  }

  function addNewWords(definition) {
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
            dictionary[word] === undefined &&
            !_.contains(wordList, word)) {

          wordList.push(word);
        }
      });
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
//       let {value, done} = generator.next();

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
//     let {value, done} = generator.next();

//     let result = await value.catch(error => result = error);

//     if (done) return result;
//     yield result;
//   }
// }

// sync((function* () {
//   yield new Promise((resolve, reject) => resolve(1));
//   yield new Promise((resolve, reject) => setTimeout(() => resolve(2), 1000));
//   return new Promise((resolve, reject) => setTimeout(() => resolve(3), 1000));
// })(), result => console.log(result)).then(result => console.log('done', result), error => console.log(error));


function sync(generator, notify, notifyError) {
  return new Promise((resolve, reject) => {
    let count = 0;
    process(generator);

    function process(generator) {
      let {value, done} = generator.next();

      value
        .then(
          result => {
            count++;
            notify(result, count);
            if (done) resolve(count);
            else process(generator);
          },
          notifyError ? error : reject);

      function error(e) {
        count++;
        notifyError(e);
        if (done) resolve(count);
        else process(generator);
      }
    }
  });
}

function pipe(generator, notify, notifyError) {
  return new Promise((resolve, reject) => {
    process(generator);

    function process(generator) {
      let {value, done} = generator.next();

      value
        .then(
          next,
          error);
          //notifyError ? error : reject);

      function next(result, done) {
        notify(result);
        if (done) resolve(result);
        else process(generator);
      }

      function error(e) {
        if (!notifyError) reject(e);
        else {
          notifyError(e);
          if (done) resolve(count);
          else process(generator);
        }
      }
    }
  });
}

function async(maxConcurrent, generator, notify, notifyError) {
  return new Promise((resolve, reject) => {
    let count = 0,
        running = 0,
        finished = false;

    process(generator);

    function process(generator) {
      running++;
      count++;

      let {value, done} = generator.next();

      finished = done;

      value
        .then(
          result => {
            running--;
            notify(result, count);
            if (!finished) process(generator);
            else if (running === 0) resolve(count);
          },
          notifyError ? error : reject);

      if (running < maxConcurrent) process(generator);
    }

    function error(e) {
      running--;
      count++;
      notifyError(e);
      if (!finished) process(generator);
      else if (running === 0) resolve(count);
    }
  });
}

function demultiplex(generator, handlerConstructor, maxHandlers) {
  let availableHandlers = [];

  for (let i = 0; i < maxHandlers; i++) availableHandlers.push(handlerConstructor(i, maxHandlers));

  while (true) {
    let result = generator.next(),
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