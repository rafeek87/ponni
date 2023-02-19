var AWS = require("aws-sdk");
const config = require("../config");
const { v4: uuidv4 } = require("uuid");
var dayjs = require("dayjs");
var objectSupport = require("dayjs/plugin/objectSupport");
var utc = require("dayjs/plugin/utc");
var timezone = require("dayjs/plugin/timezone");
var { getBasicUserInfo } = require("../helpers/getBasicUserInfo");

dayjs.extend(utc);
dayjs.extend(timezone);

const getDateBlocks = async (req, res) => {
  try {
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Blocks-Ponnani",
      ExpressionAttributeValues: {
        ":blockMode": "DATE",
      },
      FilterExpression: "blockMode = :blockMode",
    };

    let dateBlocks;
    let dateBlocksItems = [];
    do {
      dateBlocks = await docClient.scan(params).promise();
      dateBlocksItems = dateBlocksItems.concat(dateBlocks.Items);
      params.ExclusiveStartKey = dateBlocks.LastEvaluatedKey;
    } while (typeof dateBlocks.LastEvaluatedKey != "undefined");

    return res.status(200).send({
      data: dateBlocksItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ err });
  }
};

const addDateBlock = async (req, res) => {
  try {
    let { ticketName, resultDate } = req.body;
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Blocks-Ponnani",
      Item: {
        id: uuidv4(),
        ticketName,
        blockMode: "DATE",
        resultDate,
        createdAt: dayjs().tz("Asia/Calcutta").format(),
      },
    };
    let blockRes = await docClient.put(params).promise();
    return res.status(200).send({
      message: "OK",
      blockRes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ err });
  }
};

const deleteBlock = async (req, res) => {
  try {
    let { blockId, ticketName } = req.query;
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Blocks-Ponnani",
      Key: {
        id: blockId,
        ticketName,
      },
    };
    let blockRes = await docClient.delete(params).promise();
    return res.status(200).send({
      message: "OK",
      blockRes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ err });
  }
};

const getCountBlocks = async (req, res) => {
  try {
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Blocks-Ponnani",
      ExpressionAttributeValues: {
        ":blockMode": "COUNT",
      },
      FilterExpression: "blockMode = :blockMode",
    };

    let dateBlocks;
    let dateBlocksItems = [];
    do {
      dateBlocks = await docClient.scan(params).promise();
      dateBlocksItems = dateBlocksItems.concat(dateBlocks.Items);
      params.ExclusiveStartKey = dateBlocks.LastEvaluatedKey;
    } while (typeof dateBlocks.LastEvaluatedKey != "undefined");

    return res.status(200).send({
      data: dateBlocksItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ err });
  }
};

const addCountBlock = async (req, res) => {
  try {
    let { ticketName, mode, count, group, number } = req.body;
    const docClient = new AWS.DynamoDB.DocumentClient();

    // get current blocks
    var params1 = {
      TableName: "Blocks-Ponnani",
      ExpressionAttributeValues: {
        ":blockMode": "COUNT",
      },
      FilterExpression: "blockMode = :blockMode",
    };

    let dateBlocks;
    let dateBlocksItems = [];
    do {
      dateBlocks = await docClient.scan(params1).promise();
      dateBlocksItems = dateBlocksItems.concat(dateBlocks.Items);
      params1.ExclusiveStartKey = dateBlocks.LastEvaluatedKey;
    } while (typeof dateBlocks.LastEvaluatedKey != "undefined");

    // check for duplicates
    const duplicateFlag = dateBlocksItems.findIndex(
      (i) =>
        i.ticketName == ticketName &&
        i.mode == mode &&
        i.number == number &&
        i.group == group
    );

    if (duplicateFlag !== -1) {
      // duplicate entry exists
      return res.status(409).send({ message: "Entry exists" });
    }

    var params = {
      TableName: "Blocks-Ponnani",
      Item: {
        id: uuidv4(),
        ticketName,
        mode,
        blockMode: "COUNT",
        count,
        group,
        number,
        createdAt: dayjs().tz("Asia/Calcutta").format(),
      },
    };
    let blockRes = await docClient.put(params).promise();
    return res.status(200).send({
      message: "OK",
      blockRes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ err });
  }
};

const editCountBlock = async (req, res) => {
  try {
    let { blockId, ticketName, mode, count, group, number } = req.body;
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Blocks-Ponnani",
      Key: {
        id: blockId,
        ticketName,
      },
      UpdateExpression:
        "set #count = :count, #group = :group, #mode = :mode, #number = :number",
      ExpressionAttributeValues: {
        ":number": number,
        ":count": count,
        ":mode": mode,
        ":group": group,
      },
      ExpressionAttributeNames: {
        "#group": "group",
        "#number": "number",
        "#mode": "mode",
        "#count": "count",
      },
    };
    let blockRes = await docClient.update(params).promise();
    return res.status(200).send({
      message: "OK",
      blockRes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ err });
  }
};

const getUserBlocks = (req, res) => {
  let { userId } = req.query;
  const docClient = new AWS.DynamoDB.DocumentClient();
  var params = {
    TableName: "Users-Ponnani",
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
    ProjectionExpression: "createdAt, id, #name, #type, isEntryBlocked",
  };
  docClient.query(params, function (err, data) {
    if (err) {
      console.log(err);
      return res.status(500).send({ err });
    } else {
      return res.status(200).send({ userInfo: data });
    }
  });
};

const addUserBlocks = async (req, res) => {
  try {
    let { userId, userType } = req.body;
    let newBlock = JSON.parse(req.body.newBlock);
    newBlock["id"] = uuidv4();
    let userData = await getBasicUserInfo(userId);
    let temp = userData.Items[0].isEntryBlocked;
    let userBlocks = [...temp, newBlock];
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Users-Ponnani",
      Key: {
        id: userId,
        type: userType,
      },
      UpdateExpression: "set isEntryBlocked = :userBlocks",
      //   ExpressionAttributeNames: {
      //     "#name": "name",
      //   },
      ExpressionAttributeValues: {
        ":userBlocks": userBlocks,
      },
      ReturnValues: "UPDATED_NEW",
    };
    let queryRes = await docClient.update(params).promise();
    return res.status(200).send({ message: "OK", userData: queryRes });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

const deleteUserBlock = async (req, res) => {
  try {
    let { userId, userType } = req.body;
    let newBlock = JSON.parse(req.body.newBlock);
    let userData = await getBasicUserInfo(userId);
    let temp = userData.Items[0].isEntryBlocked;
    let newTemp = temp.filter((item) => item.id != newBlock.id);
    //   let userBlocks = [...temp, newBlock];
    //   console.log('temp');
    //   console.log(temp);
    //   console.log('newBlock');
    //   console.log(newBlock);
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Users-Ponnani",
      Key: {
        id: userId,
        type: userType,
      },
      UpdateExpression: "set isEntryBlocked = :userBlocks",
      //   ExpressionAttributeNames: {
      //     "#name": "name",
      //   },
      ExpressionAttributeValues: {
        ":userBlocks": newTemp,
      },
      ReturnValues: "UPDATED_NEW",
    };
    let queryRes = await docClient.update(params).promise();
    return res.status(200).send({ message: "OK" });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

const editUserBlock = async (req, res) => {
  try {
    let { userId, userType } = req.body;
    let newBlock = JSON.parse(req.body.newBlock);
    let userData = await getBasicUserInfo(userId);
    let temp = userData.Items[0].isEntryBlocked;
    let newTemp = temp.filter((item) => item.id != newBlock.id);
    newTemp = [...newTemp, newBlock];
    //   let userBlocks = [...temp, newBlock];
    //   console.log('temp');
    //   console.log(temp);
    //   console.log('newBlock');
    //   console.log(newBlock);
    const docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "Users-Ponnani",
      Key: {
        id: userId,
        type: userType,
      },
      UpdateExpression: "set isEntryBlocked = :userBlocks",
      //   ExpressionAttributeNames: {
      //     "#name": "name",
      //   },
      ExpressionAttributeValues: {
        ":userBlocks": newTemp,
      },
      ReturnValues: "UPDATED_NEW",
    };
    let queryRes = await docClient.update(params).promise();
    return res.status(200).send({ message: "OK" });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ err });
  }
};

module.exports = {
  getDateBlocks,
  deleteBlock,
  addDateBlock,
  getCountBlocks,
  addCountBlock,
  editCountBlock,
  getUserBlocks,
  addUserBlocks,
  deleteUserBlock,
  editUserBlock,
};
