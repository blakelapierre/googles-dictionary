export { ratelimit };

function ratelimit(rate, distribution) {
  //distribution = distribution || constant; We want this default, but don't really want a direct dependency to the constant file....what to do?
console.log(distribution);
  let perRate = (rate => {
    return {
      hour,
      hours
    };

    function hour(generator) {
      return hours(1, generator);
    }

    function hours(h, generator) {
      return { sync, async };

      function sync(notify, notifyError) {
        notify = notify || (() => {});

        let count = 0,
            waiting = false;
console.log('sync', notify);
        return new Promise((resolve, reject) => {
          console.log('sync promise started')
          let nextTimeout = distribution((h * 60 * 60 * 1000) / rate);

          setTimeout(resume, 0);

          function resume() {
            console.log('resuming');
            if (waiting){}

            count++;
console.log(count);
            let result = generator.next(),
                value = result.value,
                done = result.done;

            console.log('result', result);
            value
              .then(
                result => {
                  console.log('notifying result', result);
                  notify(result, count);
                  if (done) resolve(value);
                  else {
                    let timeout = nextTimeout();
                    console.log('setting timeout', timeout, 'ms');
                    setTimeout(resume, timeout);
                  }
                },
                error => {
                  console.log('sync error', error);
                  if (notifyError(error)) reject(error, count);
                });


            return value;
          }
        });
      }

      function async(maxConcurrent, notify, notifyError) {
        notify = notify || (() => console.log('default'));
        return new Promise((resolve, reject) => {
          let count = 0,
              running = 0,
              triggered = 0,
              finished = false;

          schedule(generator);

          function schedule(generator) {
            triggered++;

            if (running < maxConcurrent) run(generator);



            if (running < maxConcurrent) process(generator);
          }

          function run(generator) {
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
    }
  })(rate);

  return {
    get per() {
      return  perRate;
    }
  };
}