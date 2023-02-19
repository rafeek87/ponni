const mysql = require("mysql2/promise");
var dayjs = require("dayjs");
const config = require("../config");
var objectSupport = require("dayjs/plugin/objectSupport");
var utc = require("dayjs/plugin/utc");
var timezone = require("dayjs/plugin/timezone");
let { roundTo } = require("../helpers");
var { getBasicUserInfo } = require("../helpers/getBasicUserInfo");
var memoize = require("memoizee");

dayjs.extend(objectSupport);
dayjs.extend(utc);
dayjs.extend(timezone);

const getSalesReport = async (req, res) => {
  let {
    ticketName,
    resultDate,
    agentId,
    ticketNumber,
    adminType,
    selectedGroup,
    selectedMode,
  } = req.query;
  try {
    const connection = mysql.createPool(config.dbPoolConf);

    memoized = memoize(getBasicUserInfo, { maxAge: 10000 });

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
    let query1 = `select bills.billNo, agentId, subStockistId, stockistId, enteredBy, resultDate, ticketName, createdAt, ${targetPrice} as price, count, mode, number from new_schema.bills, new_schema.tickets where agentId = '${agentId}' and tickets.billNo = bills.billNo and bills.resultDate = '${resultDate}'`;
    // let query1 = `select resultDate, sum(tickets.${targetPrice}) as amount, sum(tickets.count) as count from new_schema.tickets, new_schema.bills where bills.resultDate between '${startDate}' and '${endDate}' and bills.billNo = tickets.billNo`;
    if (ticketName != "ALL") {
      query1 += ` and bills.ticketName = '${ticketName}'`;
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

    query1 += ` order by billNo desc`;

    // execute query
    const [rows, fields] = await connection.execute(query1);
    await connection.end();

    // get total cost and total count
    let totalAmount = 0;
    let totalCount = 0;
    if (rows.length != 0) {
      totalAmount = rows
        .map((item) => item.price * item.count)
        .reduce((prev, next) => Number(prev) + Number(next));
      totalAmount = roundTo(totalAmount, 2);
      totalCount = rows
        .map((item) => item.count)
        .reduce((prev, next) => Number(prev) + Number(next));
    }

    // format response
    let bills = [];
    await Promise.all(
      rows.map(async (row) => {
        let agentInfo = await memoized(row.agentId);
        let subStockistInfo = await memoized(row.subStockistId);
        let stockistInfo = await memoized(row.stockistId);
        let dataIndex = bills.findIndex(
          (element) => element.billNo == row.billNo
        );
        if (dataIndex == -1) {
          // add new bill to data
          let newBill = {
            ...row,
            stockistName:
              stockistInfo.Items.length != 0
                ? stockistInfo.Items[0].name
                : null,
            subStockistName:
              subStockistInfo.Items.length != 0
                ? subStockistInfo.Items[0].name
                : null,
            agentName:
              agentInfo.Items.length != 0 ? agentInfo.Items[0].name : null,
          };
          delete newBill.price;
          delete newBill.count;
          delete newBill.mode;
          delete newBill.number;
          let newTicket = [];
          newTicket.push({
            price: row.price,
            count: row.count,
            mode: row.mode,
            number: row.number,
          });
          newBill.tickets = newTicket;
          bills.push(newBill);
        } else {
          // add ticket to existing bill
          bills[dataIndex].tickets.push({
            price: row.price,
            count: row.count,
            mode: row.mode,
            number: row.number,
          });
        }
      })
    );

    // return
    return res
      .status(200)
      .send({ status: "OK", totalAmount, totalCount, bills });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

const numberwise = async (req, res) => {
  try {
    let {
      ticketName,
      resultDate,
      ticketNumberValue,
      selectedUserId,
      selectedUserType,
      selectedGroup,
      selectedMode,
      isGroupActive,
    } = req.query;

    let params = [resultDate];
    let query1_a = `select tickets.number, sum(tickets.count) as count, tickets.mode, bills.ticketName from new_schema.tickets, new_schema.bills where bills.billNo = tickets.billNo and bills.resultDate = ? `;
    let query1_b = ``;
    let query1_c = ``;
    let query1_d = ``;
    let query1_e = ` GROUP BY tickets.number, bills.ticketName, tickets.mode ORDER BY count DESC`;

    if (selectedUserType == "2") {
      query1_b = ` AND bills.stockistId = ?`;
      params.push(selectedUserId);
    } else if (selectedUserType == "3") {
      query1_b = ` AND bills.subStockistId = ?`;
      params.push(selectedUserId);
    } else if (selectedUserType == "4") {
      query1_b = ` AND bills.agentId = ?`;
      params.push(selectedUserId);
    }

    if (ticketName != "ALL") {
      query1_c = ` AND bills.ticketName = ?`;
      params.push(ticketName);
    }

    if (ticketNumberValue != undefined && ticketNumberValue != "") {
      query1_d = ` AND tickets.number = ?`;
      params.push(ticketNumberValue);
    }

    // mode & group filter
    if (selectedMode != undefined && selectedMode != "ALL") {
      query1_d += ` and tickets.mode IN ('${selectedMode}')`;
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
      query1_d += ` and tickets.mode IN ${allowedModes}`;
    }

    if (isGroupActive == "true") {
      query1_e = ` GROUP BY tickets.number ORDER BY count DESC`;
    }

    // execute query
    let query1 = query1_a + query1_b + query1_c + query1_d + query1_e;
    const connection = mysql.createPool(config.dbPoolConf);
    const [rows1, fields1] = await connection.execute(query1, params);
    await connection.end();

    // return
    return res.status(200).send({ status: "OK", data: rows1 });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

module.exports = {
  getSalesReport,
  numberwise,
};
