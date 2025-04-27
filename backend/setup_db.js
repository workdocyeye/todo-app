// 引入 'pg' 库，用于与 PostgreSQL 数据库交互
// This library allows Node.js applications to interface with PostgreSQL databases.
const { Pool } = require('pg');

// 定义 SQL 语句，用于创建 'todos' 表（如果不存在）
// The 'IF NOT EXISTS' clause prevents an error if the table already exists.
const createTableQuery = `
CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,          -- Unique identifier for the todo item, auto-incrementing integer.
    text VARCHAR(255) NOT NULL,     -- The content of the todo item, cannot be empty. Max length 255 characters.
    completed BOOLEAN DEFAULT FALSE -- The completion status of the todo item, defaults to false (not completed).
);
`;

// 异步函数，用于设置数据库
// An async function allows us to use 'await' for asynchronous operations like database connections.
async function setupDatabase() {
  console.log('正在读取数据库连接信息从环境变量...'); // Logging: Reading database connection info from environment variables...

  // 从环境变量读取数据库配置，但不包括具体的数据库名，因为初始连接可能需要连接到 'postgres'
  // These variables need to be set in the environment before running the script.
  const baseDbConfig = {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    // 根据环境变量 PGSSLMODE 决定是否启用 SSL。Sealos 通常需要 SSL。
    // Setting ssl to 'require' enforces SSL connection. 'rejectUnauthorized: false' might be needed for self-signed certs, adjust if necessary.
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  };
  const targetDatabase = process.env.PGDATABASE; // 目标数据库名

  // 检查是否所有必需的环境变量都已设置
  // Validates that all required connection parameters are provided.
  if (!baseDbConfig.host || !baseDbConfig.port || !baseDbConfig.user || !baseDbConfig.password || !targetDatabase) {
    console.error('错误：缺少必要的数据库连接环境变量 (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)。'); // Error: Missing necessary database connection environment variables...
    // Exit the process with an error code if configuration is incomplete.
    process.exit(1);
  }

  // --- 步骤 1: 连接到默认数据库并创建目标数据库 ---
  let initialPool;
  let initialClient;
  try {
    // 使用基础配置，连接到默认的 'postgres' 数据库
    console.log(`尝试连接到默认数据库 'postgres' 在 ${baseDbConfig.host}:${baseDbConfig.port}...`);
    initialPool = new Pool({ ...baseDbConfig, database: 'postgres' });
    initialClient = await initialPool.connect();
    console.log("成功连接到 'postgres' 数据库。");

    // 执行创建目标数据库的命令
    console.log(`正在尝试创建数据库 '${targetDatabase}'...`);
    await initialClient.query(`CREATE DATABASE ${targetDatabase}`);
    console.log(`数据库 '${targetDatabase}' 创建成功。`);

  } catch (err) {
    // 如果错误是 "数据库已存在"，则忽略，否则抛出错误
    // PostgreSQL error code for "duplicate_database" is '42P04'
    if (err.code === '42P04') {
      console.log(`数据库 '${targetDatabase}' 已存在，跳过创建。`);
    } else {
      console.error(`创建数据库 '${targetDatabase}' 时出错:`, err.stack);
      // 退出前确保释放连接和关闭连接池
      if (initialClient) initialClient.release();
      if (initialPool) await initialPool.end();
      process.exit(1);
    }
  } finally {
    // 释放初始连接和关闭初始连接池
    if (initialClient) {
      initialClient.release();
      console.log("到 'postgres' 数据库的连接已释放。");
    }
    if (initialPool) {
      await initialPool.end();
      console.log("到 'postgres' 数据库的连接池已关闭。");
    }
  }

  // --- 步骤 2: 连接到目标数据库并创建表 ---
  let targetPool;
  let targetClient;
  try {
    console.log(`尝试连接到目标数据库 '${targetDatabase}' 在 ${baseDbConfig.host}:${baseDbConfig.port}...`); // Logging: Attempting to connect to target database...

    // 创建连接到目标数据库的连接池
    targetPool = new Pool({ ...baseDbConfig, database: targetDatabase });

    // 获取客户端连接
    targetClient = await targetPool.connect(); // Acquire a client connection from the pool.
    console.log(`数据库 '${targetDatabase}' 连接成功！`); // Logging: Database connection successful!

    // 执行创建表的 SQL 语句
    console.log('正在执行创建 "todos" 表的 SQL 语句...'); // Logging: Executing SQL statement to create "todos" table...
    await targetClient.query(createTableQuery); // Send the CREATE TABLE query to the database.
    console.log('"todos" 表已成功创建或已存在。'); // Logging: "todos" table created successfully or already exists.

  } catch (err) {
    // 如果在连接或执行查询时发生错误
    console.error(`连接到 '${targetDatabase}' 或创建表时出错:`, err.stack); // Logging: Database operation failed: [error stack]
    // Exit the process with an error code on failure.
    process.exit(1);
  } finally {
    // 无论成功或失败，都尝试释放客户端连接和关闭连接池
    if (targetClient) {
      targetClient.release(); // Release the client back to the pool.
      console.log(`到 '${targetDatabase}' 数据库的连接已释放。`); // Logging: Database connection released.
    }
    if (targetPool) {
      await targetPool.end(); // Closes all connections in the pool and shuts down the pool.
      console.log(`到 '${targetDatabase}' 数据库的连接池已关闭。`); // Logging: Database connection pool closed.
    }
  }

  console.log("数据库设置完成！");
}

// 调用异步函数执行数据库设置
// Calls the main async function to start the database setup process.
setupDatabase(); 