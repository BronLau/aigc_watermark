# AIGC 水印系统

这是一个用于AIGC（AI生成内容）的水印管理系统，包含前端和后端组件。

## 项目结构

- `frontend/`: 前端React应用
- `backend/`: 后端Python服务

## 安装与运行

### 前端

```bash
cd frontend
npm install
# 复制环境变量示例文件
cp .env.example .env
# 根据需要修改.env文件
npm start
```

### 后端

```bash
cd backend
pip install -r requirements.txt
# 初始化数据库
python init_db.py
python main.py
```

## 功能

- 为AI生成的图像添加水印
- 验证图像中的水印
- 管理水印记录

## 技术栈

### 前端
- React
- TypeScript

### 后端
- Python
- FastAPI

## 开发说明

项目包含启动脚本：
- `frontend/start.bat`: 启动前端服务
- `backend/start.bat`: 启动后端服务

## 目录说明

- `backend/uploads/`: 用户上传的原始图片存储目录
- `backend/processed/`: 处理后的带水印图片存储目录

## 贡献指南

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 将您的更改推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

[MIT](LICENSE) 