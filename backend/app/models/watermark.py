from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.sql import func

from app.core.database import Base


class WatermarkRecord(Base):
    """水印记录模型"""
    __tablename__ = "watermark_records"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String(255), nullable=False)
    processed_filename = Column(String(255), nullable=False)
    watermark_type = Column(String(50), nullable=False)  # text, image, dct, dwt, lsb
    watermark_text = Column(Text, nullable=True)
    watermark_image_path = Column(String(255), nullable=True)
    position = Column(String(50), nullable=True)
    opacity = Column(Float, nullable=True)
    scale = Column(Float, nullable=True)
    alpha = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_url = Column(String(255), nullable=True)
    user_id = Column(Integer, nullable=True, index=True)
    is_public = Column(Boolean, default=False)
    
    def to_dict(self):
        """将模型转换为字典"""
        return {
            "id": self.id,
            "original_filename": self.original_filename,
            "processed_filename": self.processed_filename,
            "watermark_type": self.watermark_type,
            "watermark_text": self.watermark_text,
            "position": self.position,
            "opacity": self.opacity,
            "scale": self.scale,
            "alpha": self.alpha,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "processed_url": self.processed_url,
            "is_public": self.is_public
        } 