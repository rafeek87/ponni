var AWS = require("aws-sdk");
const config = require("../config");
var dayjs = require("dayjs");
var utc = require("dayjs/plugin/utc");
var timezone = require("dayjs/plugin/timezone");
const mysql = require("mysql2/promise");
const { findPermutations } = require("../helpers/");

dayjs.extend(utc);
dayjs.extend(timezone);

const resultEntry = async (req, res) => {
  try {
    const docClient = new AWS.DynamoDB.DocumentClient();
    const connection = mysql.createPool(config.dbPoolConf);

    let resultDate = req.body.resultDate;
    let ticketName = req.body.ticketName;
    let results = JSON.parse(req.body.results);
    let sortedResults = results.slice(5).sort();

    let newResults = results.slice(0, 5).concat(sortedResults);
    let ExpressionAttributeValues = {
      ":firstResult": results[0],
      ":secondResult": results[1],
      ":thirdResult": results[2],
      ":fourthResult": results[3],
      ":fifthResult": results[4],
      ":updatedAt": dayjs().tz("Asia/Calcutta").format(),
    };

    let ExpressionAttributeNames = {
      "#firstResult": "first",
      "#secondResult": "second",
      "#thirdResult": "third",
      "#fourthResult": "fourth",
      "#fifthResult": "fifth",
      "#updatedAt": "updatedAt",
    };

    let UpdateExpression =
      "SET  #firstResult = :firstResult, #secondResult = :secondResult";
    UpdateExpression +=
      ", #thirdResult = :thirdResult, #fourthResult = :fourthResult, #fifthResult = :fifthResult, #updatedAt = :updatedAt";

    for (let index = 1; index < 31; index++) {
      // ExpressionAttributeValues
      ExpressionAttributeValues[`:G${index}`] = newResults[index + 4];
      // ExpressionAttributeNames
      ExpressionAttributeNames[`#G${index}`] = `G${index}`;
      // UpdateExpression
      UpdateExpression += `, #G${index} = :G${index}`;
    }

    var params = {
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      Key: {
        resultDate: resultDate,
        ticketName: ticketName,
      },
      ReturnValues: "ALL_NEW",
      TableName: "Results-Ponnani",
      UpdateExpression,
    };

    let queryRes = await docClient.update(params).promise();
    let parsedResults = parseUpdateRes(queryRes.Attributes);

    // check if results is empty
    // if yes, delete all winnings and return
    if (results.every((element) => element == "")) {
      // delete all winning data from table for resultDate
      let query2 = `DELETE FROM new_schema.winnings WHERE resultDate = ? AND ticketName = ?`;
      const [rows2] = await connection.execute(query2, [
        resultDate,
        ticketName,
      ]);
      return res.status(200).send({ status: "OK", winnings: [] });
    }

    // fetch all tickets from resultDate

    let query1 = `select bills.billNo, agentId, subStockistId, stockistId, resultDate, ticketName, stockistScheme, subStockistScheme, agentScheme, tickets.id as ticketId, count, mode, number from new_schema.bills, new_schema.tickets where bills.ticketName = ? AND tickets.billNo = bills.billNo and bills.resultDate = ?`;
    const [rows, fields] = await connection.execute(query1, [
      ticketName,
      resultDate,
    ]);

    // fetch scheme data
    let schemeParams = {
      TableName: "Schemes-Ponnani",
    };
    let schemeRes;
    let schemeResItems = [];
    do {
      schemeRes = await docClient.scan(schemeParams).promise();
      schemeResItems = schemeResItems.concat(schemeRes.Items);
      schemeParams.ExclusiveStartKey = schemeRes.LastEvaluatedKey;
    } while (typeof schemeRes.LastEvaluatedKey != "undefined");

    // calculate winners for each entry and store
    var winnings = [];
    await Promise.all(
      rows.map(async (entry, entryIndex) => {
        let didWin = checkIfWinning(entry, queryRes.Attributes);
        if (didWin) {
          // TODO refactor code
          // stockist
          if (entry.mode == "SUPER") {
            didWin.forEach((SuperWinning) => {
              let stockistSchemePrizes = schemeResItems.find(
                (item) => item.name == entry.stockistScheme
              ).tickets;
              let tt = stockistSchemePrizes.find(
                (item) => item.name == entry.ticketName
              ).modes;
              let ttt = tt.find((item) => item.name == entry.mode).rows;
              let tttt = ttt.find(
                (item) => item.position == SuperWinning.positionId
              );

              // sub stockist
              let stockistSchemePrizes2 = schemeResItems.find(
                (item) => item.name == entry.subStockistScheme
              ).tickets;
              let tt2 = stockistSchemePrizes2.find(
                (item) => item.name == entry.ticketName
              ).modes;
              let ttt2 = tt2.find((item) => item.name == entry.mode).rows;
              let tttt2 = ttt2.find(
                (item) => item.position == SuperWinning.positionId
              );

              // agent
              let stockistSchemePrizes3 = schemeResItems.find(
                (item) => item.name == entry.agentScheme
              ).tickets;
              let tt3 = stockistSchemePrizes3.find(
                (item) => item.name == entry.ticketName
              ).modes;
              let ttt3 = tt3.find((item) => item.name == entry.mode).rows;
              let tttt3 = ttt3.find(
                (item) => item.position == SuperWinning.positionId
              );

              winnings.push([
                entry.billNo,
                entry.ticketId,
                SuperWinning.positionId,
                tttt.amount,
                tttt.super,
                tttt2.super,
                tttt3.super,
                resultDate,
                entry.ticketName,
              ]);
            });
          } else if (entry.mode == "BOX") {
            let stockistSchemePrizes = schemeResItems.find(
              (item) => item.name == entry.stockistScheme
            ).tickets;
            let tt = stockistSchemePrizes.find(
              (item) => item.name == entry.ticketName
            ).modes;
            let ttt = tt.find((item) => item.name == entry.mode).rows;
            let firstPrizeStockist = ttt.find((item) => item.position == "1");
            let secondPrizeStockist = ttt.find((item) => item.position == "2");

            // sub stockist
            let stockistSchemePrizes2 = schemeResItems.find(
              (item) => item.name == entry.subStockistScheme
            ).tickets;
            let tt2 = stockistSchemePrizes2.find(
              (item) => item.name == entry.ticketName
            ).modes;
            let ttt2 = tt2.find((item) => item.name == entry.mode).rows;
            let firstPrizeSubStockist = ttt2.find(
              (item) => item.position == "1"
            );
            let secondPrizeSubStockist = ttt2.find(
              (item) => item.position == "2"
            );

            // agent
            let stockistSchemePrizes3 = schemeResItems.find(
              (item) => item.name == entry.agentScheme
            ).tickets;
            let tt3 = stockistSchemePrizes3.find(
              (item) => item.name == entry.ticketName
            ).modes;
            let ttt3 = tt3.find((item) => item.name == entry.mode).rows;
            let firstPrizeAgent = ttt3.find((item) => item.position == "1");
            let secondPrizeAgent = ttt3.find((item) => item.position == "2");

            if (didWin.position == "DIRECT") {
              winnings.push([
                entry.billNo,
                entry.ticketId,
                didWin.positionId,
                firstPrizeStockist.amount +
                  didWin.n * secondPrizeStockist.amount,
                firstPrizeStockist.super + didWin.n * secondPrizeStockist.super,
                firstPrizeSubStockist.super +
                  didWin.n * secondPrizeSubStockist.super,
                firstPrizeAgent.super + didWin.n * secondPrizeAgent.super,
                resultDate,
                entry.ticketName,
              ]);
            } else if (didWin.position == "INDIRECT") {
              winnings.push([
                entry.billNo,
                entry.ticketId,
                didWin.positionId,
                didWin.n * secondPrizeStockist.amount,
                didWin.n * secondPrizeStockist.super,
                didWin.n * secondPrizeSubStockist.super,
                didWin.n * secondPrizeAgent.super,
                resultDate,
                entry.ticketName,
              ]);
            }
          } else {
            let stockistSchemePrizes = schemeResItems.find(
              (item) => item.name == entry.stockistScheme
            ).tickets;
            let tt = stockistSchemePrizes.find(
              (item) => item.name == entry.ticketName
            ).modes;
            let ttt = tt.find((item) => item.name == entry.mode).rows;
            let tttt = ttt.find((item) => item.position == didWin.positionId);

            // sub stockist
            let stockistSchemePrizes2 = schemeResItems.find(
              (item) => item.name == entry.subStockistScheme
            ).tickets;
            let tt2 = stockistSchemePrizes2.find(
              (item) => item.name == entry.ticketName
            ).modes;
            let ttt2 = tt2.find((item) => item.name == entry.mode).rows;
            let tttt2 = ttt2.find((item) => item.position == didWin.positionId);

            // agent
            let stockistSchemePrizes3 = schemeResItems.find(
              (item) => item.name == entry.agentScheme
            ).tickets;
            let tt3 = stockistSchemePrizes3.find(
              (item) => item.name == entry.ticketName
            ).modes;
            let ttt3 = tt3.find((item) => item.name == entry.mode).rows;
            let tttt3 = ttt3.find((item) => item.position == didWin.positionId);

            winnings.push([
              entry.billNo,
              entry.ticketId,
              didWin.positionId,
              tttt.amount,
              tttt.super,
              tttt2.super,
              tttt3.super,
              resultDate,
              entry.ticketName,
            ]);
          }
        }
      })
    );

    // delete all winning data from table for resultDate
    let query2 = `DELETE FROM new_schema.winnings WHERE resultDate = ? AND ticketName = ?`;
    const [rows2] = await connection.execute(query2, [resultDate, ticketName]);

    // enter new data to winning
    let query3 = `INSERT INTO new_schema.winnings(billNo, ticketId, position, prize, stockistWin, subStockistWin, agentWin, resultDate, ticketName) VALUES ? `;
    const [rows3] = await connection.query(query3, [winnings]);
    await connection.end();

    // console.log(winnings);
    return res.status(200).send({ status: "OK", winnings });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

const getResults = (req, res) => {
  let { ticketName, resultDate } = req.query;
  var dynamodb = new AWS.DynamoDB();
  var params = {
    Key: {
      resultDate: {
        S: resultDate,
      },
      ticketName: {
        S: ticketName,
      },
    },
    TableName: "Results-Ponnani",
  };
  dynamodb.getItem(params, function (err, data) {
    if (err) {
      console.log("prrr");
      console.log(err, err.stack);
    } else {
      // console.log(data);
      res.status(200).send({ data: data.Item });
    }
  });
};

const checkIfWinning = (entry, resultData) => {
  if (entry.mode == "SUPER") {
    if (Object.values(resultData).includes(entry.number)) {
      let resArr = [];
      if (resultData.first == entry.number) {
        resArr.push({
          position: "FIRST",
          positionId: "1",
        });
      }
      if (resultData.second == entry.number) {
        resArr.push({
          position: "SECOND",
          positionId: "2",
        });
      }
      if (resultData.third == entry.number) {
        resArr.push({
          position: "THIRD",
          positionId: "3",
        });
      }
      if (resultData.fourth == entry.number) {
        resArr.push({
          position: "FOURTH",
          positionId: "4",
        });
      }
      if (resultData.fifth == entry.number) {
        resArr.push({
          position: "FIFTH",
          positionId: "5",
        });
      }
      for (let index = 1; index < 31; index++) {
        let t = `G${index}`;
        if (resultData[t] == entry.number) {
          resArr.push({
            position: t.toUpperCase(),
            positionId: "6",
          });
        }
      }
      return resArr;
    }
  } else if (entry.mode == "BOX") {
    let permutations = findPermutations(resultData.first);
    let rr;
    let flag = false;
    const result = permutations
      .slice(1, 6)
      .filter((item) => item == entry.number);
    if (permutations.slice(1, 6).includes(entry.number)) {
      rr = {
        position: "INDIRECT",
        positionId: "2",
      };
      flag = true;
    }
    if (entry.number == resultData.first) {
      flag = true;
      rr = {
        position: "DIRECT",
        positionId: "1",
      };
    }
    if (flag) {
      rr = {
        ...rr,
        n: result.length,
      };
      return rr;
    }
  } else if (entry.mode == "AB") {
    let prizedItem = resultData.first.slice(0, 2);
    resultData.first.slice(1, 2);
    if (entry.number == prizedItem) {
      return {
        position: "FIRST",
        positionId: "1",
      };
    }
  } else if (entry.mode == "BC") {
    let prizedItem = resultData.first.slice(1, 3);
    if (entry.number == prizedItem) {
      return {
        position: "FIRST",
        positionId: "1",
      };
    }
  } else if (entry.mode == "AC") {
    let prizedItem =
      resultData.first.slice(0, 1) + resultData.first.slice(2, 3);
    if (entry.number == prizedItem) {
      return {
        position: "FIRST",
        positionId: "1",
      };
    }
  } else if (entry.mode == "A") {
    let prizedItem = resultData.first.slice(0, 1);
    if (entry.number == prizedItem) {
      return {
        position: "FIRST",
        positionId: "1",
      };
    }
  } else if (entry.mode == "B") {
    let prizedItem = resultData.first.slice(1, 2);
    if (entry.number == prizedItem) {
      return {
        position: "FIRST",
        positionId: "1",
      };
    }
  } else if (entry.mode == "C") {
    let prizedItem = resultData.first.slice(2, 3);
    if (entry.number == prizedItem) {
      return {
        position: "FIRST",
        positionId: "1",
      };
    }
  }
  return false;
};

// const getPrizeValues =

const parseUpdateRes = (result) => {
  let newResult = {
    first: result.first.S,
    second: result.second.S,
    third: result.third.S,
    fourth: result.fourth.S,
    fifth: result.fifth.S,
    G1: result.G1.S,
    G2: result.G2.S,
    G3: result.G3.S,
    G4: result.G4.S,
    G5: result.G5.S,
    G6: result.G6.S,
    G7: result.G7.S,
    G8: result.G8.S,
    G9: result.G9.S,
    G10: result.G10.S,
    G11: result.G11.S,
    G12: result.G12.S,
    G13: result.G13.S,
    G14: result.G14.S,
    G15: result.G15.S,
    G16: result.G16.S,
    G17: result.G17.S,
    G18: result.G18.S,
    G19: result.G19.S,
    G20: result.G20.S,
    G21: result.G21.S,
    G22: result.G22.S,
    G23: result.G23.S,
    G24: result.G24.S,
    G25: result.G25.S,
    G26: result.G26.S,
    G27: result.G27.S,
    G28: result.G28.S,
    G29: result.G29.S,
    G30: result.G30.S,
  };
  return newResult;
};

module.exports = {
  resultEntry,
  getResults,
};
