import os
import sys
import logging
from sqlalchemy.orm import Session

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import Base, engine, SessionLocal
from app.models.user import User
from app.crud.user import create_user
from app.core.config import settings


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db(db: Session) -> None:
    """初始化数据库，创建初始管理员用户"""
    # 创建数据库表
    Base.metadata.create_all(bind=engine)
    logger.info("数据库表创建完成")
    
    # 检查是否已存在管理员用户
    admin = db.query(User).filter(User.username == "admin").first()
    if admin:
        logger.info("管理员用户已存在，跳过创建")
        return
    
    # 创建管理员用户
    user_data = {
        "username": "admin",
        "email": "admin@example.com",
        "password": "admin123",  # 实际应用中应使用环境变量或配置文件
        "full_name": "系统管理员",
        "is_admin": True
    }
    
    create_user(db, user_data)
    logger.info("管理员用户创建成功")


def main() -> None:
    """主函数"""
    logger.info("正在创建初始数据库...")
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()
    logger.info("数据库初始化完成")


if __name__ == "__main__":
    main() 