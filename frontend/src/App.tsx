import { useState, useEffect } from 'react';
import axios from 'axios'; // 引入 axios 用于发送 HTTP 请求
import './App.css'; // 引入 CSS 文件

// 定义 Todo 对象的接口，明确其结构和类型
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function App() {
  // --- State ---
  // 使用 Todo[] 类型注解 todos 状态
  const [todos, setTodos] = useState<Todo[]>([]);
  // 用于存储输入框中的新待办事项文本，初始为空字符串
  const [newTodoText, setNewTodoText] = useState<string>('');
  // 使用 string | null 类型注解 error 状态
  const [error, setError] = useState<string | null>(null);

  // --- Effects ---
  // useEffect Hook：在组件首次加载时获取待办事项列表
  useEffect(() => {
    fetchTodos(); // 调用获取数据的函数
  }, []); // 空依赖数组 [] 表示这个 effect 只在组件挂载时运行一次

  // --- API Functions ---
  // 获取所有待办事项
  const fetchTodos = async () => {
    console.log('fetchTodos: 开始执行'); // Log: Starting fetchTodos
    setError(null); // 清除之前的错误
    try {
      // 发送 GET 请求到后端 /api/todos
      // 注意：因为配置了 Vite 代理，Vite 会自动将此请求转发到 http://localhost:3001/api/todos
      // 明确 axios.get 的响应数据类型为 Todo[]
      console.log('fetchTodos: 发送 GET /api/todos 请求...'); // Log: Sending GET request
      const response = await axios.get<Todo[]>('/api/todos');
      console.log('fetchTodos: 收到响应:', response); // Log: Received response object
      console.log('fetchTodos: 响应数据 (response.data):', response.data); // Log: Received response data

      // 在调用 setTodos 之前检查响应数据是否为数组
      if (Array.isArray(response.data)) {
        setTodos(response.data); // 使用从后端获取的数据更新 todos 状态
        console.log('fetchTodos: response.data 是数组，已更新状态。'); // Log: Data is array, state updated
      } else {
        console.error('fetchTodos: 错误 - 后端响应数据不是一个数组! Data:', response.data); // Log Error: Response data is not an array
        setError('从服务器获取的数据格式不正确。');
        setTodos([]); // 设置为空数组以避免 .map 错误
      }
    } catch (err) {
      console.error('fetchTodos: 请求或处理过程中捕获到错误:', err); // Log Error: Caught error during request/processing
      // 尝试记录更详细的错误信息（如果可用）
      if (axios.isAxiosError(err)) {
        console.error('Axios Error Details:', err.response?.data, err.response?.status, err.request);
      }
      setError('无法加载待办事项，请检查后端服务或网络连接。');
      setTodos([]); // 发生错误时也设置为空数组
    }
    console.log('fetchTodos: 执行完毕'); // Log: fetchTodos finished
  };

  // 添加新的待办事项
  // 为事件参数 e 添加类型 React.FormEvent<HTMLFormElement>
  const addTodo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // 阻止表单默认提交行为
    if (!newTodoText.trim()) return; // 如果输入为空或只有空格，则不添加
    setError(null);
    try {
      // 发送 POST 请求到后端 /api/todos，请求体中包含新事项的文本
      await axios.post('/api/todos', { text: newTodoText });
      setNewTodoText(''); // 清空输入框
      fetchTodos(); // 添加成功后重新获取列表以更新界面
    } catch (err) {
      console.error('添加待办事项失败:', err);
      setError('无法添加待办事项，请稍后再试。');
    }
  };

  // 切换待办事项的完成状态
  // 为参数 id 添加 number 类型，currentStatus 添加 boolean 类型
  const toggleComplete = async (id: number, currentStatus: boolean) => {
    setError(null);
    try {
      // 发送 PUT 请求到后端 /api/todos/:id，请求体中包含新的完成状态
      await axios.put(`/api/todos/${id}`, { completed: !currentStatus });
      fetchTodos(); // 更新成功后重新获取列表
    } catch (err) {
      console.error('更新待办事项状态失败:', err);
      setError('无法更新状态，请稍后再试。');
    }
  };

  // 删除待办事项
  // 为参数 id 添加 number 类型
  const deleteTodo = async (id: number) => {
    setError(null);
    try {
      // 发送 DELETE 请求到后端 /api/todos/:id
      await axios.delete(`/api/todos/${id}`);
      fetchTodos(); // 删除成功后重新获取列表
    } catch (err) {
      console.error('删除待办事项失败:', err);
      setError('无法删除待办事项，请稍后再试。');
    }
  };

  // --- Render ---
  return (
    <div className="app-container">
      <h1>在线待办事项</h1>

      {/* 显示错误信息 */}
      {error && <p className="error-message">{error}</p>}

      {/* 添加新事项的表单 */}
      <form onSubmit={addTodo} className="add-todo-form">
        <input
          type="text"
          value={newTodoText}
          // 为事件参数 e 添加类型 React.ChangeEvent<HTMLInputElement>
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTodoText(e.target.value)}
          placeholder="添加新的待办事项..."
          className="todo-input"
        />
        <button type="submit" className="add-button">添加</button>
      </form>

      {/* 待办事项列表 */}
      <ul className="todo-list">
        {/* 现在 TypeScript 知道 todos 是 Todo[] 类型，可以安全访问属性 */}
        {todos.map((todo: Todo) => (
          // 为每个 todo 项渲染一个列表项，使用 todo.id 作为 key
          <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
            <input
              type="checkbox"
              checked={todo.completed} // 复选框的选中状态与 todo.completed 同步
              onChange={() => toggleComplete(todo.id, todo.completed)} // 点击时切换完成状态
            />
            <span className="todo-text">{todo.text}</span>
            <button onClick={() => deleteTodo(todo.id)} className="delete-button">删除</button>
          </li>
        ))}
      </ul>
       {/* 如果列表为空且没有错误，显示提示 */}
       {!error && todos.length === 0 && <p className="empty-message">还没有待办事项，快添加一个吧！</p>}
    </div>
  );
}

export default App;
