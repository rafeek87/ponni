const mysql = require("mysql2/promise");
const config = require("../config");

let getTotalCount = async (ticketName, resultDate, number, mode) => {
  const connection = mysql.createPool(config.dbPoolConf);
  let query1 = `select sum(count) as count from new_schema.bills, new_schema.tickets where bills.resultDate = ? and bills.ticketName = ? and tickets.number = ? and tickets.mode = ? and bills.billNo = tickets.billNo`;
  const [rows1, fields1] = await connection.execute(query1, [
    resultDate,
    ticketName,
    number,
    mode,
  ]);
  await connection.end();

  if (rows1.length > 0) {
    return rows1[0].count == null ? 0 : rows1[0].count;
  }
  return 0;
};

let getUserCount = async (
  ticketName,
  resultDate,
  number,
  mode,
  userId,
  userType
) => {
  let targetUserId = "agentId";
  if (userType == "2") {
    targetUserId = "stockistId";
  } else if (userType == "3") {
    targetUserId = "subStockistId";
  } else if (userType == "4") {
    targetUserId = "agentId";
  }
  // const connection = await mysql.createConnection(dbConf);
  const connection = mysql.createPool(config.dbPoolConf);
  let query1 = `select sum(count) as count from new_schema.bills, new_schema.tickets where bills.resultDate = ? and bills.ticketName = ? and tickets.number = ? and tickets.mode = ? and ${targetUserId} = ? and bills.billNo = tickets.billNo`;
  const [rows1, fields1] = await connection.execute(query1, [
    resultDate,
    ticketName,
    number,
    mode,
    userId,
  ]);
  await connection.end();

  if (rows1.length > 0) {
    return rows1[0].count == null ? 0 : rows1[0].count;
  }
  return 0;
};

module.exports = {
  getTotalCount,
  getUserCount,
};
