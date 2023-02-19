const mysql = require("mysql2/promise");
var AWS = require("aws-sdk");
const { validationResult } = require("express-validator");
var cron = require("node-cron");
const cluster = require("cluster");
var dayjs = require("dayjs");
var timezone = require("dayjs/plugin/timezone");

dayjs.extend(timezone);

const config = require("../config");

const deleteTicketsByDate = async (req, res) => {
  try {
    const {
      ticketName,
      userId,
      userType,
      selectedUserId,
      selectedUserType,
      startDate,
      endDate,
    } = req.body;
    // validation
    if (userType != "1") {
      return res.status(403).send({ message: "Unauthorized" });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const params = [startDate, endDate];
    const query_1 =
      "DELETE FROM new_schema.bills WHERE resultDate BETWEEN ? AND ?";
    let query_2 = ""; // ticketName
    let query_3 = ""; // TODO selected user

    if (ticketName !== "ALL") {
      query_2 = " AND ticketName = ?";
      params.push(ticketName);
    }

    if (selectedUserId && selectedUserType) {
      let targetUserId;
      switch (selectedUserType) {
        case "2":
          targetUserId = "stockistId";
          break;
        case "3":
          targetUserId = "subStockistId";
          break;
        case "4":
          targetUserId = "agentId";
          break;
        default:
          targetUserId = "agentId";
          break;
      }
      query_3 = ` AND ${targetUserId} = ?`;
      params.push(selectedUserId);
    }
    const query1 = query_1 + query_2 + query_3;

    const connection = mysql.createPool(config.dbPoolConf);
    // execute query
    const [rows] = await connection.execute(query1, params);
    await connection.end();

    return res.status(200).send({ message: "OK" });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

const changeAdminPassword = async (req, res) => {
  try {
    const { newPassword, userType, userId } = req.body;
    // validation
    if (userType != "1") {
      return res.status(403).send({ message: "Unauthorized" });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Users-Ponnani",
      Key: {
        id: userId,
        type: userType,
      },
      UpdateExpression: "set password = :newPassword",
      ExpressionAttributeValues: {
        ":newPassword": newPassword.toLowerCase(),
      },
    };

    const queryRes = await docClient.update(params).promise();
    return res.status(200).send({ message: "OK" });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

const deleteSingleTicket = async (req, res) => {
  try {
    const { userType, billNo } = req.body;
    // validation
    if (userType != "1") {
      return res.status(403).send({ message: "Unauthorized" });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const connection = mysql.createPool(config.dbPoolConf);
    const query1 = `DELETE FROM new_schema.bills WHERE billNo = ?`;
    const params1 = [billNo];
    const [rows, fields] = await connection.execute(query1, params1);
    await connection.end();

    return res.status(200).send({ message: "OK" });
  } catch (err) {
    console.log("error");
    console.log(err);
    return res.status(500).send({ err });
  }
};

const deleteAllTickestsOnDate = async (date) => {
  try {
    const query_1 = "DELETE FROM new_schema.bills WHERE resultDate = ?";
    const params_1 = [date];

    const connection = mysql.createPool(config.dbPoolConf);
    const [rows] = await connection.execute(query_1, params_1);
    await connection.end();
  } catch (err) {
    console.log(err);
    throw err;
  }
};

// TODO events to start/stop task scheduler
if (cluster.isMaster) {
  const retentionPeriod = 21;
  const isCleanUpEnabled = true;

  cron.schedule(
    "0 1 * * *",
    () => {
      // console.log(dayjs().subtract(retentionPeriod, 'day').format('YYYY-MM-DD'));
      const targetDate = dayjs().subtract(retentionPeriod, 'day').format('YYYY-MM-DD')
      console.log("Running ticket cleanup job for the date ", targetDate);
      deleteAllTickestsOnDate(targetDate)
    },
    {
      scheduled: isCleanUpEnabled,
      timezone: "Asia/Kolkata",
    }
  );
}

module.exports = {
  changeAdminPassword,
  deleteTicketsByDate,
  deleteSingleTicket,
};
