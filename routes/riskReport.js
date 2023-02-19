const mysql = require("mysql2/promise");
const { validationResult } = require("express-validator");
const AWS = require("aws-sdk");
const config = require("../config");
const { findPermutations } = require("../helpers");

//
// input -> date, ticketName
//
//
const getRiskReport = async (req, res) => {
  try {
    // validation
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { resultDate, ticketName } = req.query;
    const connection = mysql.createPool(config.dbPoolConf);
    const report = [];

    // fetch all tickets from given date and ticket name
    const query1 = `SELECT bills.billNo, bills.resultDate, bills.stockistScheme, bills.ticketName, tickets.count, tickets.mode, tickets.number FROM bills LEFT JOIN tickets ON bills.billNo = tickets.billNo where bills.resultDate = ? AND bills.ticketName = ?`;
    const [rows1] = await connection.execute(query1, [resultDate, ticketName]);
    await connection.end();

    // const rows1 = [
    //   {
    //     billNo: 289826,
    //     resultDate: "2022-06-10",
    //     stockistScheme: "scheme_1",
    //     ticketName: "DEAR1",
    //     count: 5,
    //     mode: "BOX",
    //     number: "255",
    //   },
    //   {
    //     billNo: 289826,
    //     resultDate: "2022-06-10",
    //     stockistScheme: "scheme_1",
    //     ticketName: "DEAR1",
    //     count: 5,
    //     mode: "SUPER",
    //     number: "255",
    //   },
    //   {
    //     billNo: 289826,
    //     resultDate: "2022-06-10",
    //     stockistScheme: "scheme_1",
    //     ticketName: "DEAR1",
    //     count: 10,
    //     mode: "BOX",
    //     number: "512",
    //   },
    //   {
    //     billNo: 289826,
    //     resultDate: "2022-06-10",
    //     stockistScheme: "scheme_1",
    //     ticketName: "DEAR1",
    //     count: 20,
    //     mode: "BOX",
    //     number: "666",
    //   },
    // ];

    // console.log(rows1);
    if (rows1.length === 0) {
      return res.status(200).send({ report });
    }

    // fetch scheme data
    const docClient = new AWS.DynamoDB.DocumentClient();
    let queryRes = await docClient
      .scan({
        TableName: "Schemes-Ponnani",
      })
      .promise();
    const schemes = {
      scheme_1: queryRes.Items.find((i) => i.name === "scheme_1"),
      scheme_2: queryRes.Items.find((i) => i.name === "scheme_2"),
      scheme_3: queryRes.Items.find((i) => i.name === "scheme_3"),
      scheme_4: queryRes.Items.find((i) => i.name === "scheme_4"),
    };

    // parse data to report
    rows1.forEach((row) => {
      let parsedNumbers = [];
      if (row.mode === "SUPER") {
        parsedNumbers.push(row.number);
      } else if (row.mode === "BOX") {
        parsedNumbers = findPermutations(row.number);
      } else if (row.mode === "AB") {
        parsedNumbers = [...Array(10).keys()].map((num) => row.number + num);
      } else if (row.mode === "BC") {
        parsedNumbers = [...Array(10).keys()].map((num) => num + row.number);
      } else if (row.mode === "AC") {
        parsedNumbers = [...Array(10).keys()].map(
          (num) => row.number.substring(0, 1) + num + row.number.substring(1, 2)
        );
      } else if (row.mode === "A") {
        parsedNumbers = [...Array(100).keys()].map(
          (num) => row.number + String(num).padStart(2, "0")
        );
      } else if (row.mode === "C") {
        parsedNumbers = [...Array(100).keys()].map(
          (num) => String(num).padStart(2, "0") + row.number
        );
      } else if (row.mode === "B") {
        parsedNumbers = [...Array(1000).keys()].filter(
          (num) => String(row.number) == String(num).padStart(3, "0")[1]
        );
        parsedNumbers = parsedNumbers.map((num) =>
          String(num).padStart(3, "0")
        );
      }
      parsedNumbers.forEach((parsedNumber, index) => {
        const reportIndex = report.findIndex((i) => i.number === parsedNumber);
        if (reportIndex === -1) {
          // create new entry
          const amount =
            findAmount(
              row.ticketName,
              row.mode,
              row.number,
              schemes[row.stockistScheme],
              row.mode == "BOX" && index == 0
            ) * row.count;
          let newEntry = {
            number: parsedNumber,
            A: 0,
            B: 0,
            C: 0,
            AB: 0,
            BC: 0,
            AC: 0,
            BOX: 0,
            SUPER: 0,
            amount,
          };
          newEntry[row.mode] = Number(row.count);
          report.push(newEntry);
        } else {
          // modify existing report entry
          report[reportIndex][row.mode] += Number(row.count);
          const amount =
            findAmount(
              row.ticketName,
              row.mode,
              row.number,
              schemes[row.stockistScheme],
              row.mode == "BOX" && index == 0
            ) * row.count;
          report[reportIndex]["amount"] += amount;
        }
      });
    });

    // parse count where mode is BOX
    // for AAA, divide total count by 6
    // for AAX, divide total count by 2
    const parsedReport = report.map((item) => {
      if (
        item.number[0] == item.number[1] &&
        item.number[1] == item.number[2]
      ) {
        return { ...item, BOX: item.BOX / 6 };
      }
      var text = item.number.split("");
      let flag = text.some(function (v, i, a) {
        return a.lastIndexOf(v) != i;
      });
      if (flag) {
        return { ...item, BOX: item.BOX / 2 };
      }
      return { ...item };
    });

    // sort data
    parsedReport.sort((a, b) => b.amount - a.amount);

    return res.status(200).send({ report: parsedReport });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

const findAmount = (ticketName, mode, number, scheme, direct = true) => {
  let modes = scheme.tickets.find((i) => i.name == ticketName)?.modes;
  const targetRows = modes.find((i) => i.name == mode)?.rows;
  if (mode == "BOX") {
    let amount;
    if (direct) {
      amount = targetRows[0]?.amount + targetRows[0]?.super;
    } else {
      amount = targetRows[1]?.amount + targetRows[1]?.super;
    }
    return amount;
  } else {
    let amount = targetRows[0]?.amount + targetRows[0]?.super;
    return amount;
  }
};

module.exports = {
  getRiskReport,
};
