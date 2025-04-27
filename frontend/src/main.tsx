import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import './index.css' // 移除默认的 index.css 导入
import './App.css'; // 导入我们修改过的 App.css
import App from './App.tsx' // 确认从 App.tsx 导入

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
