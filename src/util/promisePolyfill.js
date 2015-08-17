let util = require('util');

export { or };

Promise.prototype.or = function(promiseFn, ...parameters) {
  console.log(util.inspect(this), promiseFn, ...parameters);
  let self = this;
  return new Promise(function(resolve, reject) {
    console.log('self', self);
    self
      .then(
        result => {
          console.log('result', result);
          resolve(result);
        },
        error => {
          console.log('error', error);
          promiseFn(...parameters).then((...args) => {
            resolve(...args);
          }, reject);
        });
  });

  // return this
  //         .then(
  //           (...args) => {
  //             return new Promise((resolve, reject) => { resolve(...args); }); },
  //           error => {
  //             console.log('error', error);
  //             promiseFn(...parameters)
  //                     .then((...args) => { return new Promise((resolve, reject) => { resolve(...args); }); });
  //           });
};

Promise.prototype.then = function(promisesOrFulfillFn) {};

function or(clauses, ...parameters) {
  let nextIndex = 0;
  return new Promise((resolve, reject) => {
    next();

    function next(error) {
      if (nextIndex == clauses.length) return reject(error);

      let clause = clauses[nextIndex++];

      console.log('clause', clause);

      clause(...parameters).then(resolve, reject);

      // clause(...parameters).then(result => {
      //   console.log('result', result);
      //   resolve(result);
      // }, error => {
      //   console.error(error);
      //   next(error);
      // });
    }
  });
}