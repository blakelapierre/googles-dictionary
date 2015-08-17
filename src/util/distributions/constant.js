export {constant};

function constant(rate) {
  return () => { return rate; };
}