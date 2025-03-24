import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # API配置
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "AIGC水印标识系统"
    
    # 服务器配置
    BASE_URL: str = os.environ.get("BASE_URL", "http://0.0.0.0:8000")  # 服务器基本URL，使用环境变量或默认为0.0.0.0
    
    # 文件目录配置
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    PROCESSED_DIR: str = os.path.join(BASE_DIR, "processed")
    STATIC_DIR: str = os.path.join(BASE_DIR, "static")
    
    # 安全配置
    SECRET_KEY: str = "your-secret-key-here"  # 生产环境中应使用环境变量
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # 水印配置
    DEFAULT_WATERMARK_TEXT: str = ""  # 默认为空，强制用户提供自己的水印文本
    DEFAULT_WATERMARK_OPACITY: float = 0.3
    DEFAULT_WATERMARK_POSITION: str = "bottom-right"
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    MAX_IMAGE_SIZE: int = 10 * 1024 * 1024  # 10 MB
    
    # 是否禁用自动添加AIGC标识 - 默认禁用，即不添加AIGC标识
    DISABLE_AUTO_WATERMARK: bool = True
    
    # 数据库配置
    DATABASE_URL: str = "sqlite:///./aigc_watermark.db"
    
    # 静态文件URL前缀
    STATIC_URL: str = "/static"


settings = Settings() 