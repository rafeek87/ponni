var { getTotalCount, getUserCount } = require("./sqlHelpers");

let getMasterCounter = async (tickets, ticketName, resultDate) => {
  let masterCounter = [];
  for (let ticket of tickets) {
    try {
      if (ticket[4] == "SUPER" || ticket[4] == "BOX") {
        // check if number already exists in counter
        let counterIndex = masterCounter.findIndex(
          (element) => element.number == ticket[1]
        );
        if (counterIndex == -1) {
          // create new record in counter
          let count1 = await getTotalCount(
            ticketName,
            resultDate,
            ticket[1],
            "SUPER"
          );
          let count2 = await getTotalCount(
            ticketName,
            resultDate,
            ticket[1],
            "BOX"
          );
          masterCounter.push({
            number: ticket[1],
            SUPER: Number(count1),
            BOX: Number(count2),
            newCountSuper: ticket[4] == "SUPER" ? Number(ticket[2]) : 0,
            newCountBox: ticket[4] == "BOX" ? Number(ticket[2]) : 0,
          });
        } else {
          // add new count to counter
          if (ticket[4] == "SUPER") {
            masterCounter[counterIndex].newCountSuper =
              masterCounter[counterIndex].newCountSuper + Number(ticket[2]);
          } else if (ticket[4] == "BOX") {
            masterCounter[counterIndex].newCountBox =
              masterCounter[counterIndex].newCountBox + Number(ticket[2]);
          }
        }
      } else if (ticket[4] == "AB" || ticket[4] == "BC" || ticket[4] == "AC") {
        // check if number already exists in counter
        let counterIndex = masterCounter.findIndex(
          (element) => element.number == ticket[1]
        );
        if (counterIndex == -1) {
          // create new record in counter
          let count1 = await getTotalCount(
            ticketName,
            resultDate,
            ticket[1],
            "AB"
          );
          let count2 = await getTotalCount(
            ticketName,
            resultDate,
            ticket[1],
            "BC"
          );
          let count3 = await getTotalCount(
            ticketName,
            resultDate,
            ticket[1],
            "AC"
          );
          masterCounter.push({
            number: ticket[1],
            AB: Number(count1),
            BC: Number(count2),
            AC: Number(count3),
            newCountAb: ticket[4] == "AB" ? Number(ticket[2]) : 0,
            newCountBc: ticket[4] == "BC" ? Number(ticket[2]) : 0,
            newCountAc: ticket[4] == "AC" ? Number(ticket[2]) : 0,
          });
        } else {
          // add new count to counter
          if (ticket[4] == "AB") {
            masterCounter[counterIndex].newCountAb =
              masterCounter[counterIndex].newCountAb + Number(ticket[2]);
          } else if (ticket[4] == "BC") {
            masterCounter[counterIndex].newCountBc =
              masterCounter[counterIndex].newCountBc + Number(ticket[2]);
          } else if (ticket[4] == "AC") {
            masterCounter[counterIndex].newCountAc =
              masterCounter[counterIndex].newCountAc + Number(ticket[2]);
          }
        }
      } else if (ticket[4] == "A" || ticket[4] == "B" || ticket[4] == "C") {
        // check if number already exists in counter
        let counterIndex = masterCounter.findIndex(
          (element) => element.number == ticket[1]
        );
        if (counterIndex == -1) {
          // create new record in counter
          let count1 = await getTotalCount(
            ticketName,
            resultDate,
            ticket[1],
            "A"
          );
          let count2 = await getTotalCount(
            ticketName,
            resultDate,
            ticket[1],
            "B"
          );
          let count3 = await getTotalCount(
            ticketName,
            resultDate,
            ticket[1],
            "C"
          );
          masterCounter.push({
            number: ticket[1],
            A: Number(count1),
            B: Number(count2),
            C: Number(count3),
            newCountA: ticket[4] == "A" ? Number(ticket[2]) : 0,
            newCountB: ticket[4] == "B" ? Number(ticket[2]) : 0,
            newCountC: ticket[4] == "C" ? Number(ticket[2]) : 0,
          });
        } else {
          // add new count to counter
          if (ticket[4] == "A") {
            masterCounter[counterIndex].newCountA =
              masterCounter[counterIndex].newCountA + Number(ticket[2]);
          } else if (ticket[4] == "B") {
            masterCounter[counterIndex].newCountB =
              masterCounter[counterIndex].newCountB + Number(ticket[2]);
          } else if (ticket[4] == "C") {
            masterCounter[counterIndex].newCountC =
              masterCounter[counterIndex].newCountC + Number(ticket[2]);
          }
        }
      }
    } catch (err) {
      console.log("getMasterCounter error");
      console.log(err);
    }
  }
  return masterCounter;
};

let getUserCounterV2 = async (
  tickets,
  ticketName,
  resultDate,
  userId,
  userType
) => {
  let userCounter = [];
  // await Promise.all(
  //   tickets.map(async (ticket) => {

  //   })
  // );
  for (let ticket of tickets) {
    try {
      if (ticket[4] == "SUPER" || ticket[4] == "BOX") {
        // check if number already exists in counter
        let counterIndex = userCounter.findIndex(
          (element) => element.number == ticket[1]
        );
        if (counterIndex == -1) {
          // create new record in counter
          let count1 = await getUserCount(
            ticketName,
            resultDate,
            ticket[1],
            "SUPER",
            userId,
            userType
          );
          let count2 = await getUserCount(
            ticketName,
            resultDate,
            ticket[1],
            "BOX",
            userId,
            userType
          );
          userCounter.push({
            number: ticket[1],
            SUPER: Number(count1),
            BOX: Number(count2),
            newCountSUPER: ticket[4] == "SUPER" ? Number(ticket[2]) : 0,
            newCountBOX: ticket[4] == "BOX" ? Number(ticket[2]) : 0,
          });
        } else {
          // add new count to counter
          if (ticket[4] == "SUPER") {
            userCounter[counterIndex].newCountSUPER =
              userCounter[counterIndex].newCountSUPER + Number(ticket[2]);
          } else if (ticket[4] == "BOX") {
            userCounter[counterIndex].newCountBOX =
              userCounter[counterIndex].newCountBOX + Number(ticket[2]);
          }
        }
      } else if (ticket[4] == "AB" || ticket[4] == "BC" || ticket[4] == "AC") {
        // check if number already exists in counter
        let counterIndex = userCounter.findIndex(
          (element) => element.number == ticket[1]
        );
        if (counterIndex == -1) {
          // create new record in counter
          let count1 = await getUserCount(
            ticketName,
            resultDate,
            ticket[1],
            "AB",
            userId,
            userType
          );
          let count2 = await getUserCount(
            ticketName,
            resultDate,
            ticket[1],
            "BC",
            userId,
            userType
          );
          let count3 = await getUserCount(
            ticketName,
            resultDate,
            ticket[1],
            "AC",
            userId,
            userType
          );
          userCounter.push({
            number: ticket[1],
            AB: Number(count1),
            BC: Number(count2),
            AC: Number(count3),
            newCountAB: ticket[4] == "AB" ? Number(ticket[2]) : 0,
            newCountBC: ticket[4] == "BC" ? Number(ticket[2]) : 0,
            newCountAC: ticket[4] == "AC" ? Number(ticket[2]) : 0,
          });
        } else {
          // add new count to counter
          if (ticket[4] == "AB") {
            userCounter[counterIndex].newCountAB =
              userCounter[counterIndex].newCountAB + Number(ticket[2]);
          } else if (ticket[4] == "BC") {
            userCounter[counterIndex].newCountBC =
              userCounter[counterIndex].newCountBC + Number(ticket[2]);
          } else if (ticket[4] == "AC") {
            userCounter[counterIndex].newCountAC =
              userCounter[counterIndex].newCountAC + Number(ticket[2]);
          }
        }
      } else if (ticket[4] == "A" || ticket[4] == "B" || ticket[4] == "C") {
        // check if number already exists in counter
        let counterIndex = userCounter.findIndex(
          (element) => element.number == ticket[1]
        );
        if (counterIndex == -1) {
          // create new record in counter
          let count1 = await getUserCount(
            ticketName,
            resultDate,
            ticket[1],
            "A",
            userId,
            userType
          );
          let count2 = await getUserCount(
            ticketName,
            resultDate,
            ticket[1],
            "B",
            userId,
            userType
          );
          let count3 = await getUserCount(
            ticketName,
            resultDate,
            ticket[1],
            "C",
            userId,
            userType
          );
          userCounter.push({
            number: ticket[1],
            A: Number(count1),
            B: Number(count2),
            C: Number(count3),
            newCountA: ticket[4] == "A" ? Number(ticket[2]) : 0,
            newCountB: ticket[4] == "B" ? Number(ticket[2]) : 0,
            newCountC: ticket[4] == "C" ? Number(ticket[2]) : 0,
          });
        } else {
          // add new count to counter
          if (ticket[4] == "A") {
            userCounter[counterIndex].newCountA =
              userCounter[counterIndex].newCountA + Number(ticket[2]);
          } else if (ticket[4] == "B") {
            userCounter[counterIndex].newCountB =
              userCounter[counterIndex].newCountB + Number(ticket[2]);
          } else if (ticket[4] == "C") {
            userCounter[counterIndex].newCountC =
              userCounter[counterIndex].newCountC + Number(ticket[2]);
          }
        }
      }
    } catch (err) {
      console.log("code Af34");
      console.log(err);
    }
  }
  return userCounter;
};

module.exports = {
  getMasterCounter,
  getUserCounterV2,
};
