var AWS = require("aws-sdk");
const config = require("../config");
var dayjs = require("dayjs");

const getScheme = async (req, res) => {
  let { scheme_name } = req.query;
  try {
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Schemes-Ponnani",
      KeyConditionExpression: "#name = :name",
      ExpressionAttributeValues: {
        ":name": scheme_name,
      },
      ExpressionAttributeNames: {
        "#name": "name",
      },
    };
    let queryRes = await docClient.query(params).promise();
    return res.status(200).send({ data: queryRes.Items });
  } catch (error) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

const editScheme = async (req, res) => {
  let { scheme_name, ticketIndex, newModes } = req.body;
  try {
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Schemes-Ponnani",
      Key: {
        name: scheme_name,
      },
      UpdateExpression: `set tickets[${ticketIndex}].modes = :newModes`,
      ExpressionAttributeValues: {
        //  ":name": "name",
        // ":ticketIndex": ticketIndex,
        ":newModes": newModes,
      },
      ReturnValues: "UPDATED_NEW",
    };
    let queryRes = await docClient.update(params).promise();
    return res.status(200).send({ data: queryRes });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ error });
  }
};

module.exports = {
  getScheme,
  editScheme,
};
