from PIL import Image, ImageDraw, ImageFont
import os
import numpy as np
from typing import Tuple, Union, Optional
import uuid
import cv2
from datetime import datetime

from app.core.config import settings


class VisibleWatermark:
    """
    实现显式水印的服务类
    支持添加文本和图片水印
    """
    
    def __init__(self):
        self.font_path = os.path.join(settings.BASE_DIR, "app", "assets", "fonts", "simhei.ttf")
        # 确保字体目录存在
        os.makedirs(os.path.dirname(self.font_path), exist_ok=True)
        # 确保目录存在
        os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
        
    def add_text_watermark(
        self,
        image_path: str,
        text: str = "",
        position: str = "bottom-right",
        opacity: float = 0.3,
        font_size: int = 36,
        color: Tuple[int, int, int] = (255, 255, 255),
        output_path: Optional[str] = None
    ) -> str:
        """
        为图像添加文本水印
        
        参数:
            image_path: 输入图像路径
            text: 水印文本内容
            position: 水印位置 (top-left, top-right, bottom-left, bottom-right, center)
            opacity: 水印透明度 (0.0-1.0)
            font_size: 字体大小
            color: 水印颜色 (RGB)
            output_path: 输出图像路径，如不指定则自动生成
            
        返回:
            输出图像路径
        """
        try:
            # 打开原始图像
            img = Image.open(image_path).convert("RGBA")
            width, height = img.size
            
            # 创建文本水印层
            txt_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(txt_layer)
            
            # 加载字体
            try:
                font = ImageFont.truetype(self.font_path, font_size)
            except IOError:
                # 如果找不到字体，使用默认字体
                font = ImageFont.load_default()
            
            # 获取文本大小
            # 在新版本Pillow中，textsize方法已被移除，使用font.getbbox代替
            try:
                # 使用传入的文本参数
                watermark_text = text
                
                # 使用font.getbbox方法获取文本大小
                bbox = font.getbbox(watermark_text)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
            except AttributeError:
                # 向后兼容，如果getbbox不可用
                bbox = font.getsize(watermark_text)
                text_width, text_height = bbox
            
            # 确定水印位置
            x, y = self._calculate_position(position, width, height, text_width, text_height)
            
            # 绘制水印文本
            draw.text((x, y), watermark_text, font=font, fill=(*color, int(255 * opacity)))
            
            # 将水印层合并到原始图像
            watermarked = Image.alpha_composite(img, txt_layer)
            
            # 如果没有指定输出路径，则生成一个
            if output_path is None:
                filename = f"{uuid.uuid4()}.png"
                output_path = os.path.join(settings.PROCESSED_DIR, filename)
            
            # 保存水印图像
            watermarked.convert("RGB").save(output_path)
            
            return output_path
            
        except Exception as e:
            print(f"添加文本水印失败: {str(e)}")
            raise
    
    def add_image_watermark(
        self,
        image_path: str,
        watermark_image_path: str,
        position: str = "bottom-right",
        opacity: float = 0.3,
        scale: float = 0.2,
        output_path: Optional[str] = None
    ) -> str:
        """
        为图像添加图像水印
        
        参数:
            image_path: 输入图像路径
            watermark_image_path: 水印图像路径
            position: 水印位置 (top-left, top-right, bottom-left, bottom-right, center)
            opacity: 水印透明度 (0.0-1.0)
            scale: 水印大小缩放比例 (相对于原图)
            output_path: 输出图像路径，如不指定则自动生成
            
        返回:
            输出图像路径
        """
        print(f"处理图像水印，位置参数: {position}")
        try:
            # 打开原始图像和水印图像
            img = Image.open(image_path).convert("RGBA")
            watermark = Image.open(watermark_image_path).convert("RGBA")
            
            # 计算水印大小
            width, height = img.size
            wm_width, wm_height = watermark.size
            new_wm_width = int(width * scale)
            new_wm_height = int(wm_height * new_wm_width / wm_width)
            
            # 调整水印大小
            watermark = watermark.resize((new_wm_width, new_wm_height), Image.LANCZOS)
            
            # 应用透明度
            watermark = self._adjust_opacity(watermark, opacity)
            
            # 确定水印位置
            x, y = self._calculate_position(position, width, height, new_wm_width, new_wm_height)
            
            # 创建水印层
            wm_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
            
            # 将水印粘贴到水印层
            wm_layer.paste(watermark, (x, y))
            
            # 合并水印层和原始图像
            watermarked = Image.alpha_composite(img, wm_layer)
            
            # 如果没有指定输出路径，则生成一个
            if output_path is None:
                filename = f"{uuid.uuid4()}.png"
                output_path = os.path.join(settings.PROCESSED_DIR, filename)
            
            # 保存水印图像
            watermarked.convert("RGB").save(output_path)
            
            return output_path
            
        except Exception as e:
            print(f"添加图像水印失败: {str(e)}")
            raise 
    
    def _adjust_opacity(self, image: Image.Image, opacity: float) -> Image.Image:
        """调整图像的透明度"""
        image = image.copy()
        alpha = image.split()[3]
        alpha = alpha.point(lambda x: x * opacity)
        image.putalpha(alpha)
        return image
    
    def _calculate_position(
        self, 
        position: str, 
        width: int, 
        height: int, 
        wm_width: int, 
        wm_height: int
    ) -> tuple:
        """
        计算水印位置
        
        Args:
            position: 位置标识（如"top-left", "center", "bottom-right"等）
            width: 原始图像宽度
            height: 原始图像高度
            wm_width: 水印宽度
            wm_height: 水印高度
            
        Returns:
            (x, y) 坐标
        """
        padding = 10  # 边距
        
        print(f"_calculate_position函数接收到的位置参数: {position}")
        
        if position == "top-left":
            result = (padding, padding)
        elif position == "top-center":
            result = ((width - wm_width) // 2, padding)
        elif position == "top-right":
            result = (width - wm_width - padding, padding)
        elif position == "middle-left":
            result = (padding, (height - wm_height) // 2)
        elif position == "center":
            result = ((width - wm_width) // 2, (height - wm_height) // 2)
        elif position == "middle-right":
            result = (width - wm_width - padding, (height - wm_height) // 2)
        elif position == "bottom-left":
            result = (padding, height - wm_height - padding)
        elif position == "bottom-center":
            result = ((width - wm_width) // 2, height - wm_height - padding)
        else:  # bottom-right 或默认
            result = (width - wm_width - padding, height - wm_height - padding)
        
        print(f"计算出的水印位置坐标: {result}")
        return result 