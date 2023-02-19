module.exports = {
  aws_table_name: "entries",
  aws_local_config: {
    //Provide details for local configuration
  },
  aws_remote_config: {
    accessKeyId: "XXXXXX",
    secretAccessKey: "XXXXXX",
    region: "ap-south-1",
  },
  dbConf: {
    host: "XXXXXX",
    user: "admin",
    password: "XXXXXX",
    port: "3306",
    dateStrings: true,
  },
  dbPoolConf: {
    host: "XXXXXX",
    user: "admin",
    password: "XXXXXX",
    database: "new_schema",
    port: "3306",
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0,
    dateStrings: true,
  },
};
