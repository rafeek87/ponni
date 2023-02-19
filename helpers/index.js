let findPermutations = (string) => {
  if (!string || typeof string !== "string") {
    return "Please enter a string";
  } else if (string.length < 2) {
    return string;
  }

  let permutationsArray = [];

  for (let i = 0; i < string.length; i++) {
    let char = string[i];

    // if (string.indexOf(char) != i)
    // continue

    let remainingChars =
      string.slice(0, i) + string.slice(i + 1, string.length);

    for (let permutation of findPermutations(remainingChars)) {
      permutationsArray.push(char + permutation);
    }
  }
  return permutationsArray;
};

let objectPropInArray = (list, userType, user, ticket = false) => {
  if (list.length > 0) {
    for (i in list) {
      if (ticket != false) {
        if (list[i][userType] == user && list[i]["ticket"] == ticket) {
          return i;
        }
      } else {
        if (list[i][userType] == user) {
          return i;
        }
      }
    }
  }
  return null;
};

let roundTo = (n, digits) => {
  var negative = false;
  if (digits === undefined) {
    digits = 0;
  }
  if (n < 0) {
    negative = true;
    n = n * -1;
  }
  var multiplicator = Math.pow(10, digits);
  n = parseFloat((n * multiplicator).toFixed(11));
  n = (Math.round(n) / multiplicator).toFixed(digits);
  if (negative) {
    n = (n * -1).toFixed(digits);
  }
  var value = Number(n);
  var res = n.split(".");
  if (res.length == 1 || res[1].length < 3) {
    value = value.toFixed(2);
  }
  return value;
};

module.exports = {
  findPermutations,
  objectPropInArray,
  roundTo,
};
