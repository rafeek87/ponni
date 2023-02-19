var AWS = require("aws-sdk");
const config = require("../config");
var region = "ap-south-1";

let getDateBlocks = async (ticketName, resultDate) => {
  const docClient = new AWS.DynamoDB.DocumentClient();
  var params = {
    TableName: "Blocks-Ponnani",
    ExpressionAttributeValues: {
      ":ticketName": ticketName,
      ":blockMode": "DATE",
      ":resultDate": resultDate,
      ":ALL": "ALL",
    },
    // ExpressionAttributeNames: {
    //   "#name": "name",
    //   "#type": "type",
    // },
    FilterExpression:
      "(ticketName = :ticketName or ticketName = :ALL) and blockMode = :blockMode and resultDate = :resultDate",
  };

  let dateBlocks;
  let dateBlocksItems = [];
  do {
    dateBlocks = await docClient.scan(params).promise();
    dateBlocksItems = dateBlocksItems.concat(dateBlocks.Items);
    params.ExclusiveStartKey = dateBlocks.LastEvaluatedKey;
  } while (typeof dateBlocks.LastEvaluatedKey != "undefined");

  return dateBlocksItems;
};

let getCountBlocks = async (ticketName) => {
  const docClient = new AWS.DynamoDB.DocumentClient();
  var params = {
    TableName: "Blocks-Ponnani",
    ExpressionAttributeValues: {
      ":ticketName": ticketName,
      ":blockMode": "COUNT",
      ":ALL": "ALL",
    },
    FilterExpression:
      "ticketName = :ticketName or ticketName = :ALL and blockMode = :blockMode",
  };

  let countBlocks;
  let countBlockItems = [];
  do {
    countBlocks = await docClient.scan(params).promise();
    countBlockItems = countBlockItems.concat(countBlocks.Items);
    params.ExclusiveStartKey = countBlocks.LastEvaluatedKey;
  } while (typeof countBlocks.LastEvaluatedKey != "undefined");

  return countBlockItems;
};

module.exports = {
  getDateBlocks,
  getCountBlocks,
};
