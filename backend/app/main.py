from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
import os
import shutil
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime
import logging

from app.api import watermark_api, auth_api, watermark_record_api
from app.core.config import settings
from app.core.database import Base, engine
from app.api.api import router as api_router
from app.models import watermark, user

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AIGC水印标识系统",
    description="符合中国工信部《人工智能生成合成内容标识办法》的AIGC内容标识系统",
    version="1.0.0"
)

# 配置CORS - 使用宽松配置
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8080",
    "http://localhost:9999",
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:9999",
    "*",  # 允许所有源
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=".*",  # 允许所有源的正则表达式
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头部
    expose_headers=["*"],  # 暴露所有头部
    max_age=3600,
)

# 创建必要的目录
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
os.makedirs(settings.STATIC_DIR, exist_ok=True)

# 为图像添加挂载点，确保正确的MIME类型处理
app.mount(
    "/images", 
    StaticFiles(directory=settings.PROCESSED_DIR, html=False, check_dir=True), 
    name="images"
)

# 挂载静态文件目录
app.mount(
    "/static", 
    StaticFiles(directory=settings.PROCESSED_DIR, html=False, check_dir=True), 
    name="static"
)

# 挂载处理后的图片目录
app.mount(
    "/processed", 
    StaticFiles(directory=settings.PROCESSED_DIR, html=False, check_dir=True), 
    name="processed"
)

# 添加请求拦截中间件用于日志记录和CORS处理
@app.middleware("http")
async def add_process_time_header(request, call_next):
    logger.info(f"Request path: {request.url.path}")
    logger.info(f"Request method: {request.method}")
    logger.info(f"Request headers: {request.headers}")
    
    # 处理预检请求
    if request.method == "OPTIONS":
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
    
    response = await call_next(request)
    
    # 添加CORS头到所有响应
    response.headers["Access-Control-Allow-Origin"] = "*"
    if "/static/" in request.url.path or "/images/" in request.url.path:
        # 为静态文件添加额外的缓存控制和安全头
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["Content-Type"] = "image/png"
        # 移除Content-Security-Policy以防止阻止图片跨域加载
        # response.headers["Content-Security-Policy"] = "default-src 'self'"
    
    logger.info(f"Response status: {response.status_code}")
    logger.info(f"Response headers: {response.headers}")
    
    return response

# 包含API路由
app.include_router(watermark_api.router, prefix="/watermark", tags=["watermark"])
app.include_router(auth_api.router, prefix="/api/auth", tags=["auth"])
app.include_router(watermark_record_api.router, prefix="/api/records", tags=["records"])
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "AIGC水印标识系统API"}

# 健康检查端点
@app.get("/health")
async def health_check():
    logger.info("健康检查被调用")
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting server on port 8000")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info") 