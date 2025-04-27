// 1. 引入 express 和其他必要的模块
// require 是 Node.js 中用于导入模块的关键字。
// 'express' 是我们之前通过 npm install express 安装的框架。
const express = require('express');
// 引入 'pg' 库用于数据库交互
// We need this to connect to and query our PostgreSQL database.
const { Pool } = require('pg');
// 引入 'cors' 中间件处理跨域请求
// This allows our frontend (on a different origin) to make requests to this backend.
const cors = require('cors');

// 2. 创建 Express 应用实例
// 调用 express() 函数会返回一个 Express 应用的实例，我们通常将其赋值给名为 app 的变量。
// 这个 app 对象拥有用于定义路由、配置中间件等的方法。
const app = express();

// 3. 定义端口号
// 我们需要指定服务器监听哪个端口。
// process.env.PORT 是 Node.js 中访问环境变量 PORT 的方式。
// 如果环境变量 PORT 存在（例如，在部署时由平台设置），则使用该值；
// 否则 (||)，使用默认值 3001。这使得端口号可以灵活配置。
const PORT = process.env.PORT || 3001;

// --- 新增：数据库连接配置 ---
// 4. 创建 PostgreSQL 连接池
// 从环境变量读取数据库连接信息
// Using a Pool is efficient as it manages multiple client connections.
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  // 根据需要配置 SSL，与 setup_db.js 保持一致
  // Configure SSL based on environment variable, consistent with setup_db.js
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

// 测试数据库连接 (可选, 但推荐)
// Optional but recommended: Test the database connection on startup.
pool.connect((err, client, release) => {
  if (err) {
    // 如果连接失败，打印错误并退出应用
    // If connection fails, log the error and exit the application.
    return console.error('数据库连接错误:', err.stack); // Logging: Database connection error
  }
  console.log('数据库连接成功！'); // Logging: Database connection successful!
  // 释放客户端连接回连接池
  // Release the client connection back to the pool.
  release();
});

// --- 新增：中间件配置 ---
// 5. 使用 CORS 中间件
// app.use() 用于应用中间件。
// cors() 返回一个中间件函数，允许所有来源的跨域请求。
// For development, allowing all origins is usually fine. In production, you might want to configure specific allowed origins.
app.use(cors());

// 6. 使用 express.json() 中间件
// 这个中间件解析请求体中的 JSON 数据，并将其填充到 req.body。
// This middleware parses incoming requests with JSON payloads and puts the parsed data on req.body.
app.use(express.json());


// --- 修改：移除或保留根路由 ---
// 7. 定义一个简单的根路由 (GET /) - 可以保留用于基本测试
app.get('/', (req, res) => {
  res.send('你好，世界！来自 Todo App 后端。'); // Sending a simple text response
});

// --- 新增：API 路由 ---
// 8. API 路由定义 (根据 PROJECT_SPEC.md)

// GET /api/todos - 获取所有待办事项
// Handles GET requests to retrieve all todo items.
app.get('/api/todos', async (req, res) => {
  try {
    // 从连接池获取一个客户端连接
    // Get a client connection from the pool.
    const client = await pool.connect();
    try {
      // 执行 SQL 查询语句获取所有 todos，按 id 排序
      // Execute SQL query to select all todos, ordering by id.
      const result = await client.query('SELECT * FROM todos ORDER BY id ASC');
      // 发送 JSON 格式的响应，包含查询结果
      // Send a JSON response containing the query results.
      res.json(result.rows);
    } finally {
      // 无论查询成功或失败，都释放客户端连接
      // Always release the client connection back to the pool.
      client.release();
    }
  } catch (err) {
    // 如果过程中出现任何错误，记录错误并发送 500 状态码和错误信息
    // If any error occurs, log it and send a 500 Internal Server Error response.
    console.error('获取 todos 时出错:', err.stack); // Logging: Error fetching todos
    res.status(500).json({ error: '服务器内部错误' }); // Internal Server Error
  }
});

// POST /api/todos - 添加新的待办事项
// Handles POST requests to add a new todo item.
app.post('/api/todos', async (req, res) => {
  // 从请求体中获取 'text' 字段
  // Get the 'text' field from the request body (parsed by express.json()).
  const { text } = req.body;

  // 简单验证：确保 'text' 存在且不为空
  // Basic validation: ensure 'text' exists and is not empty.
  if (!text || text.trim() === '') {
    return res.status(400).json({ error: '待办事项内容不能为空' }); // Bad Request: Todo text cannot be empty
  }

  try {
    const client = await pool.connect();
    try {
      // 执行 SQL 插入语句，将新的 todo 插入数据库
      // Execute SQL INSERT statement to add the new todo.
      // RETURNING * 返回新插入的行的数据。
      // 'RETURNING *' returns the data of the newly inserted row.
      const result = await client.query(
        'INSERT INTO todos (text) VALUES ($1) RETURNING *',
        [text] // $1 是参数化查询的占位符，对应数组中的第一个元素 (text)
               // $1 is a placeholder for parameterized query, corresponding to the first element in the array (text). This prevents SQL injection.
      );
      // 发送 201 状态码 (Created) 和新创建的 todo 对象
      // Send a 201 Created status code and the newly created todo object.
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('添加 todo 时出错:', err.stack); // Logging: Error adding todo
    res.status(500).json({ error: '服务器内部错误' }); // Internal Server Error
  }
});

// PUT /api/todos/:id - 更新待办事项状态
// Handles PUT requests to update the 'completed' status of a specific todo item.
app.put('/api/todos/:id', async (req, res) => {
  // 从 URL 路径参数中获取 'id'
  // Get the 'id' from the URL path parameters (e.g., /api/todos/123 -> id is 123).
  const { id } = req.params;
  // 从请求体中获取 'completed' 状态
  // Get the 'completed' status from the request body.
  const { completed } = req.body;

  // 验证 'completed' 是否为布尔值
  // Validate if 'completed' is a boolean value.
  if (typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed 状态必须是布尔值' }); // Bad Request: 'completed' status must be boolean
  }

  // 验证 id 是否为有效数字
  // Validate if 'id' is a valid number.
  const todoId = parseInt(id, 10);
  if (isNaN(todoId)) {
      return res.status(400).json({ error: '无效的待办事项 ID' }); // Bad Request: Invalid todo ID
  }


  try {
    const client = await pool.connect();
    try {
      // 执行 SQL 更新语句，根据 id 更新 'completed' 状态
      // Execute SQL UPDATE statement to change the 'completed' status based on id.
      // RETURNING * 返回更新后的行的数据。
      // 'RETURNING *' returns the data of the updated row.
      const result = await client.query(
        'UPDATE todos SET completed = $1 WHERE id = $2 RETURNING *',
        [completed, todoId] // $1 -> completed, $2 -> todoId
      );

      // 检查是否有行被更新
      // Check if any row was actually updated.
      if (result.rows.length === 0) {
        // 如果没有找到对应 id 的 todo，返回 404 Not Found
        // If no todo with the given id was found, return 404 Not Found.
        return res.status(404).json({ error: '未找到指定的待办事项' }); // Not Found: Todo not found
      }
      // 发送更新后的 todo 对象
      // Send the updated todo object.
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`更新 todo (ID: ${id}) 时出错:`, err.stack); // Logging: Error updating todo
    res.status(500).json({ error: '服务器内部错误' }); // Internal Server Error
  }
});

// DELETE /api/todos/:id - 删除指定的待办事项
// Handles DELETE requests to remove a specific todo item.
app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;

  // 验证 id 是否为有效数字
  // Validate if 'id' is a valid number.
  const todoId = parseInt(id, 10);
   if (isNaN(todoId)) {
       return res.status(400).json({ error: '无效的待办事项 ID' }); // Bad Request: Invalid todo ID
   }

  try {
    const client = await pool.connect();
    try {
      // 执行 SQL 删除语句，根据 id 删除 todo
      // Execute SQL DELETE statement to remove the todo based on id.
      const result = await client.query('DELETE FROM todos WHERE id = $1', [todoId]);

      // result.rowCount 包含被删除的行数
      // result.rowCount contains the number of rows deleted.
      if (result.rowCount === 0) {
        // 如果没有行被删除（即找不到对应 id），返回 404
        // If no rows were deleted (meaning the id wasn't found), return 404.
        return res.status(404).json({ error: '未找到指定的待办事项' }); // Not Found: Todo not found
      }
      // 发送 200 OK 和成功消息 (或者 204 No Content 也可以)
      // Send 200 OK with a success message (or 204 No Content is also common).
      res.json({ message: '待办事项已删除' }); // Todo deleted
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`删除 todo (ID: ${id}) 时出错:`, err.stack); // Logging: Error deleting todo
    res.status(500).json({ error: '服务器内部错误' }); // Internal Server Error
  }
});


// --- 保留：启动服务器 ---
// 9. 启动服务器并监听指定端口
// app.listen() 方法用于启动服务器，使其开始监听指定端口上的连接请求。
// 第一个参数是端口号。
// 第二个参数是一个可选的回调函数，当服务器成功启动并开始监听时，这个函数会被执行。
app.listen(PORT, () => {
  // 在服务器控制台打印一条消息，告知开发者服务器正在运行以及监听的端口。
  console.log(`后端服务器正在运行在 http://localhost:${PORT}`); // Logging server start
}); 