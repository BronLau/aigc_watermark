from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.api.auth_api import get_current_active_user
from app.crud.watermark import (
    create_watermark_record,
    get_watermark_record,
    get_watermark_records,
    get_public_watermark_records,
    update_watermark_record,
    delete_watermark_record
)
from app.schemas.watermark import (
    WatermarkRecord as WatermarkRecordSchema,
    WatermarkCreate,
    WatermarkUpdate,
    WatermarkRecordList,
    WatermarkStatistics
)
from app.models.watermark import WatermarkRecord
from app.models.user import User

router = APIRouter()


@router.post("/", response_model=WatermarkRecordSchema)
async def create_record(
    record_data: WatermarkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    创建水印记录
    """
    # 如果用户已登录，添加用户ID
    if current_user:
        record_data.user_id = current_user.id
    
    db_record = create_watermark_record(db, record_data.dict())
    return db_record


@router.get("/{record_id}", response_model=WatermarkRecordSchema)
async def read_record(
    record_id: int = Path(..., description="水印记录ID"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_active_user)
):
    """
    获取单个水印记录
    """
    db_record = get_watermark_record(db, record_id)
    if db_record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    # 检查访问权限
    if not db_record.is_public and (not current_user or db_record.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="无权访问此记录")
    
    return db_record


@router.get("/", response_model=WatermarkRecordList)
async def read_records(
    skip: int = Query(0, description="跳过的记录数"),
    limit: int = Query(20, description="限制返回的记录数"),
    watermark_type: Optional[str] = Query(None, description="水印类型过滤"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_active_user)
):
    """
    获取水印记录列表
    """
    # 如果用户已登录，获取用户的记录
    if current_user:
        records = get_watermark_records(
            db, 
            skip=skip, 
            limit=limit, 
            user_id=current_user.id, 
            watermark_type=watermark_type
        )
        total = db.query(WatermarkRecord).filter(
            WatermarkRecord.user_id == current_user.id
        ).count()
    else:
        # 未登录用户只能看到公开记录
        records = get_public_watermark_records(db, skip=skip, limit=limit)
        total = db.query(WatermarkRecord).filter(
            WatermarkRecord.is_public == True
        ).count()
    
    return {
        "total": total,
        "records": records
    }


@router.get("/statistics", response_model=WatermarkStatistics)
async def get_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取水印使用统计
    """
    # 只统计用户自己的记录
    query_base = db.query(WatermarkRecord).filter(
        WatermarkRecord.user_id == current_user.id
    )
    
    total = query_base.count()
    text_watermarks = query_base.filter(WatermarkRecord.watermark_type == "text").count()
    image_watermarks = query_base.filter(WatermarkRecord.watermark_type == "image").count()
    dct_watermarks = query_base.filter(WatermarkRecord.watermark_type == "dct").count()
    dwt_watermarks = query_base.filter(WatermarkRecord.watermark_type == "dwt").count()
    lsb_watermarks = query_base.filter(WatermarkRecord.watermark_type == "lsb").count()
    
    return {
        "total_records": total,
        "text_watermarks": text_watermarks,
        "image_watermarks": image_watermarks,
        "dct_watermarks": dct_watermarks,
        "dwt_watermarks": dwt_watermarks,
        "lsb_watermarks": lsb_watermarks
    }


@router.put("/{record_id}", response_model=WatermarkRecordSchema)
async def update_record(
    record_id: int = Path(..., description="水印记录ID"),
    record_data: WatermarkUpdate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    更新水印记录
    """
    # 获取记录
    db_record = get_watermark_record(db, record_id)
    if db_record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    # 检查权限
    if db_record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改此记录")
    
    # 更新记录
    updated_record = update_watermark_record(
        db, 
        record_id, 
        record_data.dict(exclude_unset=True)
    )
    
    return updated_record


@router.delete("/{record_id}", response_model=dict)
async def delete_record(
    record_id: int = Path(..., description="水印记录ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    删除水印记录
    """
    # 获取记录
    db_record = get_watermark_record(db, record_id)
    if db_record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    # 检查权限
    if db_record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此记录")
    
    # 删除记录
    success = delete_watermark_record(db, record_id)
    
    if success:
        return {"message": "记录已删除"}
    else:
        raise HTTPException(status_code=500, detail="删除记录失败") 