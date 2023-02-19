const mysql = require("mysql2/promise");
const { validationResult } = require("express-validator");
const config = require("../config");

const getOverflowTickets = async (req, res) => {
  try {
    // validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      resultDate,
      ticketName,
      ticketNumberValue,
      selectedGroup,
      selectedMode,
    } = req.query;

    let params = [resultDate, ticketName];
    let query1_a = `select tickets.number, sum(tickets.count) as totalCount, sum(tickets.overFlowCount) as overFlowCount, tickets.mode, bills.ticketName from new_schema.tickets, new_schema.bills where bills.billNo = tickets.billNo and bills.resultDate = ? `;
    let query1_b = ` AND bills.ticketName = ?`;
    let query1_d = ``;
    let query1_e = ` GROUP BY tickets.number, bills.ticketName, tickets.mode`;

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

    // execute query
    let query1 = query1_a + query1_b + query1_d + query1_e;
    const connection = mysql.createPool(config.dbPoolConf);
    const [rows1, fields1] = await connection.execute(query1, params);

    const query2 = "SELECT * FROM overFlowLimits WHERE ticketName = ?";
    const params2 = [ticketName];
    const [limits] = await connection.execute(query2, params2);

    await connection.end();

    if (limits.length == 0) {
      return res.status(500).send({ err: "Limits not found" });
    }

    const data = rows1.map((row) => {
      let count = row.totalCount - row.overFlowCount;
      const limit = limits[0][row.mode];
      return {
        ...row,
        number: row.number,
        count: row.totalCount,
        balance: count > limit ? count - limit : 0,
      };
    });

    data.sort((a, b) => b.balance - a.balance);

    // return
    return res.status(200).send({ status: "OK", data });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

const markOverflow = async (req, res) => {
  try {
    // validation
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { resultDate, ticketName, ticketNumberValue, overFlowCount, mode } =
      req.query;

    const query1 =
      "select id, count, overFlowCount from bills, tickets where bills.ticketName = ? AND bills.resultDate = ? AND tickets.number = ? AND tickets.mode = ? AND tickets.billNo = bills.billNo;";
    const params1 = [ticketName, resultDate, ticketNumberValue, mode];

    const connection = mysql.createPool(config.dbPoolConf);

    const [rows1] = await connection.execute(query1, params1);

    if (rows1.length == 0) {
      return res.status(404).send({ err: "Number not found" });
    }

    const query2 =
      "UPDATE tickets SET overFlowCount = overFlowCount + ? WHERE id = ?";
    const params2 = [overFlowCount, rows1[0].id];
    const [rows2] = await connection.execute(query2, params2);

    await connection.end();

    return res.status(200).send({ status: "OK", data: rows2 });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

const getOverflowLimits = async (req, res) => {
  // validation
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { ticketName } = req.query;

  const query1 = "SELECT * FROM overFlowLimits WHERE ticketName = ?";
  const params1 = [ticketName];

  const connection = mysql.createPool(config.dbPoolConf);
  const [rows1] = await connection.execute(query1, params1);
  await connection.end();

  return res.status(200).send({ status: "OK", data: rows1 });
};

const updateOverflowLimits = async (req, res) => {
  try {
    // validation
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { ticketName, SUPER, BOX, AB, BC, AC, A, B, C } = req.query;

    const connection = mysql.createPool(config.dbPoolConf);

    const query1 =
      "UPDATE overFlowLimits SET SUPER = ?, BOX = ?, AB = ?, BC = ?, AC = ?, A = ?, B = ?, C = ? WHERE ticketName = ?";
    const params1 = [SUPER, BOX, AB, BC, AC, A, B, C, ticketName];
    console.log(params1);
    const [rows1] = await connection.execute(query1, params1);
    await connection.end();

    return res.status(200).send({ status: "OK" });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

module.exports = {
  getOverflowTickets,
  markOverflow,
  updateOverflowLimits,
  getOverflowLimits,
};
