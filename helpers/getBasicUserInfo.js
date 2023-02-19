var AWS = require("aws-sdk");
const config = require("../config");

let getBasicUserInfo = async (userId) => {
  const docClient = new AWS.DynamoDB.DocumentClient();
  var params = {
    TableName: "Users-Ponnani",
    // IndexName: "billNo-index",
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": userId,
      ":false": false,
    },
    ExpressionAttributeNames: {
      "#name": "name",
      "#type": "type",
    },
    FilterExpression: "isArchived = :false",
    ProjectionExpression:
      "createdAt, id, #name, #type, isSalesBlocked, isEntryBlocked",
  };
  return docClient.query(params).promise();
};

let getUserInfo = async (userId) => {
  const docClient = new AWS.DynamoDB.DocumentClient();
  var params = {
    TableName: "Users-Ponnani",
    // IndexName: "billNo-index",
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": userId,
      ":false": false,
    },
    ExpressionAttributeNames: {
      "#name": "name",
      "#type": "type",
    },
    FilterExpression: "isArchived = :false",
    ProjectionExpression:
      "id, #name, #type, isSalesBlocked, isEntryBlocked, stockist, subStockist, price, schemeName",
  };
  return docClient.query(params).promise();
};

module.exports = {
  getBasicUserInfo,
  getUserInfo,
};
