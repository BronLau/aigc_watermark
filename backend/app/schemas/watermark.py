from pydantic import BaseModel, Field
from typing import Optional, List, Union
from datetime import datetime
from enum import Enum


class InvisibleWatermarkAlgorithm(str, Enum):
    """不可见水印算法枚举"""
    DCT = "dct"
    DWT = "dwt"
    LSB = "lsb"


class WatermarkAlgorithm(str, Enum):
    """水印算法枚举，包括自动检测选项"""
    auto = "auto"
    dct = "dct"
    dwt = "dwt"
    lsb = "lsb"


class WatermarkBase(BaseModel):
    """水印基础模型"""
    watermark_type: str
    position: Optional[str] = None
    opacity: Optional[float] = None
    scale: Optional[float] = None
    is_public: bool = True


class AddWatermarkParams(WatermarkBase):
    text: Optional[str] = None
    alpha: Optional[float] = None
    algorithm: Optional[str] = None


class WatermarkResponse(BaseModel):
    success: bool
    message: str
    image_url: Optional[str] = None
    result_url: Optional[str] = None
    watermarked_image_url: Optional[str] = None
    extracted_watermark: Optional[str] = None


class WatermarkExtractResponse(BaseModel):
    """水印提取响应模型"""
    success: bool
    message: str
    watermark_text: Optional[str] = None
    watermark_image_url: Optional[str] = None
    confidence: float = 0.0
    detected: bool = False
    algorithm: Optional[str] = None


class WatermarkCreate(WatermarkBase):
    """创建水印记录的模型"""
    original_filename: str
    processed_filename: str
    processed_url: str
    watermark_text: Optional[str] = None
    watermark_image_path: Optional[str] = None
    user_id: Optional[int] = None


class WatermarkUpdate(BaseModel):
    """更新水印记录的模型"""
    watermark_text: Optional[str] = None
    position: Optional[str] = None
    opacity: Optional[float] = None
    scale: Optional[float] = None
    alpha: Optional[float] = None
    is_public: Optional[bool] = None


class WatermarkRecord(WatermarkBase):
    """水印记录响应模型"""
    id: int
    original_filename: str
    processed_filename: str
    processed_url: str
    created_at: datetime
    user_id: Optional[int] = None

    class Config:
        orm_mode = True


class WatermarkRecordList(BaseModel):
    """水印记录列表模型"""
    total: int
    records: List[WatermarkRecord]


class WatermarkStatistics(BaseModel):
    """水印使用统计模型"""
    total_records: int
    text_watermarks: int
    image_watermarks: int
    dct_watermarks: int
    dwt_watermarks: int
    lsb_watermarks: int


class Watermark(WatermarkBase):
    id: int
    original_filename: str
    processed_filename: str
    processed_url: str
    watermark_text: Optional[str] = None
    watermark_image_path: Optional[str] = None
    user_id: Optional[int] = None
    created_at: str

    class Config:
        from_attributes = True 