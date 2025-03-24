from fastapi import (
    APIRouter, UploadFile, File, Form, HTTPException, 
    Depends, Query
)
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
import os
import shutil
from typing import List, Optional
import uuid
import cv2
import traceback
import logging
from datetime import datetime
import numpy as np
from werkzeug.utils import secure_filename

from app.services.visible_watermark import VisibleWatermark
from app.services.invisible_watermark import InvisibleWatermark
from app.core.config import settings
from app.core.database import get_db
from app.crud.watermark import create_watermark_record
from app.schemas.watermark import WatermarkResponse
from app.models.watermark import WatermarkRecord

logger = logging.getLogger(__name__)

router = APIRouter()

# 初始化水印服务
visible_watermark = VisibleWatermark()
invisible_watermark = InvisibleWatermark()

# 确保必要的目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.PROCESSED_DIR, exist_ok=True)


async def save_upload_file(upload_file: UploadFile) -> str:
    """
    保存上传的文件到临时目录
    
    参数:
        upload_file: 上传的文件
        
    返回:
        保存的文件路径
    """
    # 确保上传目录存在
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # 检查文件是否为空
    if upload_file.filename is None or upload_file.filename == "":
        raise HTTPException(
            status_code=400,
            detail="未选择文件或文件名为空"
        )
    
    # 检查文件类型
    file_extension = os.path.splitext(upload_file.filename)[1].lower()
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp']
    
    if file_extension not in allowed_extensions:
        allowed_exts_str = ', '.join(allowed_extensions)
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {file_extension}。请上传以下格式的图片: {allowed_exts_str}"
        )
    
    # 生成唯一文件名，仅使用UUID，不包含原始文件名
    filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    try:
        # 重置文件指针
        await upload_file.seek(0)
        
        # 读取文件内容
        contents = await upload_file.read()
        
        # 检查文件是否为有效图片
        if len(contents) == 0:
            raise HTTPException(
                status_code=400,
                detail="上传的文件为空"
            )
            
        # 写入文件
        with open(file_path, "wb") as f:
            f.write(contents)
            
        # 尝试用OpenCV打开检查是否为有效图片
        test_img = cv2.imread(file_path)
        if test_img is None:
            raise HTTPException(
                status_code=400,
                detail="无法识别的图像格式或已损坏的图像文件"
            )
        
        return file_path
    
    except Exception as e:
        # 如果处理过程中出错，确保清理临时文件
        if os.path.exists(file_path):
            os.unlink(file_path)
        
        # 如果是已知的HTTPException，直接抛出
        if isinstance(e, HTTPException):
            raise e
            
        # 记录错误并抛出
        logger.error(f"保存上传文件失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"保存上传文件失败: {str(e)}"
        )


def get_file_url(file_path: str) -> str:
    """
    根据文件路径获取可访问的URL
    """
    if not file_path:
        return ""
        
    # 获取文件名
    filename = os.path.basename(file_path)
    
    # 构建绝对URL路径，使用主机的IP地址替代localhost
    base_url = settings.BASE_URL
    if base_url.endswith("/"):
        base_url = base_url[:-1]  # 移除末尾的斜杠
    
    # 返回完整的URL，包括时间戳参数以避免缓存问题
    timestamp = uuid.uuid4().hex
    
    # 确保路径正确
    if file_path.startswith(settings.PROCESSED_DIR):
        # 处理过的图像文件
        return f"/static/{filename}"
    else:
        # 其他文件 (这种情况极少用到，保留作为后备)
        return f"/images/{filename}"


@router.post("/text", response_model=WatermarkResponse)
async def add_text_watermark(
    file: UploadFile = File(...),
    text: str = Form(...),
    position: str = Form("bottom-right"),
    scale: float = Form(1.0),
    opacity: float = Form(0.5),
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user),
):
    # 确保目录存在
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
    
    try:
        # 保存上传的图像
        img_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4()}.png")
        with open(img_path, "wb") as f:
            f.write(await file.read())
        
        # 添加水印
        visible_watermark = VisibleWatermark()
        result_path = visible_watermark.add_text_watermark(
            img_path, text or "", position, opacity, scale
        )
        
        # 获取完整URL
        image_url = get_file_url(result_path)
        
        # 返回结果
        return {
            "success": True,
            "message": "成功添加文本水印",
            "image_url": image_url,
            "result_url": image_url
        }
    except Exception as e:
        logger.error(f"添加文本水印失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加文本水印失败: {str(e)}")


@router.post("/image", response_model=WatermarkResponse)
async def add_image_watermark(
    file: UploadFile = File(...),
    watermark_file: UploadFile = File(...),
    position: str = Form("bottom-right"),
    scale: float = Form(0.2),
    opacity: float = Form(0.5),
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user),
):
    # 确保目录存在
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
    
    try:
        # 保存上传的图像
        img_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4()}.png")
        with open(img_path, "wb") as f:
            f.write(await file.read())
        
        # 保存水印图像
        watermark_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4()}.png")
        with open(watermark_path, "wb") as f:
            f.write(await watermark_file.read())
        
        # 添加水印
        visible_watermark = VisibleWatermark()
        result_path = visible_watermark.add_image_watermark(
            img_path, watermark_path, position, opacity, scale
        )
        
        # 获取完整URL
        image_url = get_file_url(result_path)
        
        # 返回结果
        return {
            "success": True,
            "message": "成功添加图像水印",
            "image_url": image_url,
            "result_url": image_url
        }
    except Exception as e:
        logger.error(f"添加图像水印失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加图像水印失败: {str(e)}")


@router.post("/add_invisible_watermark", response_model=None)
async def add_invisible_watermark(
    image_file: UploadFile = File(...),
    watermark_text: str = Form(None),
    watermark_image: UploadFile = File(None),
    alpha: float = Form(0.1),
    db: Session = Depends(get_db)
):
    """
    为上传的图像添加隐式DWT水印，支持文本水印或图像水印
    
    如果同时提供了文本和图像水印，则图像水印的优先级更高
    """
    # 确保目录存在
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
    
    # 输出调试信息
    logger.info(f"水印文本: {watermark_text}")
    logger.info(f"水印图像: {watermark_image.filename if watermark_image else 'None'}")
    
    # 保存上传的图像
    image_path = None
    watermark_image_path = None
    
    try:
        # 保存上传的图像
        image_path = await save_upload_file(image_file)
        
        # 确定水印类型
        watermark_type = "text"
        
        # 如果提供了水印图像，保存水印图像并设置类型为图像水印
        if watermark_image and watermark_image.filename:
            watermark_image_path = os.path.join(settings.UPLOAD_DIR, f"watermark_{uuid.uuid4()}.png")
            with open(watermark_image_path, "wb") as f:
                shutil.copyfileobj(watermark_image.file, f)
            logger.info(f"水印图像已保存: {watermark_image_path}")
            watermark_type = "image"  # 明确标记为图像水印类型
        
        # 添加水印 - 使用DWT算法
        output_path = invisible_watermark.embed_watermark(
            image_path=image_path,
            watermark_text=watermark_text or "",
            watermark_image_path=watermark_image_path,
            alpha=alpha
        )
        
        # 获取文件URL
        result_url = get_file_url(output_path)
        
        # 保存记录到数据库
        if db:
            watermark_data = {
                "original_filename": image_file.filename,
                "processed_filename": os.path.basename(output_path),
                "watermark_type": "dwt",
                "watermark_text": watermark_text if watermark_type == "text" else "图像水印",
                "alpha": alpha,
                "processed_url": result_url,
                "user_id": None,
                "is_public": True
            }
            # 创建水印记录
            create_watermark_record(db, watermark_data)
        
        return {
            "success": True,
            "message": "DWT水印添加成功",
            "image_url": result_url
        }
    except Exception as e:
        logger.error(f"添加DWT水印失败: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"添加水印失败: {str(e)}")
    finally:
        # 清理临时文件
        if image_path and os.path.exists(image_path):
            try:
                os.unlink(image_path)
            except:
                pass


@router.post("/extract_invisible_watermark")
async def extract_invisible_watermark(
    image: UploadFile = File(...),
    algorithm: str = Query("dwt", description="水印算法类型")
):
    """
    从图像中提取隐式水印
    """
    try:
        # 保存上传的图像
        filename = f"{uuid.uuid4()}_{image.filename}"
        # 确保文件名只包含ASCII字符
        safe_filename = "".join(c for c in filename if ord(c) < 128)
        image_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
        
        with open(image_path, "wb") as f:
            shutil.copyfileobj(image.file, f)
        
        logger.info(f"图像已保存: {image_path}")
        
        # 使用DWT算法提取水印
        result = invisible_watermark.extract_watermark(image_path)
        logger.info(f"提取结果: {result}")
        
        # 检查是否检测到水印
        if result["success"]:
            if result["detected"]:
                # 记录检测到的水印类型
                watermark_type = result.get("watermark_type", "unknown")
                logger.info(f"检测到水印类型: {watermark_type}")
                
                # 如果是图像水印，检查图像URL是否有效
                if watermark_type == "image":
                    watermark_image_url = result.get("watermark_image_url", "")
                    logger.info(f"图像水印URL: {watermark_image_url}")
                    
                    # 如果未检测到水印或URL为空，直接返回未检测到水印
                    if not result.get("detected", False) or not watermark_image_url:
                        logger.warning("未检测到有效的隐式水印")
                        return {
                            "success": True,
                            "detected": False,
                            "message": "未检测到有效的隐式水印",
                            "watermark_text": "",
                            "watermark_type": None,
                            "watermark_image_url": None,
                            "confidence": 0
                        }
                    
                    # 从元数据中获取备份水印URL
                    backup_url = result.get("backup_image_url", "")
                    
                    # 直接复制备份水印文件到静态目录并使用它，不再检查原始水印是否存在
                    if "original_watermark_" in watermark_image_url:
                        uuid_part = watermark_image_url.split("original_watermark_")[1].split(".")[0]
                        backup_filename = f"backup_watermark_{uuid_part}.png"
                        backup_url = f"/static/{backup_filename}"
                        
                        # 检查处理目录中是否有备份
                        backup_path = os.path.join(settings.PROCESSED_DIR, backup_filename)
                        if os.path.exists(backup_path):
                            logger.info(f"找到处理目录中的备份水印: {backup_path}")
                            
                            # 复制到静态目录
                            static_backup_path = os.path.join(settings.STATIC_DIR, backup_filename)
                            os.makedirs(os.path.dirname(static_backup_path), exist_ok=True)
                            shutil.copy2(backup_path, static_backup_path)
                            logger.info(f"已将备份水印复制到静态目录: {static_backup_path}")
                            
                            # 使用备份水印URL
                            return {
                                "success": True,
                                "detected": True,
                                "message": "成功提取到图像水印",
                                "watermark_text": "",
                                "watermark_type": "image",
                                "watermark_image_url": backup_url,  # 直接使用备份URL
                                "confidence": result.get("confidence", 0.95)
                            }
                        else:
                            logger.error(f"备份水印不存在: {backup_path}")
                            
                            # 尝试从原始filename中生成备份文件名并查找
                            original_filename = watermark_image_url.replace("/static/", "")
                            for backup_file in os.listdir(settings.PROCESSED_DIR):
                                if backup_file.startswith("backup_watermark_") and backup_file.endswith(".png"):
                                    logger.info(f"找到备份候选: {backup_file}")
                                    # 复制到静态目录
                                    static_backup_path = os.path.join(settings.STATIC_DIR, backup_file)
                                    backup_path = os.path.join(settings.PROCESSED_DIR, backup_file)
                                    os.makedirs(os.path.dirname(static_backup_path), exist_ok=True)
                                    shutil.copy2(backup_path, static_backup_path)
                                    logger.info(f"已将最新的备份水印复制到静态目录: {static_backup_path}")
                                    
                                    # 返回这个备份
                                    return {
                                        "success": True,
                                        "detected": True,
                                        "message": "成功恢复备份图像水印",
                                        "watermark_text": "",
                                        "watermark_type": "image",
                                        "watermark_image_url": f"/static/{backup_file}",
                                        "confidence": 0.90
                                    }
                                    break
                    
                    # 如果流程到这里还没有返回，说明没有找到任何可用的水印图像
                    logger.error("无法找到任何可用的水印图像文件")
                
                # 如果是文本水印但文本为空，可能是隐藏的图像水印
                elif watermark_type == "text" and not result.get("watermark_text"):
                    logger.warning("检测到文本水印但内容为空，尝试提取图像水印")
                    
                    # 尝试直接从图像中提取水印图像
                    try:
                        # 创建一个新的图像水印提取结果
                        img_result = invisible_watermark.extract_watermark_image(image_path)
                        
                        # 检查提取的图像结果
                        if img_result and img_result.get("success") and img_result.get("detected") and img_result.get("watermark_image_url"):
                            logger.info(f"成功提取到隐藏的图像水印: {img_result['watermark_image_url']}")
                            img_filename = img_result['watermark_image_url'].replace("/static/", "")
                            img_path = os.path.join(settings.STATIC_DIR, img_filename)
                            logger.info(f"检查提取的图像水印文件: {img_path}")
                            
                            if os.path.exists(img_path):
                                logger.info("图像水印文件存在，返回提取结果")
                                return {
                                    "success": True,
                                    "detected": True,
                                    "message": "成功提取到隐藏的图像水印",
                                    "watermark_text": "",
                                    "watermark_type": "image",
                                    "watermark_image_url": img_result["watermark_image_url"],
                                    "confidence": img_result.get("confidence", 0.8)
                                }
                        else:
                            logger.warning("提取图像水印失败，可能不包含有效水印")
                    except Exception as e:
                        logger.error(f"尝试提取图像水印失败: {str(e)}\n{traceback.format_exc()}")
                    
                    # 如果无法提取图像水印，返回原始结果
                    return {
                        "success": True,
                        "detected": True,
                        "message": "提取到空文本水印",
                        "watermark_text": "",
                        "watermark_type": "text",
                        "watermark_image_url": None,
                        "confidence": result.get("confidence", 0.8)
                    }
            
            # 记录最终返回结果
            logger.info(f"返回提取结果: {result}")
        
        # 删除临时文件
        try:
            os.remove(image_path)
        except Exception as e:
            logger.error(f"删除临时文件失败: {str(e)}")
        
        return result
    except Exception as e:
        logger.error(f"提取水印失败: {str(e)}\n{traceback.format_exc()}")
        return {
            "success": False,
            "message": f"提取水印失败: {str(e)}"
        }


@router.get("/static/{filename}")
async def get_static_file(filename: str):
    """
    获取静态处理后的图像文件
    """
    # 规范化路径并移除潜在的URL参数
    clean_filename = filename.split("?")[0]
    logger.info(f"尝试获取静态文件: {clean_filename}")
    
    # 首先尝试在STATIC_DIR中查找文件
    file_path = os.path.join(settings.STATIC_DIR, clean_filename)
    logger.info(f"检查STATIC_DIR路径: {file_path}")
    logger.info(f"该文件存在?: {os.path.exists(file_path)}")
    
    # 如果文件不存在STATIC_DIR中，尝试在PROCESSED_DIR中查找
    if not os.path.exists(file_path):
        file_path = os.path.join(settings.PROCESSED_DIR, clean_filename)
        logger.info(f"检查PROCESSED_DIR路径: {file_path}")
        logger.info(f"该文件存在?: {os.path.exists(file_path)}")
    
    # 如果是请求原始水印文件，直接尝试查找备份文件
    if not os.path.exists(file_path) and "original_watermark_" in clean_filename:
        # 尝试从文件名中提取UUID
        try:
            uuid_part = clean_filename.replace("original_watermark_", "").split(".")[0]
            backup_filename = f"backup_watermark_{uuid_part}.png"
            logger.info(f"尝试使用备份水印文件: {backup_filename}")
            
            # 先检查静态目录中的备份
            backup_path = os.path.join(settings.STATIC_DIR, backup_filename)
            if os.path.exists(backup_path):
                logger.info(f"找到静态目录中的备份水印文件: {backup_path}")
                file_path = backup_path
            else:
                # 再检查处理目录中的备份
                backup_path = os.path.join(settings.PROCESSED_DIR, backup_filename)
                if os.path.exists(backup_path):
                    logger.info(f"找到处理目录中的备份水印文件: {backup_path}")
                    # 复制到静态目录
                    static_backup_path = os.path.join(settings.STATIC_DIR, backup_filename)
                    os.makedirs(os.path.dirname(static_backup_path), exist_ok=True)
                    shutil.copy2(backup_path, static_backup_path)
                    logger.info(f"已将备份水印复制到静态目录: {static_backup_path}")
                    file_path = static_backup_path
        except Exception as e:
            logger.error(f"尝试查找备份水印文件时出错: {str(e)}")
    
    # 如果文件仍然不存在，直接返回404错误
    if not os.path.exists(file_path):
        logger.error(f"文件不存在: {clean_filename}，已尝试路径: {file_path}")
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 设置响应头，防止缓存
    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    
    # 获取文件扩展名
    file_ext = os.path.splitext(clean_filename)[1].lower()
    
    # 根据扩展名设置相应的媒体类型
    media_type = "image/png"  # 默认PNG
    if file_ext == '.jpg' or file_ext == '.jpeg':
        media_type = "image/jpeg"
    elif file_ext == '.gif':
        media_type = "image/gif"
    elif file_ext == '.bmp':
        media_type = "image/bmp"
    elif file_ext == '.webp':
        media_type = "image/webp"
    
    # 返回文件响应
    return FileResponse(
        file_path,
        media_type=media_type,
        headers=headers
    )


@router.get("/images/{filename}")
async def get_image(filename: str):
    """
    获取上传的原始图像
    """
    # 构建文件路径
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    # 检查文件是否存在，如果不存在则返回404
    if not os.path.exists(file_path):
        logger.error(f"文件不存在: {file_path}")
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 设置响应头，防止缓存
    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    
    # 检查文件扩展名
    file_ext = os.path.splitext(filename)[1].lower()
    
    # 根据扩展名设置相应的媒体类型
    media_type = "image/jpeg"  # 默认JPEG
    if file_ext == '.png':
        media_type = "image/png"
    elif file_ext == '.gif':
        media_type = "image/gif"
    elif file_ext == '.bmp':
        media_type = "image/bmp"
    elif file_ext == '.webp':
        media_type = "image/webp"
    
    # 返回文件响应
    return FileResponse(
        file_path,
        media_type=media_type,
        headers=headers
    )


@router.post("/add-dct-watermark")
async def add_dct_watermark(
    image: UploadFile = File(...),
    text: str = Form(...),
    alpha: float = Form(0.1),
    db: Session = Depends(get_db)
):
    """
    为上传的图像添加DCT隐式水印
    """
    # 验证图像类型
    if image.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="不支持的图像类型")
    
    # 保存上传的图像
    image_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4()}_{image.filename}")
    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    try:
        # 添加DCT水印
        output_path = invisible_watermark.embed_dct_watermark(
            image_path=image_path,
            watermark_text=text or "",
            alpha=alpha
        )
        
        # 生成访问URL
        filename = os.path.basename(output_path)
        url = f"/static/{filename}"
        
        # 保存记录到数据库
        if db:
            watermark_data = {
                "original_filename": image.filename,
                "processed_filename": filename,
                "watermark_type": "dct",
                "watermark_text": text,
                "alpha": alpha,
                "processed_url": url,
                "user_id": None,
                "is_public": True
            }
            create_watermark_record(db, watermark_data)
        
        return {
            "success": True,
            "message": "DCT水印添加成功",
            "data": {
                "url": url,
                "watermark_type": "dct",
                "text": text,
                "alpha": alpha
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"水印处理失败: {str(e)}")
    finally:
        # 清理上传的原始图像
        if os.path.exists(image_path):
            os.unlink(image_path)


@router.post("/add-dwt-watermark")
async def add_dwt_watermark(
    image: UploadFile = File(...),
    text: str = Form(...),
    alpha: float = Form(0.1)
):
    """
    该API已弃用，现在使用DCT算法
    """
    # 返回弃用信息
    return {
        "success": false,
        "message": "该API已弃用，请使用add-dct-watermark",
    }

@router.post("/add-lsb-watermark")
async def add_lsb_watermark(
    image: UploadFile = File(...),
    text: str = Form(...)
):
    """
    该API已弃用，现在使用DCT算法
    """
    # 返回弃用信息 
    return {
        "success": false,
        "message": "该API已弃用，请使用add-dct-watermark",
    }

@router.post("/extract-watermark")
async def extract_watermark(
    image: UploadFile = File(...),
    watermark_type: str = Form(...)
):
    """
    从图像中提取隐式水印
    """
    # 验证图像类型
    if image.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="不支持的图像类型")
    
    # 保存上传的图像
    image_filename = f"{uuid.uuid4()}_{image.filename}"
    image_path = os.path.join(settings.UPLOAD_DIR, image_filename)
    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    try:
        # 提取水印，只使用DCT算法
        result = invisible_watermark.extract_dct_watermark(image_path)
        
        if result.get("success", False):
            if result.get("detected", False):
                # 检测到水印
                return {
                    "success": True,
                    "message": "水印提取成功",
                    "data": {
                        "watermark_type": "dct",
                        "watermark_text": result.get("watermark_text", ""),
                        "confidence": result.get("confidence", 0)
                    }
                }
            else:
                # 未检测到水印
                return {
                    "success": True,
                    "message": "未检测到水印",
                    "data": {
                        "watermark_type": "dct",
                        "watermark_text": "",
                        "confidence": 0
                    }
                }
        else:
            # 提取失败
            return {
                "success": False,
                "message": result.get("message", "水印提取失败")
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"水印处理失败: {str(e)}")
    finally:
        # 清理上传的原始图像
        if os.path.exists(image_path):
            os.unlink(image_path)


@router.post("/auto_detect_watermark", response_model=None)
async def auto_detect_watermark(
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    自动检测图像中的水印
    """
    # 使用extract_invisible_watermark路由的功能
    return await extract_invisible_watermark(image, "dwt", db)


@router.post("/batch-process")
async def batch_process(
    images: List[UploadFile] = File(...),
    watermark_type: str = Form(...),
    text: Optional[str] = Form(None),
    position: Optional[str] = Form(settings.DEFAULT_WATERMARK_POSITION),
    opacity: Optional[float] = Form(settings.DEFAULT_WATERMARK_OPACITY),
    alpha: Optional[float] = Form(0.1)
):
    """
    批量处理多张图像添加水印
    """
    if not images:
        raise HTTPException(status_code=400, detail="未提供图像文件")
    
    results = []
    
    for image in images:
        # 验证图像类型
        if image.content_type not in settings.ALLOWED_IMAGE_TYPES:
            continue
        
        # 保存上传的图像
        image_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4()}_{image.filename}")
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        
        try:
            output_path = ""
            
            # 根据水印类型处理
            if watermark_type == "text":
                output_path = visible_watermark.add_text_watermark(
                    image_path=image_path,
                    text=text or "",
                    position=position,
                    opacity=opacity
                )
            elif watermark_type == "dct":
                output_path = invisible_watermark.embed_dct_watermark(
                    image_path=image_path,
                    watermark_text=text or "",
                    alpha=alpha
                )
            elif watermark_type == "dwt":
                output_path = invisible_watermark.embed_dwt_watermark(
                    image_path=image_path,
                    watermark_text=text or "",
                    alpha=alpha
                )
            elif watermark_type == "lsb":
                output_path = invisible_watermark.embed_lsb_watermark(
                    image_path=image_path,
                    watermark_text=text or ""
                )
            else:
                raise HTTPException(status_code=400, detail="不支持的水印类型")
            
            # 获取完整URL
            image_url = get_file_url(output_path)
            
            results.append({
                "filename": image.filename,
                "url": image_url,
                "success": True
            })
            
        except Exception as e:
            results.append({
                "filename": image.filename,
                "success": False,
                "error": str(e)
            })
        finally:
            # 清理上传的原始图像
            if os.path.exists(image_path):
                os.unlink(image_path)
    
    return {
        "success": True,
        "message": f"批量处理完成，共处理{len(images)}张图像",
        "data": results
    } 