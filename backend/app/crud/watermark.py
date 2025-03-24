from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.models.watermark import WatermarkRecord


def create_watermark_record(db: Session, watermark_data: Dict[str, Any]) -> WatermarkRecord:
    """创建水印记录"""
    db_record = WatermarkRecord(**watermark_data)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_watermark_record(db: Session, record_id: int) -> Optional[WatermarkRecord]:
    """获取单个水印记录"""
    return db.query(WatermarkRecord).filter(WatermarkRecord.id == record_id).first()


def get_watermark_records(
    db: Session, 
    skip: int = 0, 
    limit: int = 100, 
    user_id: Optional[int] = None,
    watermark_type: Optional[str] = None
) -> List[WatermarkRecord]:
    """获取水印记录列表"""
    query = db.query(WatermarkRecord)
    
    if user_id is not None:
        query = query.filter(WatermarkRecord.user_id == user_id)
    
    if watermark_type is not None:
        query = query.filter(WatermarkRecord.watermark_type == watermark_type)
    
    return query.order_by(WatermarkRecord.created_at.desc()).offset(skip).limit(limit).all()


def get_public_watermark_records(
    db: Session, 
    skip: int = 0, 
    limit: int = 100
) -> List[WatermarkRecord]:
    """获取公开的水印记录"""
    return db.query(WatermarkRecord).filter(
        WatermarkRecord.is_public == True
    ).order_by(
        WatermarkRecord.created_at.desc()
    ).offset(skip).limit(limit).all()


def update_watermark_record(
    db: Session, 
    record_id: int, 
    update_data: Dict[str, Any]
) -> Optional[WatermarkRecord]:
    """更新水印记录"""
    db_record = get_watermark_record(db, record_id)
    if not db_record:
        return None
    
    for key, value in update_data.items():
        setattr(db_record, key, value)
    
    db.commit()
    db.refresh(db_record)
    return db_record


def delete_watermark_record(db: Session, record_id: int) -> bool:
    """删除水印记录"""
    db_record = get_watermark_record(db, record_id)
    if not db_record:
        return False
    
    db.delete(db_record)
    db.commit()
    return True 