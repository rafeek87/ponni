const mysql = require("mysql2/promise");
var dayjs = require("dayjs");
var objectSupport = require("dayjs/plugin/objectSupport");
var utc = require("dayjs/plugin/utc");
var timezone = require("dayjs/plugin/timezone");
let { roundTo } = require("../helpers");
var { getBasicUserInfo } = require("../helpers/getBasicUserInfo");
var memoize = require("memoizee");
const config = require("../config");

dayjs.extend(objectSupport);
dayjs.extend(utc);
dayjs.extend(timezone);


const getSalesSummery = async (req, res) => {
  let {
    ticketName,
    startDate,
    endDate,
    userId,
    userType,
    adminType,
    selectedGroup,
    selectedMode,
    ticketNumber,
  } = req.query;
  try {
    const connection = mysql.createPool(config.dbPoolConf);

    // set price
    let targetPrice = null;
    let targetUserId;
    if (adminType == "1") {
      targetPrice = "stockistPrice";
      targetUserId = "stockistId";
    } else if (adminType == "2") {
      targetPrice = "subStockistPrice";
      targetUserId = "subStockistId";
    } else if (adminType == "3") {
      targetPrice = "agentPrice";
      targetUserId = "agentId";
    } else if (adminType == "4") {
      targetPrice = "agentPrice";
      targetUserId = "agentId";
    }

    // query
    let query1 = `select resultDate, sum(tickets.${targetPrice} * tickets.count) as price, sum(tickets.count) as count from new_schema.tickets, new_schema.bills where bills.resultDate between '${startDate}' and '${endDate}' and bills.billNo = tickets.billNo`;
    if (ticketName != "ALL") {
      query1 += ` and bills.ticketName = '${ticketName}'`;
    }
    if (userType == "4") {
      query1 += ` and bills.agentId = '${userId}'`;
    } else if (userType == "3") {
      query1 += ` and bills.subStockistId = '${userId}'`;
    } else if (userType == "2") {
      query1 += ` and bills.stockistId = '${userId}'`;
    }

    // number filter
    if (ticketNumber != undefined && ticketNumber != '' && ticketNumber != null) {
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

    query1 += ` group by resultDate`;

    // execute query
    const [rows, fields] = await connection.execute(query1);
    await connection.end();

    // get total cost and total count
    let totalAmount = 0;
    let totalCount = 0;
    if (rows.length != 0) {
      totalAmount = rows
        .map((item) => item.price)
        .reduce((prev, next) => Number(prev) + Number(next));
      totalAmount = roundTo(totalAmount, 2);
      totalCount = rows
        .map((item) => item.count)
        .reduce((prev, next) => Number(prev) + Number(next));
    }

    // return
    return res
      .status(200)
      .send({ status: "OK", totalAmount, totalCount, rows });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

const getDateSummery = async (req, res) => {
  let {
    ticketName,
    resultDate,
    ticketNumber,
    userId,
    userType,
    adminType,
    selectedGroup,
    selectedMode,
  } = req.query;
  try {
    const connection = mysql.createPool(config.dbPoolConf);

    memoized = memoize(getBasicUserInfo, { maxAge: 10000 });

    //
    let targetPrice = null;
    let targetUserId;
    let targetUserType;

    if (adminType == "1") {
      targetPrice = "stockistPrice";
    } else if (adminType == "2") {
      targetPrice = "subStockistPrice";
    } else if (adminType == "3") {
      targetPrice = "agentPrice";
    } else if (adminType == "4") {
      targetPrice = "agentPrice";
    }

    if (userType == "1") {
      targetUserId = "stockistId";
      targetUserType = "2";
    } else if (userType == "2") {
      targetUserId = "subStockistId";
      targetUserType = "3";
    } else if (userType == "3") {
      targetUserId = "agentId";
      targetUserType = "4";
    } else if (userType == "4") {
      targetUserId = "agentId";
      targetUserType = "4";
    }

    // query
    let query1 = `select bills.${targetUserId} as userId, sum(tickets.${targetPrice} * tickets.count) as price, sum(tickets.count) as count from new_schema.tickets, new_schema.bills where bills.resultDate = '${resultDate}' and bills.billNo = tickets.billNo`;
    if (ticketName != "ALL") {
      query1 += ` and bills.ticketName = '${ticketName}'`;
    }
    if (userType == "4") {
      query1 += ` and bills.agentId = '${userId}'`;
    } else if (userType == "3") {
      query1 += ` and bills.subStockistId = '${userId}'`;
    } else if (userType == "2") {
      query1 += ` and bills.stockistId = '${userId}'`;
    }

    // number filter
    if (ticketNumber != undefined && ticketNumber != '' && ticketNumber != null) {
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

    query1 += ` group by ${targetUserId}`;

    // execute query
    const [rows, fields] = await connection.execute(query1);
    await connection.end();

    // get user name
    await Promise.all(
      rows.map(async (item) => {
        let userInfo = await memoized(item.userId);
        item.userName = userInfo.Items.length != 0 ? userInfo.Items[0].name : null;
        item.userType = targetUserType;
      })
    );

    // get total cost and total count
    let totalAmount = 0;
    let totalCount = 0;
    if (rows.length != 0) {
      totalAmount = rows
        .map((item) => item.price)
        .reduce((prev, next) => Number(prev) + Number(next));
      totalAmount = roundTo(totalAmount, 2);
      totalCount = rows
        .map((item) => item.count)
        .reduce((prev, next) => Number(prev) + Number(next));
    }

    // return
    return res
      .status(200)
      .send({ status: "OK", resultDate, totalAmount, totalCount, rows });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

module.exports = {
  getSalesSummery,
  getDateSummery,
};
