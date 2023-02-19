const mysql = require("mysql2/promise");
const config = require("../config");
let { roundTo } = require("../helpers");
var { getBasicUserInfo } = require("../helpers/getBasicUserInfo");
var memoize = require("memoizee");

const getNetPay = async (req, res) => {
  try {
    let {
      ticketName,
      startDate,
      endDate,
      userId,
      userType,
      adminType,
      selectedGroup,
      selectedMode,
    } = req.query;

    const connection = mysql.createPool(config.dbPoolConf);

    memoized = memoize(getBasicUserInfo, { maxAge: 10000 });

    // set price
    let targetPrice = null;
    let targetWin = null;
    let targetUserId;
    if (adminType == "1") {
      targetPrice = "adminPrice";
      targetUserId = "stockistId";
      targetWin = "stockistWin";
    } else if (adminType == "2") {
      targetPrice = "stockistPrice";
      targetUserId = "subStockistId";
      targetWin = "stockistWin";
    } else if (adminType == "3") {
      targetPrice = "subStockistPrice";
      targetUserId = "agentId";
      targetWin = "subStockistWin";
    } else if (adminType == "4") {
      targetPrice = "agentPrice";
      targetUserId = "agentId";
      targetWin = "agentWin";
    }

    // query
    let query1_a = `SELECT bills.resultDate, bills.${targetUserId} AS userId, SUM(tickets.${targetPrice} * tickets.count) AS sales FROM new_schema.bills, new_schema.tickets WHERE bills.billNo = tickets.billNo AND bills.resultDate BETWEEN ? AND ?`;
    let query2_a = `SELECT bills.resultDate, bills.${targetUserId} AS userId, SUM((winnings.${targetWin} + winnings.prize) * tickets.count) AS winnings FROM new_schema.bills, new_schema.tickets, new_schema.winnings WHERE bills.billNo = tickets.billNo AND tickets.id = winnings.ticketId AND bills.resultDate BETWEEN ? AND ?`;
    let query1_b = ``;
    let query1_c = ``;
    let query1_d = ``;
    let query1_e = ``;
    let params = [startDate, endDate];

    // ticket filter
    if (ticketName != "ALL") {
      query1_b += ` AND bills.ticketName = ?`;
      params.push(ticketName);
    }

    // mode & group filter
    if (selectedMode != undefined && selectedMode != "ALL") {
      query1_c = ` AND tickets.mode IN ('${selectedMode}')`;
    } else if (selectedMode == "ALL" && selectedGroup) {
      let allowedModes;
      switch (selectedGroup) {
        case "3":
          allowedModes = `('SUPER', 'BOX')`;
          break;
        case "2":
          allowedModes = `('AB', 'BC', 'AC')`;
          break;
        case "1":
          allowedModes = `('A', 'B', 'C')`;
          break;
      }
      query1_c = ` AND tickets.mode IN ${allowedModes}`;
    }

    // user filter
    if (userType != undefined && userId != undefined) {
      if (userType == "2") {
        query1_d = ` AND bills.stockistId = ?`;
        params.push(userId);
      } else if (userType == "3") {
        query1_d = ` AND bills.subStockistId = ?`;
        params.push(userId);
      } else if (userType == "4") {
        query1_d = ` AND bills.agentId = ?`;
        params.push(userId);
      }
    }

    query1_e = ` GROUP BY bills.resultDate, bills.${targetUserId}`;

    // query
    let query1 = query1_a + query1_b + query1_c + query1_d + query1_e;
    let query2 = query2_a + query1_b + query1_c + query1_d + query1_e;

    // fetch sales data
    const [rows, fields] = await connection.execute(query1, params);
    let secondQuery = connection.execute(query2, params);

    // fetch user data and total count
    let totalSales = 0;
    let totalWinnings = 0;
    let dates = [];
    let consolidatedUsers = [];
    for (let row of rows) {
      try {
        let userDataPromise = memoized(row.userId);
        totalSales += Number(row.sales);
        let userData = await userDataPromise;
        let datesIndex = dates.findIndex(
          (obj) => obj.resultDate == row.resultDate
        );
        if (datesIndex == -1) {
          // new date
          dates.push({
            resultDate: row.resultDate,
            users: [
              {
                ...row,
                userName:
                  userData.Items.length != 0 ? userData.Items[0].name : null,
                winnings: 0,
                balance: roundTo(row.sales, 2),
              },
            ],
            totalSales: roundTo(row.sales, 2),
            totalWinnings: 0,
            totalBalance: roundTo(row.sales, 2),
          });
        } else {
          // push to existing date
          dates[datesIndex].users.push({
            ...row,
            userName:
              userData.Items.length != 0 ? userData.Items[0].name : null,
            winnings: 0,
            balance: roundTo(row.sales, 2),
          });
          dates[datesIndex].totalSales = roundTo(
            Number(row.sales) + Number(dates[datesIndex].totalSales),
            2
          );
          dates[datesIndex].totalBalance = roundTo(
            Number(row.sales) + Number(dates[datesIndex].totalBalance),
            2
          );
        }
        let consolidatedUserIndex = consolidatedUsers.findIndex(
          (obj) => obj.userId == row.userId
        );
        // data from start date to end date
        if (startDate != endDate) {
          if (consolidatedUserIndex == -1) {
            consolidatedUsers.push({
              userId: row.userId,
              userName:
                userData.Items.length != 0 ? userData.Items[0].name : null,
              sales: row.sales,
              winnings: 0,
              balance: row.sales,
            });
          } else {
            consolidatedUsers[consolidatedUserIndex].sales = roundTo(
              Number(row.sales) +
                Number(consolidatedUsers[consolidatedUserIndex].sales),
              2
            );
            consolidatedUsers[consolidatedUserIndex].balance = roundTo(
              Number(row.sales) +
                Number(consolidatedUsers[consolidatedUserIndex].balance),
              2
            );
          }
        }
      } catch (err) {
        console.log(err);
      }
    }

    // fetch winnings data
    const [rows2, fields2] = await secondQuery;
    await connection.end();

    for (let row2 of rows2) {
      try {
        totalWinnings += Number(row2.winnings);
        let datesIndex = dates.findIndex(
          (obj) => obj.resultDate == row2.resultDate
        );
        if (datesIndex == -1) {
          // new date -> should not happen
          let userDataPromise = memoized(row2.userId);
          let userData = await userDataPromise;
          dates.push({
            resultDate: row2.resultDate,
            users: [
              {
                ...row2,
                userName:
                  userData.Items.length != 0 ? userData.Items[0].name : null,
                sales: 0,
                winnings: row2.winnings,
                balance: 0 - Number(row2.winnings),
              },
            ],
            totalWinnings: roundTo(-Number(row2.winnings), 2),
          });
        } else {
          // push to existing date
          // find userIndex
          let userIndex = dates[datesIndex].users.findIndex(
            (obj) => obj.userId == row2.userId
          );
          if (userIndex != -1) {
            dates[datesIndex].users[userIndex].winnings = roundTo(
              Number(dates[datesIndex].users[userIndex].winnings) +
                Number(row2.winnings),
              2
            );
            dates[datesIndex].users[userIndex].balance = roundTo(
              Number(dates[datesIndex].users[userIndex].sales) -
                Number(row2.winnings),
              2
            );
          } else {
            // new user -> should not happen
          }
          dates[datesIndex].totalWinnings = roundTo(
            Number(row2.winnings) + Number(dates[datesIndex].totalWinnings),
            2
          );
          dates[datesIndex].totalBalance = roundTo(
            Number(dates[datesIndex].totalSales) -
              Number(dates[datesIndex].totalWinnings),
            2
          );
        }
        let consolidatedUserIndex = consolidatedUsers.findIndex(
          (obj) => obj.userId == row2.userId
        );
        // data from start date to end date
        if (startDate != endDate) {
          if (consolidatedUserIndex == -1) {
            // should NOT happen
            consolidatedUsers.push({
              userId: row2.userId,
              userName:
                userData.Items.length != 0 ? userData.Items[0].name : null,
              sales: row2.sales,
              winnings: row2.winnings,
              balance: roundTo(userBalance, 2),
            });
          } else {
            consolidatedUsers[consolidatedUserIndex].winnings = roundTo(
              Number(row2.winnings) +
                Number(consolidatedUsers[consolidatedUserIndex].winnings),
              2
            );
            consolidatedUsers[consolidatedUserIndex].balance = roundTo(
              Number(consolidatedUsers[consolidatedUserIndex].sales) -
                Number(consolidatedUsers[consolidatedUserIndex].winnings),
              2
            );
          }
        }
      } catch (err) {
        console.log(err);
      }
    }

    if (startDate != endDate) {
      dates.unshift({
        resultDate: `${startDate} - ${endDate}`,
        users: consolidatedUsers,
        totalSales: roundTo(totalSales, 2),
        totalWinnings: roundTo(totalWinnings, 2),
        totalBalance: roundTo(Number(totalSales) - Number(totalWinnings), 2),
      });
    }

    // return
    return res.status(200).send({
      status: "OK",
      dates,
    });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

module.exports = {
  getNetPay,
};
