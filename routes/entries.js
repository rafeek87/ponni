const mysql = require("mysql2/promise");
var dayjs = require("dayjs");
var objectSupport = require("dayjs/plugin/objectSupport");
var utc = require("dayjs/plugin/utc");
var timezone = require("dayjs/plugin/timezone");
var AWS = require("aws-sdk");
const config = require("../config");
var { getBasicUserInfo } = require("../helpers/getBasicUserInfo");
var { getDateBlocks, getCountBlocks } = require("../helpers/getBlocks");
var { getMasterCounter, getUserCounterV2 } = require("../helpers/getCounters");
var memoize = require("memoizee");

dayjs.extend(objectSupport);
dayjs.extend(utc);
dayjs.extend(timezone);

const findStartTime = (ticketName, userType) => {
  let timeLockMessage;
  var start = null;
  var end = null;
  switch (ticketName) {
    case "DEAR1":
      start = 12 * 60 + 58;
      end = 21 * 60 + 00;
      timeLockMessage = "Entry Locked from 12:58 PM - 9:00 PM";
      break;
    case "LSK3":
      start = 15 * 60 + 05;
      end = 21 * 60 + 00;
      timeLockMessage = "Entry Locked from 3:05 PM - 9:00 PM";
      break;
    case "DEAR6":
      start = 17 * 60 + 58;
      end = 21 * 60 + 00;
      timeLockMessage = "Entry Locked from 5:58 PM - 9:00 PM";
      break;
    case "DEAR8":
      start = 19 * 60 + 58;
      end = 21 * 60 + 00;
      timeLockMessage = "Entry Locked from 7:58 PM - 9:00 PM";
      break;
    default:
      break;
  }
  // if (userType == "1") {
  //   start += 5;
  // }
  return { start, timeLockMessage, end };
};

const isBlockValid = (blockObj, ticket, ticketName) => {
  let cond1 = false;
  if (blockObj.mode == ticket[4]) {
    cond1 = true;
  } else {
    if (ticket[4] == "SUPER" || ticket[4] == "BOX") {
      cond1 = blockObj.mode == "ALL" && blockObj.group == "3";
    } else if (ticket[4] == "AB" || ticket[4] == "BC" || ticket[4] == "AC") {
      cond1 = blockObj.mode == "ALL" && blockObj.group == "2";
    } else if (ticket[4] == "A" || ticket[4] == "B" || ticket[4] == "C") {
      cond1 = blockObj.mode == "ALL" && blockObj.group == "1";
    }
  }
  let cond2 = blockObj.number == ticket[1] || blockObj.number == "ALL";
  let cond3 = blockObj.ticketName == ticketName || blockObj.ticketName == "ALL";

  return cond1 && cond2 && cond3;
};

const findAllCount = ({ ticketName, number, mode, counter }) => {
  let numberCount = counter.find((item) => item.number == number);
  if (mode == "SUPER" || mode == "BOX") {
    return Number(numberCount.SUPER) + Number(numberCount.BOX);
  } else if (mode == "AB" || mode == "BC" || mode == "AC") {
    return (
      Number(numberCount.AB) + Number(numberCount.BC) + Number(numberCount.AC)
    );
  } else if (mode == "A" || mode == "B" || mode == "C") {
    return (
      Number(numberCount.A) + Number(numberCount.B) + Number(numberCount.C)
    );
  }
};

const findModeCount = ({ ticketName, number, mode, counter }) => {
  let numberCount = counter.find((item) => item.number == number);
  return numberCount[mode];
};

const ticketEntry = async (req, res) => {
  try {
    let tickets = JSON.parse(req.body.tickets);
    let billNo = null;
    let { ticketName, userType } = req.body;
    let blockedTickets = [];
    let blockedIndexes = [];
    let ticketsCopy = [];
    let ticketsCopy2 = [];
    const validTickets = [];

    // Time lock validation
    var { start, timeLockMessage, end } = findStartTime(
      ticketName,
      req.body.enteredBy
    );
    let today = dayjs().tz("Asia/Calcutta");
    const now = today.hour() * 60 + today.minute();

    if (start <= now && now <= end) {
      return res.status(200).send({
        status: "BLOCKED",
        message: timeLockMessage,
      });
    }

    let resultDate;
    if (now < start) {
      // resultDate is currentDate
      resultDate = today.format("YYYY-MM-DD");
    } else {
      // resultDate is today + 1
      resultDate = today.add(1, "day").format("YYYY-MM-DD");
    }

    // BLOCKING STARTS
    // 1) user sales block
    let stockistData = await getBasicUserInfo(req.body.stockistId);
    let subStockistData = await getBasicUserInfo(req.body.subStockistId);
    let agentData = await getBasicUserInfo(req.body.agentId);

    if (stockistData.Items[0].isSalesBlocked) {
      return res.status(200).send({
        status: "BLOCKED",
        message: `Entry blocked for ${stockistData.Items[0].name}`,
      });
    } else if (subStockistData.Items[0].isSalesBlocked) {
      return res.status(200).send({
        status: "BLOCKED",
        message: `Entry blocked for ${subStockistData.Items[0].name}`,
      });
    } else if (agentData.Items[0].isSalesBlocked) {
      return res.status(200).send({
        status: "BLOCKED",
        message: `Entry blocked for ${agentData.Items[0].name}`,
      });
    }

    // 2) date block
    let blockDate = await getDateBlocks(ticketName, resultDate);
    if (blockDate.length != 0) {
      // entry blocked for the date
      return res.status(200).send({
        status: "BLOCKED",
        message: `Entry blocked for ${ticketName} on ${resultDate}`,
      });
    }

    // 3) admin ticket counter blocking
    if (userType != "1") {
      let blockedData = await getCountBlocks(ticketName);
      // console.log("blockedData", blockedData);
      let PromiseArr = [];
      if (blockedData.Count != 0) {
        // get total count of tickets
        var masterCounter = await getMasterCounter(
          tickets,
          ticketName,
          resultDate
        );

        // console.log({ masterCounter });

        // iterating tickets
        tickets.forEach((ticket) => {
          // set flag to check if ticket is blocked or not
          let isBlocked = false;
          blockedData.forEach((blockObj) => {
            // check if ticket is already blocked
            if (!isBlocked) {
              if (isBlockValid(blockObj, ticket, ticketName)) {
                // valid block
                if (blockObj.count == 0) {
                  // add ticket to blocked tickets
                  isBlocked = true;
                } else {
                  // find existing count
                  let ticketCount;
                  if (blockObj.mode == "ALL") {
                    ticketCount = findAllCount({
                      ticketName,
                      number: ticket[1],
                      mode: ticket[4],
                      counter: masterCounter,
                    });
                  } else {
                    ticketCount = findModeCount({
                      ticketName,
                      number: ticket[1],
                      mode: ticket[4],
                      counter: masterCounter,
                    });
                  }

                  if (
                    Number(ticketCount) + Number(ticket[2]) >
                    Number(blockObj.count)
                  ) {
                    // add ticket to blocked tickets
                    isBlocked = true;
                  }
                }
              }
            }
          });
          if (!isBlocked) {
            // update count in master counter
            const counterIndex = masterCounter.findIndex(
              (item) => item.number == ticket[1]
            );
            masterCounter[counterIndex][ticket[4]] += Number(ticket[2]);
            ticketsCopy.push(ticket);
          } else {
            blockedTickets.push([
              ticket[0],
              ticket[1],
              Number(ticket[2]),
              Number(ticket[2]),
            ]);
          }
        });
      }
    } else {
      // add all tickets to ticketsCopy
      ticketsCopy = [...tickets];
    }

    // 4) stockist / substockist / agent ticket counter block
    if (userType != "1") {
      blockedIndexes = [];
      let stockistBlockList = stockistData.Items[0].isEntryBlocked.filter(
        (i) => i.ticketName == ticketName || i.ticketName == "ALL"
      );
      // console.log("stockistBlockList", stockistBlockList);
      let subStockistBlockList = subStockistData.Items[0].isEntryBlocked.filter(
        (i) => i.ticketName == ticketName || i.ticketName == "ALL"
      );
      let agentBlockList = agentData.Items[0].isEntryBlocked.filter(
        (i) => i.ticketName == ticketName || i.ticketName == "ALL"
      );

      // console.log({ agentBlockList });
      // console.log({ subStockistBlockList });
      // console.log({ stockistBlockList });

      let stockistCounterPromise = getUserCounterV2(
        tickets,
        ticketName,
        resultDate,
        req.body.stockistId,
        "2"
      );
      let subStockistCounterPromise = getUserCounterV2(
        tickets,
        ticketName,
        resultDate,
        req.body.subStockistId,
        "3"
      );
      let agentCounterPromise = getUserCounterV2(
        tickets,
        ticketName,
        resultDate,
        req.body.agentId,
        "4"
      );

      const [stockistCounter, subStockistCounter, agentCounter] =
        await Promise.all([
          stockistCounterPromise,
          subStockistCounterPromise,
          agentCounterPromise,
        ]);

      // console.log({ stockistCounter });
      // console.log({ subStockistCounter });
      // console.log({ agentCounter });
      // START
      // iterating tickets
      ticketsCopy.forEach((ticket, ticketIndex) => {
        // set flag to check if ticket is blocked or not
        let isBlocked = false;
        // iterating blocks
        [agentBlockList, subStockistBlockList, stockistBlockList].forEach(
          (block, blockIndex) => {
            // get counter respective to block types
            let targetCounter;
            switch (blockIndex) {
              case 0:
                targetCounter = agentCounter;
                break;
              case 1:
                targetCounter = subStockistCounter;
                break;
              case 2:
                targetCounter = stockistCounter;
                break;
              default:
                targetCounter = agentCounter;
                break;
            }
            block.forEach((blockObj) => {
              if (!isBlocked) {
                if (isBlockValid(blockObj, ticket, ticketName)) {
                  // valid block
                  if (Number(blockObj.count) == 0) {
                    // add ticket to blocked tickets
                    isBlocked = true;
                  } else {
                    // find existing count
                    let ticketCount;
                    if (blockObj.mode == "ALL") {
                      ticketCount = findAllCount({
                        ticketName,
                        number: ticket[1],
                        mode: ticket[4],
                        counter: targetCounter,
                      });
                    } else {
                      ticketCount = findModeCount({
                        ticketName,
                        number: ticket[1],
                        mode: ticket[4],
                        counter: targetCounter,
                      });
                    }

                    if (
                      Number(ticketCount) + Number(ticket[2]) >
                      Number(blockObj.count)
                    ) {
                      // add ticket to blocked tickets
                      isBlocked = true;
                    }
                  }
                }
              }
            });
          }
        );
        if (!isBlocked) {
          // update count in target counter
          [agentCounter, subStockistCounter, stockistCounter].forEach(
            (counter) => {
              const counterIndex = counter.findIndex(
                (item) => item.number == ticket[1]
              );
              counter[counterIndex][ticket[4]] += Number(ticket[2]);
            }
          );
          validTickets.push(ticket);
        } else {
          blockedTickets.push([
            ticket[0],
            ticket[1],
            Number(ticket[2]),
            Number(ticket[2]),
          ]);
        }
      });
      // END

      // remove blockedTickets from tickets
      ticketsCopy2 = [...validTickets];
    } else {
      ticketsCopy2 = [...ticketsCopy];
    }

    // if tickets is empty, return
    if (ticketsCopy2.length == 0) {
      // parse blockedTickets to remove duplicate values
      // const parsedBlockedTickets = [];
      // blockedTickets.forEach((item1) => {
      //   let flag = true;
      //   parsedBlockedTickets.forEach((item2) => {
      //     if (item1[0] === item2[0] && item1[1] === item2[1]) {
      //       flag = false;
      //     }
      //   });
      //   if (flag) {
      //     parsedBlockedTickets.push(item1);
      //   }
      // });
      return res.status(200).send({
        status: "OK",
        billNo: null,
        message: "No tickets to enter",
        blockedTickets,
      });
    }

    // TICKETS ENTRY
    let query1 = `INSERT INTO new_schema.bills (agentId, agentScheme, enteredBy, resultDate, stockistId, stockistScheme, subStockistId, subStockistScheme, ticketName, createdAt) `;
    query1 =
      query1 +
      `VALUES ('${req.body.agentId}', '${req.body.agentScheme}', '${
        req.body.enteredBy
      }', '${resultDate}', '${req.body.stockistId}', '${
        req.body.stockistScheme
      }', '${req.body.subStockistId}', '${
        req.body.subStockistScheme
      }', '${ticketName}', '${today.format("YYYY-MM-DD HH-mm-ss", {
        timeZone: "Asia/Calcutta",
      })}' )`;
    const connection = await mysql.createConnection(config.dbPoolConf);
    await connection.query("START TRANSACTION");
    const [response, meta] = await connection.query(query1);
    billNo = response.insertId;
    // let temp = [["DEAR8-BOX", "512", 10, "100", "BOX", 10, 10, 7.75, 7.75],["DEAR8-SUPER", "256", 10, "100", "BOX", 10, 10, 7.75, 7.75]]
    let ticketsToEnter = [];
    ticketsCopy2.forEach((item, index) => {
      ticketsToEnter.push([
        response.insertId,
        item[8],
        item[5],
        item[2],
        item[4],
        item[1],
        item[7],
        item[6],
      ]);
    });
    let query2 = `INSERT INTO new_schema.tickets(billNo, adminPrice, agentPrice, count, mode, number, stockistPrice, subStockistPrice) VALUES ?`;
    const [response2, meta2] = await connection.query(query2, [ticketsToEnter]);
    await connection.commit();
    // await connection.release();
    await connection.end();

    // parse blockedTickets to remove duplicate values
    // const parsedBlockedTickets = [];
    // blockedTickets.forEach((item1) => {
    //   let flag = true;
    //   parsedBlockedTickets.forEach((item2) => {
    //     if (item1[0] === item2[0] && item1[1] === item2[1]) {
    //       flag = false;
    //     }
    //   });
    //   if (flag) {
    //     parsedBlockedTickets.push(item1);
    //   }
    // });

    res.status(200).send({
      status: "OK",
      billNo,
      message: "OK",
      blockedTickets,
    });
  } catch (error) {
    console.log("error");
    console.log(error);
    return res.status(500).send({ error });
  }
};

const getBill = async (req, res) => {
  let { billNo, userId, userType } = req.query;
  try {
    const connection = mysql.createPool(config.dbPoolConf);

    // validate user access to bill
    if (userType != "1") {
      // check if user has permission to edit
      let targetUserType;
      switch (userType) {
        case "2":
          targetUserType = "stockistId";
          break;
        case "3":
          targetUserType = "subStockistId";
          break;
        case "4":
          targetUserType = "agentId";
          break;
        default:
          targetUserType = "agentId";
          break;
      }
      let query1 = `SELECT * FROM new_schema.bills WHERE billNo = ? AND ${targetUserType} = ?`;
      let query2 = `SELECT id, agentPrice as price, count, mode, number, billNo FROM new_schema.tickets WHERE billNo = ?`;
      var [rows, fields] = await connection.execute(query1, [billNo, userId]);
      var [rows2, fields2] = await connection.execute(query2, [billNo]);
      if (rows2.length == 0) {
        // no access
        return res.status(403).send({ message: "Verification failed" });
      }
    } else if (userType == "1") {
      let query1 = `SELECT * FROM new_schema.bills WHERE billNo = ?`;
      let query2 = `SELECT id, agentPrice as price, count, mode, number, billNo FROM new_schema.tickets WHERE billNo = ?`;
      var [rows, fields] = await connection.execute(query1, [billNo]);
      var [rows2, fields2] = await connection.execute(query2, [billNo]);
    }
    await connection.end();

    // check if bill can be edited
    let currentResultDate,
      billLock = false;
    if (rows.length > 0) {
      // get current date
      var { start } = findStartTime(rows[0].ticketName, userType);
      let today = dayjs().tz("Asia/Calcutta");
      const now = today.hour() * 60 + today.minute();

      if (now < start) {
        currentResultDate = today.format("YYYY-MM-DD");
      } else {
        currentResultDate = today.add(1, "day").format("YYYY-MM-DD");
      }
      if (currentResultDate != rows[0].resultDate) {
        billLock = true;
      }
    }

    return res
      .status(200)
      .send({ status: "OK", billData: rows, tickets: rows2, billLock });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

const deleteBill = async (req, res) => {
  let { billNo, userId, userType } = req.query;
  try {
    const connection = mysql.createPool(config.dbPoolConf);

    // validate user access to bill
    if (userType != "1") {
      // check if user has permission to edit
      let targetUserType;
      switch (userType) {
        case "2":
          targetUserType = "stockistId";
          break;
        case "3":
          targetUserType = "subStockistId";
          break;
        case "4":
          targetUserType = "agentId";
          break;
        default:
          targetUserType = "agentId";
          break;
      }
      let query2 = `SELECT billNo, resultDate, ticketName from new_schema.bills where billNo = ? AND ${targetUserType} = ?`;
      var [rows2] = await connection.execute(query2, [billNo, userId]);
      if (rows2.length == 0) {
        // no access
        return res.status(403).send({ message: "Verification failed" });
      }
    } else if (userType == "1") {
      let query2 = `SELECT billNo, resultDate, ticketName from new_schema.bills where billNo = ?`;
      var [rows2] = await connection.execute(query2, [billNo]);
      if (rows2.length == 0) {
        // no data
        return res.status(403).send({ message: "No Data" });
      }
    }

    // check if bill can be edited
    // get current date
    var { start } = findStartTime(rows2[0].ticketName, userType);
    let today = dayjs().tz("Asia/Calcutta");
    const now = today.hour() * 60 + today.minute();
    let currentResultDate;
    if (now < start) {
      currentResultDate = today.format("YYYY-MM-DD");
    } else {
      currentResultDate = today.add(1, "day").format("YYYY-MM-DD");
    }
    if (currentResultDate != rows2[0].resultDate) {
      return res.status(200).send({ message: "TIMELOCK" });
    }

    let query1 = `DELETE FROM new_schema.bills WHERE billNo = ${billNo}`;
    const [rows, fields] = await connection.execute(query1);
    await connection.end();

    return res.status(200).send({ message: "OK" });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

const editTicket = async (req, res) => {
  try {
    let { newCount, userId, userType, ticketId, billNo } = req.body;
    let isTicketBlocked = false;
    const connection = mysql.createPool(config.dbPoolConf);

    if (userType != "1") {
      // check if user has permission to edit
      let targetUserType;
      switch (userType) {
        case "2":
          targetUserType = "stockistId";
          break;
        case "3":
          targetUserType = "subStockistId";
          break;
        case "4":
          targetUserType = "agentId";
          break;
        default:
          targetUserType = "agentId";
          break;
      }
      let query2 = `SELECT billNo, resultDate, ticketName, stockistId, subStockistId, agentId from new_schema.bills where billNo = ? AND ${targetUserType} = ?`;
      var [rows2] = await connection.execute(query2, [billNo, userId]);
      if (rows2.length == 0) {
        // no access
        return res.status(403).send({ message: "Verification failed" });
      }
    } else if (userType == "1") {
      let query2 = `SELECT billNo, resultDate, ticketName from new_schema.bills where billNo = ?`;
      var [rows2] = await connection.execute(query2, [billNo]);
      if (rows2.length == 0) {
        // no data
        return res.status(403).send({ message: "No Data" });
      }
    }

    const ticketName = rows2[0].ticketName;
    const stockistId = rows2[0].stockistId;
    const subStockistId = rows2[0].subStockistId;
    const agentId = rows2[0].agentId;
    const resultDate = rows2[0].resultDate;

    // check if bill is locked
    // get current date
    var { start } = findStartTime(rows2[0].ticketName, userType);
    let today = dayjs().tz("Asia/Calcutta");
    const now = today.hour() * 60 + today.minute();
    let currentResultDate;
    if (now < start) {
      currentResultDate = today.format("YYYY-MM-DD");
    } else {
      currentResultDate = today.add(1, "day").format("YYYY-MM-DD");
    }
    if (currentResultDate != resultDate) {
      return res.status(200).send({ message: "TIMELOCK" });
    }

    // get ticket data
    let query3 = `SELECT * FROM new_schema.tickets WHERE id = ?`;
    const [rows3] = await connection.execute(query3, [ticketId]);
    const currentCount = rows3[0].count;

    if (userType != "1") {
      // if new count is less than or equal to current count, bypass all checks
      // if new count is greater than current count, proceed
      if (newCount > currentCount) {
        // user data
        const stockistData = await getBasicUserInfo(stockistId);
        const subStockistData = await getBasicUserInfo(subStockistId);
        const agentData = await getBasicUserInfo(agentId);

        // get total count data
        // const ticket = ["DEAR8-SUPER", "256", 1, "8.00", "SUPER", 8, 7.75, 7.5, 7.5];
        const ticket = [
          `${ticketName}-${rows3[0].mode}`,
          rows3[0].number,
          newCount - rows3[0].count,
          rows3[0].agentPrice * (newCount - rows3[0].count),
          rows3[0].mode,
          rows3[0].agentPrice,
          rows3[0].subStockistPrice,
          rows3[0].stockistPrice,
          rows3[0].adminPrice,
        ];

        // admin ticket counter blocking
        const blockedData = await getCountBlocks(ticketName);
        if (blockedData.Count != 0) {
          // get total count of tickets
          const masterCounter = await getMasterCounter(
            [ticket],
            ticketName,
            resultDate
          );
          // Iterate blocked data
          await Promise.all(
            blockedData.map(async (blockObj) => {
              let checkCondition1 = ticket[4] == blockObj.mode;
              let checkCondition2 = false;
              if (ticket[4] == "SUPER" || ticket[4] == "BOX") {
                checkCondition2 =
                  blockObj.mode == "ALL" && blockObj.group == "3";
              } else if (
                ticket[4] == "AB" ||
                ticket[4] == "BC" ||
                ticket[4] == "AC"
              ) {
                checkCondition2 =
                  blockObj.mode == "ALL" && blockObj.group == "2";
              } else if (
                ticket[4] == "A" ||
                ticket[4] == "B" ||
                ticket[4] == "C"
              ) {
                checkCondition2 =
                  blockObj.mode == "ALL" && blockObj.group == "1";
              }

              if (checkCondition1 || checkCondition2) {
                // block mode matching (SUPER, BOX, AB etc)
                // check if number matches
                if (blockObj.number == "ALL" || blockObj.number == ticket[1]) {
                  // ticket and block number matching
                  if (Number(blockObj.count) == 0) {
                    // check if count is Zero - no need to take count
                    isTicketBlocked = true;
                  } else {
                    // find counter
                    let counter;
                    // counter for ALL Mode
                    if (blockObj.mode == "ALL") {
                      let tempIndex = masterCounter.findIndex(
                        (item) => item.number == ticket[1]
                      );
                      if (ticket[4] == "SUPER" || ticket[4] == "BOX") {
                        if (ticket[4] == "SUPER") {
                          masterCounter[tempIndex].SUPER =
                            Number(masterCounter[tempIndex].SUPER) +
                            Number(ticket[2]);
                        } else if (ticket[4] == "BOX") {
                          masterCounter[tempIndex].BOX =
                            Number(masterCounter[tempIndex].BOX) +
                            Number(ticket[2]);
                        }
                        counter =
                          Number(masterCounter[tempIndex].SUPER) +
                          Number(masterCounter[tempIndex].BOX);
                      } else if (
                        ticket[4] == "AB" ||
                        ticket[4] == "BC" ||
                        ticket[4] == "AC"
                      ) {
                        if (ticket[4] == "AB") {
                          masterCounter[tempIndex].AB =
                            Number(masterCounter[tempIndex].AB) +
                            Number(ticket[2]);
                        } else if (ticket[4] == "BC") {
                          masterCounter[tempIndex].BC =
                            Number(masterCounter[tempIndex].BC) +
                            Number(ticket[2]);
                        } else if (ticket[4] == "AC") {
                          masterCounter[tempIndex].AC =
                            Number(masterCounter[tempIndex].AC) +
                            Number(ticket[2]);
                        }
                        counter =
                          Number(masterCounter[tempIndex].AB) +
                          Number(masterCounter[tempIndex].BC) +
                          Number(masterCounter[tempIndex].AC);
                      } else if (
                        ticket[4] == "A" ||
                        ticket[4] == "B" ||
                        ticket[4] == "C"
                      ) {
                        if (ticket[4] == "A") {
                          masterCounter[tempIndex].A =
                            Number(masterCounter[tempIndex].A) +
                            Number(ticket[2]);
                        } else if (ticket[4] == "B") {
                          masterCounter[tempIndex].B =
                            Number(masterCounter[tempIndex].B) +
                            Number(ticket[2]);
                        } else if (ticket[4] == "C") {
                          masterCounter[tempIndex].C =
                            Number(masterCounter[tempIndex].C) +
                            Number(ticket[2]);
                        }
                        counter =
                          Number(masterCounter[tempIndex].A) +
                          Number(masterCounter[tempIndex].B) +
                          Number(masterCounter[tempIndex].C);
                      }
                    } else {
                      // counter for NOT ALL Mode
                      if (ticket[4] == "SUPER") {
                        let tempIndex = masterCounter.findIndex(
                          (item) => item.number == ticket[1]
                        );
                        masterCounter[tempIndex].SUPER =
                          Number(masterCounter[tempIndex].SUPER) +
                          Number(ticket[2]);
                        counter = masterCounter[tempIndex].SUPER;
                      } else if (ticket[4] == "BOX") {
                        let tempIndex = masterCounter.findIndex(
                          (item) => item.number == ticket[1]
                        );
                        masterCounter[tempIndex].BOX =
                          Number(masterCounter[tempIndex].BOX) +
                          Number(ticket[2]);
                        counter = masterCounter[tempIndex].BOX;
                      } else if (ticket[4] == "AB") {
                        let tempIndex = masterCounter.findIndex(
                          (item) => item.number == ticket[1]
                        );
                        masterCounter[tempIndex].AB =
                          Number(masterCounter[tempIndex].AB) +
                          Number(ticket[2]);
                        counter = masterCounter[tempIndex].AB;
                      } else if (ticket[4] == "BC") {
                        let tempIndex = masterCounter.findIndex(
                          (item) => item.number == ticket[1]
                        );
                        masterCounter[tempIndex].BC =
                          Number(masterCounter[tempIndex].BC) +
                          Number(ticket[2]);
                        counter = masterCounter[tempIndex].BC;
                      } else if (ticket[4] == "AC") {
                        let tempIndex = masterCounter.findIndex(
                          (item) => item.number == ticket[1]
                        );
                        masterCounter[tempIndex].AC =
                          Number(masterCounter[tempIndex].AC) +
                          Number(ticket[2]);
                        counter = masterCounter[tempIndex].AC;
                      } else if (ticket[4] == "A") {
                        let tempIndex = masterCounter.findIndex(
                          (item) => item.number == ticket[1]
                        );
                        masterCounter[tempIndex].A =
                          Number(masterCounter[tempIndex].A) +
                          Number(ticket[2]);
                        counter = masterCounter[tempIndex].A;
                      } else if (ticket[4] == "B") {
                        let tempIndex = masterCounter.findIndex(
                          (item) => item.number == ticket[1]
                        );
                        masterCounter[tempIndex].B =
                          Number(masterCounter[tempIndex].B) +
                          Number(ticket[2]);
                        counter = masterCounter[tempIndex].B;
                      } else if (ticket[4] == "C") {
                        let tempIndex = masterCounter.findIndex(
                          (item) => item.number == ticket[1]
                        );
                        masterCounter[tempIndex].C =
                          Number(masterCounter[tempIndex].C) +
                          Number(ticket[2]);
                        counter = masterCounter[tempIndex].C;
                      }
                    }
                    if (counter > Number(blockObj.count)) {
                      isTicketBlocked = true;
                    }
                  }
                }
              }
            })
          );
        }

        // stockist / substockist / agent ticket counter block
        // check if entry is already blocked
        if (isTicketBlocked == false) {
          // get blocklist
          let stockistBlockList = stockistData.Items[0].isEntryBlocked.filter(
            (i) => i.ticketName == ticketName || i.ticketName == "ALL"
          );
          let subStockistBlockList =
            subStockistData.Items[0].isEntryBlocked.filter(
              (i) => i.ticketName == ticketName || i.ticketName == "ALL"
            );
          let agentBlockList = agentData.Items[0].isEntryBlocked.filter(
            (i) => i.ticketName == ticketName || i.ticketName == "ALL"
          );

          // get user counter
          const stockistCounter = await getUserCounterV2(
            [ticket],
            ticketName,
            resultDate,
            stockistId,
            "2"
          );
          const subStockistCounter = await getUserCounterV2(
            [ticket],
            ticketName,
            resultDate,
            subStockistId,
            "3"
          );
          const agentCounter = await getUserCounterV2(
            [ticket],
            ticketName,
            resultDate,
            agentId,
            "4"
          );

          // console.log("stockistCounter", stockistCounter);
          // console.log("subStockistCounter", subStockistCounter);
          // console.log("agentCounter", agentCounter);

          await Promise.all(
            [agentBlockList, subStockistBlockList, stockistBlockList].map(
              async (blockList, index) => {
                let targetCounter;
                switch (index) {
                  case 0:
                    targetCounter = agentCounter;
                    break;
                  case 1:
                    targetCounter = subStockistCounter;
                    break;
                  case 2:
                    targetCounter = stockistCounter;
                    break;
                  default:
                    targetCounter = agentCounter;
                    break;
                }
                await Promise.all(
                  blockList.map(async (blockObj) => {
                    let checkCondition1 = ticket[4] == blockObj.mode;
                    let checkCondition2 = false;

                    if (ticket[4] == "SUPER" || ticket[4] == "BOX") {
                      checkCondition2 =
                        blockObj.mode == "ALL" && blockObj.group == "3";
                    } else if (
                      ticket[4] == "AB" ||
                      ticket[4] == "BC" ||
                      ticket[4] == "AC"
                    ) {
                      checkCondition2 =
                        blockObj.mode == "ALL" && blockObj.group == "2";
                    } else if (
                      ticket[4] == "A" ||
                      ticket[4] == "B" ||
                      ticket[4] == "C"
                    ) {
                      checkCondition2 =
                        blockObj.mode == "ALL" && blockObj.group == "1";
                    }

                    if (checkCondition1 || checkCondition2) {
                      // block mode matching (SUPER, BOX, AB etc)
                      // check if number matches
                      if (
                        blockObj.number == "ALL" ||
                        blockObj.number == ticket[1]
                      ) {
                        // ticket and block number matching
                        if (blockObj.count == 0) {
                          // check if count is Zero - no need to take count
                          isTicketBlocked = true;
                        } else {
                          // find counter
                          let counter;
                          // counter for ALL
                          if (blockObj.mode == "ALL") {
                            let tempIndex = targetCounter.findIndex(
                              (item) => item.number == ticket[1]
                            );
                            if (ticket[4] == "SUPER" || ticket[4] == "BOX") {
                              if (ticket[4] == "SUPER") {
                                targetCounter[tempIndex].SUPER =
                                  Number(targetCounter[tempIndex].SUPER) +
                                  Number(ticket[2]);
                              } else if (ticket[4] == "BOX") {
                                targetCounter[tempIndex].BOX =
                                  Number(targetCounter[tempIndex].BOX) +
                                  Number(ticket[2]);
                              }
                              counter =
                                Number(targetCounter[tempIndex].SUPER) +
                                Number(targetCounter[tempIndex].BOX);
                            } else if (
                              ticket[4] == "AB" ||
                              ticket[4] == "BC" ||
                              ticket[4] == "AC"
                            ) {
                              if (ticket[4] == "AB") {
                                targetCounter[tempIndex].AB =
                                  Number(targetCounter[tempIndex].AB) +
                                  Number(ticket[2]);
                              } else if (ticket[4] == "BC") {
                                targetCounter[tempIndex].BC =
                                  Number(targetCounter[tempIndex].BC) +
                                  Number(ticket[2]);
                              } else if (ticket[4] == "AC") {
                                targetCounter[tempIndex].AC =
                                  Number(targetCounter[tempIndex].AC) +
                                  Number(ticket[2]);
                              }
                              counter =
                                Number(targetCounter[tempIndex].AB) +
                                Number(targetCounter[tempIndex].BC) +
                                Number(targetCounter[tempIndex].AC);
                            } else if (
                              ticket[4] == "A" ||
                              ticket[4] == "B" ||
                              ticket[4] == "C"
                            ) {
                              if (ticket[4] == "A") {
                                targetCounter[tempIndex].A =
                                  Number(targetCounter[tempIndex].A) +
                                  Number(ticket[2]);
                              } else if (ticket[4] == "B") {
                                targetCounter[tempIndex].B =
                                  Number(targetCounter[tempIndex].B) +
                                  Number(ticket[2]);
                              } else if (ticket[4] == "C") {
                                targetCounter[tempIndex].C =
                                  Number(targetCounter[tempIndex].C) +
                                  Number(ticket[2]);
                              }
                              counter =
                                Number(targetCounter[tempIndex].A) +
                                Number(targetCounter[tempIndex].B) +
                                Number(targetCounter[tempIndex].C);
                            }
                          } else {
                            // counter for NOT ALL Mode
                            if (ticket[4] == "SUPER") {
                              let tempIndex = targetCounter.findIndex(
                                (item) => item.number == ticket[1]
                              );
                              targetCounter[tempIndex].SUPER =
                                Number(targetCounter[tempIndex].SUPER) +
                                Number(ticket[2]);
                              counter = targetCounter[tempIndex].SUPER;
                            } else if (ticket[4] == "BOX") {
                              let tempIndex = targetCounter.findIndex(
                                (item) => item.number == ticket[1]
                              );
                              targetCounter[tempIndex].BOX =
                                Number(targetCounter[tempIndex].BOX) +
                                Number(ticket[2]);
                              counter = targetCounter[tempIndex].BOX;
                            } else if (ticket[4] == "AB") {
                              let tempIndex = targetCounter.findIndex(
                                (item) => item.number == ticket[1]
                              );
                              targetCounter[tempIndex].AB =
                                Number(targetCounter[tempIndex].AB) +
                                Number(ticket[2]);
                              counter = targetCounter[tempIndex].AB;
                            } else if (ticket[4] == "BC") {
                              let tempIndex = targetCounter.findIndex(
                                (item) => item.number == ticket[1]
                              );
                              targetCounter[tempIndex].BC =
                                Number(targetCounter[tempIndex].BC) +
                                Number(ticket[2]);
                              counter = targetCounter[tempIndex].BC;
                            } else if (ticket[4] == "AC") {
                              let tempIndex = targetCounter.findIndex(
                                (item) => item.number == ticket[1]
                              );
                              targetCounter[tempIndex].AC =
                                Number(targetCounter[tempIndex].AC) +
                                Number(ticket[2]);
                              counter = targetCounter[tempIndex].AC;
                            } else if (ticket[4] == "A") {
                              let tempIndex = targetCounter.findIndex(
                                (item) => item.number == ticket[1]
                              );
                              targetCounter[tempIndex].A =
                                Number(targetCounter[tempIndex].A) +
                                Number(ticket[2]);
                              counter = targetCounter[tempIndex].A;
                            } else if (ticket[4] == "B") {
                              let tempIndex = targetCounter.findIndex(
                                (item) => item.number == ticket[1]
                              );
                              targetCounter[tempIndex].B =
                                Number(targetCounter[tempIndex].B) +
                                Number(ticket[2]);
                              counter = targetCounter[tempIndex].B;
                            } else if (ticket[4] == "C") {
                              let tempIndex = targetCounter.findIndex(
                                (item) => item.number == ticket[1]
                              );
                              targetCounter[tempIndex].C =
                                Number(targetCounter[tempIndex].C) +
                                Number(ticket[2]);
                              counter = targetCounter[tempIndex].C;
                            }
                          }

                          if (counter > Number(blockObj.count)) {
                            isTicketBlocked = true;
                          }
                        }
                      }
                    }
                  })
                );
              }
            )
          );
        }
      }
    }

    // console.log("isTicketBlocked", isTicketBlocked);

    if (isTicketBlocked == true) {
      // return
      return res.status(200).send({ message: "COUNTBLOCK" });
    } else {
      // update ticket
      let query1 = `UPDATE new_schema.tickets SET count = ? WHERE id = ?`;
      const [rows] = await connection.execute(query1, [newCount, ticketId]);
      // console.log(rows.affectedRows);
    }
    await connection.end();

    // return
    return res.status(200).send({ message: "OK" });
  } catch (err) {
    // error
    console.log(err);
    return res.status(500).send({ err });
  }
};

const deleteTicket = async (req, res) => {
  let { ticketId, billNo, userId, userType } = req.query;
  try {
    const connection = mysql.createPool(config.dbPoolConf);

    // validate user access to bill
    if (userType != "1") {
      // check if user has permission to edit
      let targetUserType;
      switch (userType) {
        case "2":
          targetUserType = "stockistId";
          break;
        case "3":
          targetUserType = "subStockistId";
          break;
        case "4":
          targetUserType = "agentId";
          break;
        default:
          targetUserType = "agentId";
          break;
      }
      let query2 = `SELECT billNo, resultDate, ticketName from new_schema.bills where billNo = ? AND ${targetUserType} = ?`;
      var [rows2] = await connection.execute(query2, [billNo, userId]);
      if (rows2.length == 0) {
        // no access
        return res.status(403).send({ message: "Verification failed" });
      }
    } else if (userType == "1") {
      let query2 = `SELECT billNo, resultDate, ticketName from new_schema.bills where billNo = ?`;
      var [rows2] = await connection.execute(query2, [billNo]);
      if (rows2.length == 0) {
        // no data
        return res.status(403).send({ message: "No Data" });
      }
    }

    // check if bill can be edited
    // get current date
    var { start } = findStartTime(rows2[0].ticketName, userType);
    let today = dayjs().tz("Asia/Calcutta");
    const now = today.hour() * 60 + today.minute();
    let currentResultDate;
    if (now < start) {
      currentResultDate = today.format("YYYY-MM-DD");
    } else {
      currentResultDate = today.add(1, "day").format("YYYY-MM-DD");
    }
    if (currentResultDate != rows2[0].resultDate) {
      return res.status(200).send({ message: "TIMELOCK" });
    }

    let query1 = `DELETE FROM new_schema.tickets WHERE id = ${ticketId}`;
    const [rows, fields] = await connection.execute(query1);
    await connection.end();

    return res.status(200).send({ message: "OK" });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

module.exports = {
  ticketEntry,
  getBill,
  deleteBill,
  editTicket,
  deleteTicket,
};
