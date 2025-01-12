## Code Combination Script

The project includes a script to combine meaningful code files into a single text file. This is useful for providing context to AI models or for documentation purposes.

### Running the Script

1. Navigate to the project root directory
2. Run the script using Python:
   ```bash
   python scripts/generate_code_pdf.py
   ```
3. The script will:
   - Scan the configured directories for code files
   - Combine them into `combined_code.txt`

The combined file will be created in the project root directory.

# MagicWeiqi

## 设置指南 (macOS 和 Windows)

### 环境要求

- **Python**: 确保已安装 Python 3.9 或更高版本。
- **Node.js**: 建议安装 Node.js 20.x 或更高版本。

---

### 后端设置

1. 克隆代码仓库并进入 `backend` 目录：

   ```bash
   git clone https://github.com/qianwenweiqi/magicweiqi.git
   cd magicweiqi/backend
   ```

2. 创建并激活虚拟环境：

   - macOS 和 Linux 系统：

     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

   - Windows 系统：

     ```cmd
     python -m venv venv
     .\venv\Scripts\Activate
     ```

3. 安装依赖：

   ```bash
   pip install -r requirements.txt
   ```

4. 运行后端服务：

   ```bash (/magicweiqi)
   uvicorn backend.main:app --reload
   ```

---

### 前端设置

1. 进入 `frontend` 目录：

   ```bash
   cd ../frontend
   ```

2. 安装依赖：

   ```bash
   npm install
   ```

3. 运行前端服务：

   ```bash
   npm start
   ```

---

### 访问应用

- 打开浏览器并访问 [http://localhost:3000](http://localhost:3000)
- 后端使用AWS，绕过登录验证可以用账号test/密码test
