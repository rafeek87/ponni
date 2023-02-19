var AWS = require("aws-sdk");
const config = require("../config");
const { objectPropInArray } = require("../helpers/");
var { getBasicUserInfo } = require("../helpers/getBasicUserInfo");
const mysql = require("mysql2/promise");
var memoize = require("memoizee");

AWS.config.update(config.aws_remote_config);

function roundTo(n, digits) {
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
  return n;
}

function objectPropInArray4(list, userType, user, ticket = false) {
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
}

//
// return total amount, count, super, and grand total for given two dates
//
const getWinnersSummery = async (req, res) => {
  try {
    let {
      ticketName,
      startDate,
      endDate,
      selectedUserType,
      selectedUserId,
      ticketNumber,
      adminType,
      selectedGroup,
      selectedMode,
    } = req.query;

    let superName;
    let targetUserType;
    let params = [startDate, endDate];

    switch (adminType) {
      case "1":
        superName = "stockistWin";
        break;
      case "2":
        superName = "stockistWin";
        break;
      case "3":
        superName = "subStockistWin";
        break;
      case "4":
        superName = "agentWin";
        break;
      default:
        superName = "agentWin";
        break;
    }

    switch (selectedUserType) {
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

    let query1_a = `select sum(winnings.prize * tickets.count) as prize, sum(tickets.count) as count, sum(winnings.${superName} * tickets.count) as super from new_schema.bills, new_schema.tickets, new_schema.winnings where bills.billNo = winnings.billNo and winnings.ticketId = tickets.id and bills.resultDate between ? and ?`;
    let query1_b = "";

    if (ticketName != "ALL") {
      query1_b = ` AND bills.ticketName = ?`;
      params.push(ticketName);
    }

    let query1 = query1_a + query1_b;

    // user id filter
    if (selectedUserType && selectedUserId && selectedUserId != "1") {
      query1 += ` AND ${targetUserType} = ?`;
      params.push(selectedUserId);
    }

    // number filter
    if (
      ticketNumber != undefined &&
      ticketNumber != "" &&
      ticketNumber != null
    ) {
      query1 += ` and tickets.number = '${ticketNumber}'`;
    }

    // mode & group filter
    if (selectedMode != undefined && selectedMode != "ALL") {
      query1 += ` and tickets.mode IN ('${selectedMode}')`;
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
      query1 += ` and tickets.mode IN ${allowedModes}`;
    }

    const connection = mysql.createPool(config.dbPoolConf);
    var [rows, fields] = await connection.execute(query1, params);
    await connection.end();
    let grandTotal = 0;
    if (rows.length > 0) {
      grandTotal = Number(rows[0].prize) + Number(rows[0].super);
      grandTotal = roundTo(grandTotal, 2);
    }

    res.status(200).send({
      totalPrize: rows[0].prize || 0,
      totalSuper: rows[0].super || 0,
      totalCount: rows[0].count || 0,
      grandTotal,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

//
// return user count, prize, super and collective prize and count for a given
// start and end date and given user group
//
const getWinnersUserSummery = async (req, res) => {
  try {
    let {
      ticketName,
      startDate,
      endDate,
      ticketNumber,
      selectedUserType,
      selectedUserId,
      adminType,
      selectedGroup,
      selectedMode,
    } = req.query;

    let targetUserType;
    let targetUserTypeCode;
    let superName;
    let query1_b = "";
    let query1_c = "";
    let params = [startDate, endDate];

    if (ticketName != "ALL") {
      query1_c = ` AND bills.ticketName= ?`;
      params.push(ticketName);
    }

    switch (adminType) {
      case "1":
        superName = "stockistWin";
        break;
      case "2":
        superName = "stockistWin";
        break;
      case "3":
        superName = "subStockistWin";
        break;
      case "4":
        superName = "agentWin";
        break;
      default:
        superName = "agentWin";
        break;
    }

    switch (selectedUserType) {
      case "1":
        targetUserType = "stockistId";
        targetUserTypeCode = "2";
        break;
      case "2":
        targetUserType = "subStockistId";
        query1_b = ` AND bills.stockistId = '${selectedUserId}' `;
        targetUserTypeCode = "3";
        break;
      case "3":
        targetUserType = "agentId";
        query1_b = ` AND bills.subStockistId = '${selectedUserId}' `;
        targetUserTypeCode = "4";
        break;
      case "4":
        targetUserType = "agentId";
        query1_b = ` AND bills.agentId = '${selectedUserId}' `;
        targetUserTypeCode = "4";
        break;
      default:
        targetUserType = "agentId";
        targetUserTypeCode = "4";
        break;
    }

    let users = [];
    let totalAmount = 0;
    let totalCount = 0;
    let totalSuper = 0;

    let query1_a = `select bills.${targetUserType} as userId, sum(winnings.prize * tickets.count) as prize, sum(winnings.${superName} * tickets.count) as super, sum(tickets.count) as count from new_schema.bills, new_schema.tickets, new_schema.winnings where bills.resultDate BETWEEN ? AND ? and winnings.ticketId = tickets.id and tickets.billNo = bills.billNo`;
    let query1_d = ` GROUP BY ${targetUserType}`;

    // number filter
    if (
      ticketNumber != undefined &&
      ticketNumber != "" &&
      ticketNumber != null
    ) {
      query1_c += ` AND tickets.number = '${ticketNumber}'`;
    }

    // mode & group filter
    if (selectedMode != undefined && selectedMode != "ALL") {
      query1_c += ` AND tickets.mode IN ('${selectedMode}')`;
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
      query1_c += ` AND tickets.mode IN ${allowedModes}`;
    }

    let query1 = query1_a + query1_b + query1_c + query1_d;
    const connection = mysql.createPool(config.dbPoolConf);
    var [rows, fields] = await connection.execute(query1, params);
    await connection.end();
    // console.log(rows);

    // fetch user data
    for (let row of rows) {
      try {
        let userDataPromise = getBasicUserInfo(row.userId);
        totalAmount += Number(row.prize);
        totalCount += Number(row.count);
        totalSuper += Number(row.super);
        let userData = await userDataPromise;
        users.push({
          userName: userData.Items.length != 0 ? userData.Items[0].name : null,
          createdAt:
            userData.Items.length != 0 ? userData.Items[0].createdAt : null,
          ...row,
          userType: targetUserTypeCode,
        });
      } catch (err) {
        console.log("error getting user details");
        console.log(err);
        users.push({
          userName: null,
          createdAt: null,
          ...row,
        });
      }
    }

    // format totalAmount and totalSuper
    totalAmount = roundTo(totalAmount, 2);
    totalSuper = roundTo(totalSuper, 2);

    users.sort((user1, user2) => (user1.createdAt < user2.createdAt ? -1 : 1));

    res.status(200).send({
      data: {
        users,
        userType: selectedUserType,
        totalAmount,
        totalSuper,
        totalCount,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

//
// return all winnings data for given date, agentId and ticketname
//
const getWinners = async (req, res) => {
  try {
    let {
      ticketName,
      startDate,
      endDate,
      selectedUserType,
      selectedUserId,
      ticketNumber,
      adminType,
      selectedGroup,
      selectedMode,
    } = req.query;

    memoized = memoize(getBasicUserInfo, { maxAge: 10000 });

    let superName;
    let params = [startDate, endDate];
    let query1_b = "";
    let query1_c = "";

    switch (adminType) {
      case "1":
        superName = "stockistWin";
        break;
      case "2":
        superName = "stockistWin";
        break;
      case "3":
        superName = "subStockistWin";
        break;
      case "4":
        superName = "agentWin";
        break;
      default:
        superName = "agentWin";
        break;
    }

    switch (selectedUserType) {
      case "1":
        query1_b = ` AND bills.stockistId = ?`;
        params.push(selectedUserId);
        break;
      case "2":
        query1_b = ` AND bills.stockistId = ?`;
        params.push(selectedUserId);
        break;
      case "3":
        query1_b = ` AND bills.subStockistId = ?`;
        params.push(selectedUserId);
        break;
      case "4":
        query1_b = ` AND bills.agentId = ?`;
        params.push(selectedUserId);
        break;
    }

    let winnings = [];
    let consolidatedTotal = 0;
    let consolidatedSuper = 0;

    let query1_a = `select bills.billNo, bills.ticketName, tickets.mode, tickets.number, winnings.position, bills.stockistId, bills.subStockistId, bills.agentId, winnings.prize * tickets.count as prize, tickets.count as count, winnings.stockistWin * tickets.count as stockistWin, winnings.subStockistWin * tickets.count as subStockistWin, winnings.agentWin * tickets.count as agentWin from new_schema.bills, new_schema.tickets, new_schema.winnings where bills.billNo = winnings.billNo and winnings.ticketId = tickets.id and bills.resultDate BETWEEN ? AND ?`;

    if (ticketName != "ALL") {
      query1_c = ` AND bills.ticketName = ?`;
      params.push(ticketName);
    }

    // number filter
    if (
      ticketNumber != undefined &&
      ticketNumber != "" &&
      ticketNumber != null
    ) {
      query1_c += ` AND tickets.number = '${ticketNumber}'`;
    }

    // mode & group filter
    if (selectedMode != undefined && selectedMode != "ALL") {
      query1_c += ` AND tickets.mode IN ('${selectedMode}')`;
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
      query1_c += ` AND tickets.mode IN ${allowedModes}`;
    }

    let query1 = query1_a + query1_b + query1_c;
    const connection = mysql.createPool(config.dbPoolConf);
    var [rows, fields] = await connection.execute(query1, params);

    await connection.end();

    // fetch user data
    for (let row of rows) {
      try {
        consolidatedTotal += Number(row.prize);
        consolidatedSuper += Number(row[superName]);

        if (adminType == "1" || adminType == "2") {
          let stockistData = await memoized(row.stockistId);
          let subStockistData = await memoized(row.subStockistId);
          let agentData = await memoized(row.agentId);
          winnings.push({
            stockistName:
              stockistData.Items.length != 0
                ? stockistData.Items[0].name
                : null,
            subStockistName:
              subStockistData.Items.length != 0
                ? subStockistData.Items[0].name
                : null,
            agentName:
              agentData.Items.length != 0 ? agentData.Items[0].name : null,
            ...row,
            super: row[superName],
          });
        } else if (adminType == "3") {
          let subStockistData = await memoized(row.subStockistId);
          let agentData = await memoized(row.agentId);
          winnings.push({
            stockistName: "-",
            subStockistName:
              subStockistData.Items.length != 0
                ? subStockistData.Items[0].name
                : null,
            agentName:
              agentData.Items.length != 0 ? agentData.Items[0].name : null,
            ...row,
            super: row[superName],
          });
        } else if (adminType == "4") {
          let agentData = await memoized(row.agentId);
          winnings.push({
            stockistName: "-",
            subStockistName: "-",
            agentName:
              agentData.Items.length != 0 ? agentData.Items[0].name : null,
            ...row,
            super: row[superName],
          });
        }
      } catch (err) {
        console.log("error getting user details");
        console.log(err);
        winnings.push({
          userName: null,
          ...row,
          super: row[superName],
        });
      }
    }

    // sort winnings results
    let resA = [];
    let resAB = [];
    let resFirst = [];
    let resBox = [];
    let resSuper = [];

    winnings.forEach((row) => {
      if (row.mode == "SUPER" && row.position == "1") {
        resFirst.push(row);
      } else if (row.mode == "SUPER") {
        resSuper.push(row);
      } else if (row.mode == "BOX") {
        resBox.push(row);
      } else if (row.mode == "A" || row.mode == "B" || row.mode == "C") {
        resA.push(row);
      } else if (row.mode == "AB" || row.mode == "BC" || row.mode == "AC") {
        resAB.push(row);
      }
    });

    resA.sort((a, b) => {
      if (a.mode < b.mode) {
        return -1;
      }
      if (a.mode > b.mode) {
        return 1;
      }
      return 0;
    });

    resAB.sort((a, b) => {
      if (a.mode < b.mode) {
        return -1;
      }
      if (a.mode > b.mode) {
        return 1;
      }
      return 0;
    });

    resBox.sort((a, b) => {
      return Number(a.position) - Number(b.position);
    });

    resSuper.sort((a, b) => {
      return Number(a.position) - Number(b.position);
    });

    let sortedWinnings = [];
    sortedWinnings = sortedWinnings.concat(resA);
    sortedWinnings = sortedWinnings.concat(resAB);
    sortedWinnings = sortedWinnings.concat(resFirst);
    sortedWinnings = sortedWinnings.concat(resBox);
    sortedWinnings = sortedWinnings.concat(resSuper);

    res.status(200).send({
      winnings: sortedWinnings,
      totalPrize: roundTo(consolidatedTotal, 2),
      totalSuper: roundTo(consolidatedSuper, 2),
      grandTotal: roundTo(consolidatedTotal + consolidatedSuper, 2),
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

module.exports = {
  getWinners,
  getWinnersSummery,
  getWinnersUserSummery,
};
