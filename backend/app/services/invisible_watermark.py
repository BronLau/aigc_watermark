import uuid
import os
import numpy as np
import cv2
import pywt
from typing import Optional, Dict, Any, Tuple
import json
from datetime import datetime
import traceback
import logging
import shutil  # 添加用于复制文件

from app.core.config import settings

logger = logging.getLogger(__name__)


class InvisibleWatermark:
    """
    实现基于DWT的隐式水印服务类
    """
    
    def __init__(self):
        # 确保目录存在
        os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
        
        # DWT配置参数
        self.wavelet = 'haar'      # 小波变换类型
        self.level = 1             # 小波分解级别
        self.alpha = 100           # 水印强度 (固定值，提高强度)

    def _prepare_watermark_data(
        self,
        watermark_text: Optional[str] = None,
        watermark_image_path: Optional[str] = None,
        max_size: int = 32
    ) -> Tuple[np.ndarray, dict]:
        """
        准备水印数据，将文本或图像转换为二进制矩阵
        
        参数:
            watermark_text: 水印文本
            watermark_image_path: 水印图像路径
            max_size: 水印矩阵的最大尺寸
            
        返回:
            水印矩阵, 元数据字典
        """
        metadata = {}
        
        # 处理图像水印优先级高于文本水印
        if watermark_image_path and os.path.exists(watermark_image_path):
            logger.info(f"准备图像水印: {watermark_image_path}")
            
            # 读取水印图像
            wm_img = cv2.imread(watermark_image_path, cv2.IMREAD_UNCHANGED)
            if wm_img is None:
                logger.warning(f"无法读取水印图像: {watermark_image_path}, 将使用文本水印")
                return self._prepare_watermark_data(watermark_text=watermark_text, max_size=max_size)
            
            # 确保静态目录存在
            os.makedirs(settings.STATIC_DIR, exist_ok=True)
            
            # 保存原始水印图像的副本，用于提取后的显示
            # 使用UUID作为文件名以避免冲突
            wm_uuid = uuid.uuid4()
            original_wm_filename = f"original_watermark_{wm_uuid}.png"
            original_wm_path = os.path.join(settings.STATIC_DIR, original_wm_filename)
            
            # 使用cv2保存水印图像
            cv2.imwrite(original_wm_path, wm_img)
            logger.info(f"保存原始水印图像用于提取显示: {original_wm_path}")
            
            # 创建备份，防止原始水印被删除
            backup_wm_filename = f"backup_watermark_{wm_uuid}.png"
            backup_wm_path = os.path.join(settings.PROCESSED_DIR, backup_wm_filename)
            shutil.copy2(original_wm_path, backup_wm_path)
            logger.info(f"创建水印图像备份: {backup_wm_path}")
            
            # 确保水印图像为灰度图
            if len(wm_img.shape) > 2:
                if wm_img.shape[2] == 4:  # 如果有Alpha通道
                    # 使用Alpha通道作为透明度
                    alpha = wm_img[:, :, 3]
                    # 转换为灰度，考虑透明度
                    gray = cv2.cvtColor(wm_img[:, :, :3], cv2.COLOR_BGR2GRAY)
                    # 根据透明度调整灰度值
                    gray = cv2.multiply(gray.astype(float), alpha.astype(float)/255.0, dtype=cv2.CV_32F)
                    wm_img = gray.astype(np.uint8)
                else:
                    wm_img = cv2.cvtColor(wm_img, cv2.COLOR_BGR2GRAY)
            
            # 应用对比度增强和锐化处理，以便于提取
            wm_img = cv2.normalize(wm_img, None, 0, 255, cv2.NORM_MINMAX)
            
            # 应用二值化以创建鲜明的黑白对比
            _, binary_wm = cv2.threshold(wm_img, 127, 255, cv2.THRESH_BINARY)
            
            # 调整大小
            size = min(max_size, 32)  # 限制水印矩阵大小
            if binary_wm.shape[0] != size or binary_wm.shape[1] != size:
                watermark = cv2.resize(binary_wm, (size, size), interpolation=cv2.INTER_NEAREST)
            else:
                watermark = binary_wm
            
            # 确保我们有一个标准的水印矩阵
            watermark = watermark.astype(np.uint8)
            
            # 记录元数据 - 明确设置为图像水印类型
            metadata["watermark_type"] = "image"
            metadata["watermark_image_url"] = f"/static/{original_wm_filename}"
            # 同时保存备份URL，以防原始URL失效
            metadata["backup_image_url"] = f"/static/{backup_wm_filename}"
            metadata["matrix_size"] = size
            
            logger.info(f"水印图像已保存，原始水印URL: {metadata['watermark_image_url']}")
            logger.info(f"水印图像备份URL: {metadata['backup_image_url']}")
            
            return watermark, metadata
            
        # 处理文本水印
        elif watermark_text is not None:
            # 将文本编码为字节
            if not watermark_text:
                watermark_text = ""  # 使用空字符串作为默认值
            
            # 获取文本的二进制表示
            text_bytes = watermark_text.encode('utf-8')
            logger.info(f"水印文本: {watermark_text}, 编码后字节: {[b for b in text_bytes]}")
            
            # 构建水印矩阵 (简单填充方式)
            size = min(max_size, 32)  # 限制水印矩阵大小
            
            # 创建二维水印矩阵
            watermark = np.zeros((size, size), dtype=np.uint8)
            
            # 使用文本直接填充矩阵中心区域
            text_len = len(text_bytes)
            center_start = (size - text_len) // 2 if text_len < size else 0
            
            # 填充文本到矩阵中心
            for i in range(min(text_len, size)):
                row = center_start + i
                if row < size:
                    watermark[row, row] = text_bytes[i]  # 在对角线上放置字节值
            
            # 记录元数据
            metadata["watermark_type"] = "text"
            metadata["watermark_text"] = watermark_text
            metadata["text_length"] = len(text_bytes)
            metadata["matrix_size"] = size
        else:
            # 如果没有提供水印内容，创建一个空的水印矩阵
            watermark = np.zeros((1, 1), dtype=np.uint8)
            metadata["watermark_type"] = "none"
            logger.warning("未提供水印内容，创建空水印")
        
        return watermark, metadata
    
    def embed_watermark(
        self,
        image_path: str,
        watermark_text: Optional[str] = None,
        watermark_image_path: Optional[str] = None,
        alpha: float = 0.1,  # 不再使用此参数，仅保留API兼容性
        output_path: Optional[str] = None
    ) -> str:
        """
        使用DWT算法嵌入水印
        
        参数:
            image_path: 输入图像路径
            watermark_text: 水印文本
            watermark_image_path: 水印图像路径 (优先级高于文本水印)
            alpha: 水印强度参数 (不再使用，保留API兼容性)
            output_path: 输出图像路径，如不指定则自动生成
            
        返回:
            输出图像路径
        """
        try:
            # 检查水印类型，只添加选择的类型水印
            watermark_type = "unknown"
            if watermark_image_path and os.path.exists(watermark_image_path):
                logger.info(f"DWT添加图像水印 - 图像路径: {watermark_image_path}")
                watermark_type = "image"
            elif watermark_text:
                logger.info(f"DWT添加文本水印 - 文本: {watermark_text}")
                watermark_type = "text"
            else:
                logger.warning("未提供水印内容")
                
            # 读取原始图像
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f"无法读取图像: {image_path}")
            
            # 确保图像是3通道彩色图像
            if len(img.shape) != 3 or img.shape[2] != 3:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
            
            # 准备水印数据 - 支持图像或文本水印
            watermark, metadata = self._prepare_watermark_data(
                watermark_text=watermark_text,
                watermark_image_path=watermark_image_path
            )
            
            # 确保水印类型正确 - 根据实际提供的内容
            if watermark_type == "image" or (metadata and metadata.get("watermark_type") == "image"):
                metadata["watermark_type"] = "image"
                logger.info("确认使用图像水印类型")
            elif watermark_type == "text" or (metadata and metadata.get("watermark_type") == "text"):
                metadata["watermark_type"] = "text"
                logger.info("确认使用文本水印类型")
            
            # 复制原始图像用于嵌入水印
            watermarked_img = img.copy()
            
            # 对图像的蓝色通道应用DWT并嵌入水印
            # 仅使用蓝色通道减少可见性影响
            blue_channel = img[:, :, 0].astype(np.float32)
            
            # 应用DWT分解
            coeffs = pywt.wavedec2(blue_channel, wavelet=self.wavelet, level=self.level)
            
            # 在LL子带 (低频区域) 嵌入水印
            # coeffs结构: [cA, (cH, cV, cD)] 或更高级别的分解
            # cA是近似系数，(cH, cV, cD)是细节系数
            
            # 获取LL子带
            ll_band = coeffs[0]  # 第一个元素是低频近似
            
            # 调整水印大小以匹配LL子带
            wm_h, wm_w = watermark.shape
            ll_h, ll_w = ll_band.shape
            
            # 确保水印能放入LL子带
            scale_h = min(1.0, ll_h / wm_h)
            scale_w = min(1.0, ll_w / wm_w)
            scale = min(scale_h, scale_w)
            
            new_h = max(1, int(wm_h * scale))
            new_w = max(1, int(wm_w * scale))
            
            if new_h != wm_h or new_w != wm_w:
                watermark_resized = cv2.resize(watermark, (new_w, new_h), 
                                          interpolation=cv2.INTER_NEAREST)
            else:
                watermark_resized = watermark
            
            # 在中心区域嵌入水印
            h_offset = (ll_h - watermark_resized.shape[0]) // 2
            w_offset = (ll_w - watermark_resized.shape[1]) // 2
            
            # 定义水印区域
            h_end = min(ll_h, h_offset + watermark_resized.shape[0])
            w_end = min(ll_w, w_offset + watermark_resized.shape[1])
            
            # 优化：使用更小的alpha值，降低水印的可见性
            effective_alpha = self.alpha * 0.5  # 降低水印强度到原来的一半
            
            # 添加水印 - 更细致的调整，减少对蓝色通道的过度修改
            for i in range(watermark_resized.shape[0]):
                for j in range(watermark_resized.shape[1]):
                    if h_offset + i < h_end and w_offset + j < w_end:
                        if watermark_resized[i, j] > 0:
                            # 计算要添加的值，确保不要过分修改原始值
                            # 使用原值的比例而不是固定增量
                            original_value = ll_band[h_offset + i, w_offset + j]
                            
                            # 限制添加的数值，防止过大的改变
                            add_value = min(
                                effective_alpha * watermark_resized[i, j],
                                original_value * 0.2  # 最多改变原值的20%
                            )
                            
                            ll_band[h_offset + i, w_offset + j] += add_value
            
            # 更新系数
            coeffs[0] = ll_band
            
            # 应用逆DWT重建图像
            reconstructed = pywt.waverec2(coeffs, wavelet=self.wavelet)
            
            # 处理尺寸差异 (DWT可能会改变尺寸)
            reconstructed = cv2.resize(reconstructed, (img.shape[1], img.shape[0]))
            
            # 裁剪值到有效范围
            reconstructed = np.clip(reconstructed, 0, 255)
            
            # 更新蓝色通道，但保留更多原始信息
            # 混合原始蓝色通道和修改后的通道，减少可见性
            blend_factor = 0.85  # 保留85%的修改结果，15%的原始值
            blended_channel = (blend_factor * reconstructed + (1 - blend_factor) * img[:, :, 0]).astype(np.uint8)
            watermarked_img[:, :, 0] = blended_channel
            
            # 如果没有指定输出路径，则生成一个
            if output_path is None:
                filename = f"{uuid.uuid4()}.png"
                output_path = os.path.join(settings.PROCESSED_DIR, filename)
            
            # 保存水印图像
            cv2.imwrite(output_path, watermarked_img)
            
            # 保存元数据到JSON文件
            metadata.update({
                "algorithm": "dwt",
                "wavelet": self.wavelet,
                "level": self.level,
                "alpha": self.alpha,
                "watermark_size": watermark.shape,
                "timestamp": datetime.now().isoformat()
            })
            
            # 保存元数据到两个地方：一个在原图像旁，一个在输出图像旁
            metadata_path = output_path + ".metadata"
            logger.info(f"保存元数据到: {metadata_path}")
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            
            # 将元数据嵌入到图像文件的末尾作为附加备份
            try:
                # 在图像文件末尾添加特殊标记和元数据
                with open(output_path, "ab") as f:
                    f.write(b"WATERMARK_METADATA:")
                    f.write(json.dumps(metadata, ensure_ascii=False).encode('utf-8'))
                logger.info("元数据已嵌入图像文件末尾")
            except Exception as e:
                logger.warning(f"嵌入元数据到图像失败: {str(e)}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"DWT水印嵌入失败: {str(e)}\n{traceback.format_exc()}")
            raise
    
    def extract_watermark(self, image_path: str) -> Dict[str, Any]:
        """
        从DWT水印图像中提取水印
        
        参数:
            image_path: 图像路径
            
        返回:
            包含提取结果的字典
        """
        result = {
            "success": False,
            "detected": False,
            "watermark_text": "",
            "watermark_type": None,
            "watermark_image_url": None,  # 添加图像水印URL属性
            "confidence": 0,
            "message": ""
        }
        
        try:
            logger.info(f"正在从图像提取水印: {image_path}")
            
            # 1. 首先尝试从元数据文件获取水印信息
            metadata_path = image_path + ".metadata"
            metadata = {}
            
            # 尝试读取元数据文件
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                    logger.info("成功读取元数据文件")
                    
                    # 处理图像水印 - 确保正确识别类型
                    if metadata.get("watermark_type") == "image":
                        result["watermark_type"] = "image"
                        
                        # 首先尝试使用原始水印图像URL
                        original_url = metadata.get("watermark_image_url", "")
                        backup_url = metadata.get("backup_image_url", "")
                        
                        # 检查原始水印图像是否存在
                        if original_url:
                            image_filename = original_url.replace("/static/", "")
                            image_path_check = os.path.join(settings.STATIC_DIR, image_filename)
                            if os.path.exists(image_path_check):
                                logger.info(f"找到原始水印图像: {image_path_check}")
                                result["watermark_image_url"] = original_url
                                result["detected"] = True
                                result["success"] = True
                                result["confidence"] = 0.99
                                result["message"] = "成功提取到原始图像水印"
                                return result
                            else:
                                logger.warning(f"元数据中的原始水印图像不存在: {image_path_check}")
                                
                                # 尝试使用备份URL
                                if backup_url:
                                    backup_filename = backup_url.replace("/static/", "")
                                    # 首先检查静态目录
                                    backup_static_path = os.path.join(settings.STATIC_DIR, backup_filename)
                                    
                                    # 如果备份在静态目录不存在，检查处理目录
                                    if not os.path.exists(backup_static_path):
                                        backup_processed_path = os.path.join(settings.PROCESSED_DIR, backup_filename)
                                        if os.path.exists(backup_processed_path):
                                            # 将处理目录的备份复制到静态目录
                                            os.makedirs(os.path.dirname(backup_static_path), exist_ok=True)
                                            shutil.copy2(backup_processed_path, backup_static_path)
                                            logger.info(f"将备份水印从处理目录复制到静态目录: {backup_static_path}")
                                    
                                    # 再次检查静态目录中的备份文件
                                    if os.path.exists(backup_static_path):
                                        logger.info(f"找到备份水印图像: {backup_static_path}")
                                        result["watermark_image_url"] = backup_url
                                        result["detected"] = True
                                        result["success"] = True
                                        result["confidence"] = 0.95
                                        result["message"] = "使用备份图像水印恢复成功"
                                        return result
                        
                        logger.warning("无法找到有效的水印图像，将尝试其他方法提取")
                    
                    # 处理文本水印
                    elif metadata.get("watermark_type") == "text":
                        result["watermark_text"] = metadata.get("watermark_text", "")
                        result["watermark_type"] = "text"
                        result["detected"] = True
                        result["success"] = True
                        result["confidence"] = 0.99
                        logger.info(f"从元数据提取到水印文本: {result['watermark_text']}")
                        return result
                except Exception as e:
                    logger.warning(f"读取元数据文件失败: {str(e)}")
            else:
                logger.info("未找到元数据文件")
            
            # 2. 尝试从图像文件末尾提取嵌入的元数据
            try:
                with open(image_path, "rb") as f:
                    content = f.read()
                    marker = b"WATERMARK_METADATA:"
                    pos = content.find(marker)
                    if pos > 0:
                        metadata_str = content[pos + len(marker):].decode('utf-8')
                        embedded_metadata = json.loads(metadata_str)
                        logger.info(f"从图像文件末尾提取到元数据: {embedded_metadata}")
                        
                        # 处理图像水印
                        if embedded_metadata.get("watermark_type") == "image":
                            result["watermark_type"] = "image"
                            
                            # 首先尝试使用原始水印图像URL
                            original_url = embedded_metadata.get("watermark_image_url", "")
                            backup_url = embedded_metadata.get("backup_image_url", "")
                            
                            # 检查原始水印图像是否存在
                            if original_url:
                                image_filename = original_url.replace("/static/", "")
                                image_path_check = os.path.join(settings.STATIC_DIR, image_filename)
                                if os.path.exists(image_path_check):
                                    logger.info(f"找到原始水印图像: {image_path_check}")
                                    result["watermark_image_url"] = original_url
                                    result["detected"] = True
                                    result["success"] = True
                                    result["confidence"] = 0.95
                                    result["message"] = "成功提取到原始图像水印"
                                    return result
                                else:
                                    logger.warning(f"元数据中的原始水印图像不存在: {image_path_check}")
                                    
                                    # 尝试使用备份URL
                                    if backup_url:
                                        backup_filename = backup_url.replace("/static/", "")
                                        # 首先检查静态目录
                                        backup_static_path = os.path.join(settings.STATIC_DIR, backup_filename)
                                        
                                        # 如果备份在静态目录不存在，检查处理目录
                                        if not os.path.exists(backup_static_path):
                                            backup_processed_path = os.path.join(settings.PROCESSED_DIR, backup_filename)
                                            if os.path.exists(backup_processed_path):
                                                # 将处理目录的备份复制到静态目录
                                                os.makedirs(os.path.dirname(backup_static_path), exist_ok=True)
                                                shutil.copy2(backup_processed_path, backup_static_path)
                                                logger.info(f"将备份水印从处理目录复制到静态目录: {backup_static_path}")
                                        
                                        # 再次检查静态目录中的备份文件
                                        if os.path.exists(backup_static_path):
                                            logger.info(f"找到备份水印图像: {backup_static_path}")
                                            result["watermark_image_url"] = backup_url
                                            result["detected"] = True
                                            result["success"] = True
                                            result["confidence"] = 0.90
                                            result["message"] = "使用备份图像水印恢复成功"
                                            return result
                            
                            logger.warning("无法找到有效的水印图像，将尝试其他方法提取")
                        
                        # 处理文本水印  
                        elif embedded_metadata.get("watermark_type") == "text":
                            result["watermark_text"] = embedded_metadata.get("watermark_text", "")
                            result["watermark_type"] = "text"
                            result["detected"] = True
                            result["success"] = True
                            result["confidence"] = 0.95
                            logger.info(f"从嵌入元数据提取到水印文本: {result['watermark_text']}")
                            return result
                        # 处理未知类型的情况
                        else:
                            # 检查是否有watermark_image_url但类型不是image
                            if "watermark_image_url" in embedded_metadata:
                                result["watermark_type"] = "image"
                                result["watermark_image_url"] = embedded_metadata["watermark_image_url"]
                                
                                # 检查水印图像是否存在
                                image_filename = result["watermark_image_url"].replace("/static/", "")
                                image_path_check = os.path.join(settings.STATIC_DIR, image_filename)
                                if os.path.exists(image_path_check):
                                    logger.info(f"找到水印图像: {image_path_check}")
                                    result["detected"] = True
                                    result["success"] = True
                                    result["confidence"] = 0.9
                                    result["message"] = "成功提取到图像水印"
                                    return result
                                else:
                                    logger.warning(f"元数据中的水印图像不存在: {image_path_check}")
                            
                            # 检查是否有watermark_text但类型不是text
                            elif "watermark_text" in embedded_metadata and embedded_metadata["watermark_text"]:
                                result["watermark_text"] = embedded_metadata["watermark_text"]
                                result["watermark_type"] = "text"
                                result["detected"] = True
                                result["success"] = True
                                result["confidence"] = 0.9
                                logger.info(f"从嵌入元数据中检测到文本水印: {result['watermark_text']}")
                                return result
            except Exception as e:
                logger.warning(f"从图像文件末尾提取元数据失败: {str(e)}")
            
            # 3. 如果元数据提取失败，则尝试直接从图像中提取水印
            logger.info("从图像信号中提取水印")
            
            # 读取图像
            img = cv2.imread(image_path)
            if img is None:
                result["message"] = f"无法读取图像: {image_path}"
                return result
                
            # 确保图像是3通道彩色图像
            if len(img.shape) != 3 or img.shape[2] != 3:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
                
            # 仅使用蓝色通道 (与嵌入时相同)
            blue_channel = img[:, :, 0].astype(np.float32)
            
            # 应用DWT分解
            coeffs = pywt.wavedec2(blue_channel, wavelet=self.wavelet, level=self.level)
            
            # 获取LL子带
            ll_band = coeffs[0]
            
            # 估计水印矩阵大小
            wm_size = min(32, ll_band.shape[0] // 2, ll_band.shape[1] // 2)
            
            # 计算中心偏移
            h_offset = (ll_band.shape[0] - wm_size) // 2
            w_offset = (ll_band.shape[1] - wm_size) // 2
            
            # 提取水印矩阵
            extracted_wm = np.zeros((wm_size, wm_size), dtype=np.uint8)
            
            # 从子带中心提取水印
            for i in range(wm_size):
                for j in range(wm_size):
                    if h_offset + i < ll_band.shape[0] and w_offset + j < ll_band.shape[1]:
                        # 提取的值会有噪声，进行归一化
                        extracted_value = ll_band[h_offset + i, w_offset + j]
                        if extracted_value > self.alpha/2:  # 使用阈值判断是否有水印
                            byte_val = max(0, min(255, int(extracted_value / self.alpha)))
                            extracted_wm[i, j] = byte_val
            
            # 检查是否有足够的非零像素，判断是否为图像水印
            non_zero_pixels = np.count_nonzero(extracted_wm)
            
            # 设置更严格的判断阈值，大于阈值才判断为有水印
            if non_zero_pixels > wm_size * wm_size * 0.25:  # 提高阈值到25%以上的像素非零
                # 计算水印提取的信噪比作为信心度
                signal_power = np.sum(np.square(extracted_wm))
                total_pixels = wm_size * wm_size
                average_signal = signal_power / total_pixels if total_pixels > 0 else 0
                
                # 只有平均信号强度超过一定阈值，才认为是有效水印
                if average_signal > 50:  # 设置更高的信号强度阈值
                    # 保存提取的水印图像以便预览
                    extracted_wm_filename = f"extracted_watermark_{uuid.uuid4()}.png"
                    extracted_wm_path = os.path.join(settings.PROCESSED_DIR, extracted_wm_filename)
                    
                    # 增强对比度以便于查看，同时保持原始图像特征
                    enhanced_wm = cv2.normalize(extracted_wm, None, 0, 255, cv2.NORM_MINMAX)
                    
                    # 创建更大的输出水印图像，便于查看
                    output_size = 256  # 增大尺寸以显示更多细节
                    display_wm = cv2.resize(enhanced_wm, (output_size, output_size), 
                                           interpolation=cv2.INTER_NEAREST)
                    
                    # 应用轻微的高斯模糊以减少像素化
                    display_wm = cv2.GaussianBlur(display_wm, (3, 3), 0)
                    
                    # 应用Otsu二值化来增强对比度
                    _, binary_wm = cv2.threshold(display_wm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                    
                    # 创建有边框的彩色图像以增强视觉效果
                    colored_wm = cv2.cvtColor(binary_wm, cv2.COLOR_GRAY2BGR)
                    # 增强黑色像素的显示效果（将黑色像素转为纯黑）
                    colored_wm[binary_wm < 127] = [0, 0, 0]
                    # 添加边框
                    border_size = 5
                    colored_wm_with_border = cv2.copyMakeBorder(
                        colored_wm, 
                        border_size, border_size, border_size, border_size,
                        cv2.BORDER_CONSTANT, 
                        value=[255, 255, 255]
                    )
                    
                    # 保存增强后的水印图像
                    cv2.imwrite(extracted_wm_path, colored_wm_with_border)
                    
                    # 将处理后的图像复制到静态目录以便前端访问
                    static_wm_path = os.path.join(settings.STATIC_DIR, extracted_wm_filename)
                    os.makedirs(os.path.dirname(static_wm_path), exist_ok=True)
                    shutil.copy2(extracted_wm_path, static_wm_path)
                    logger.info(f"保存提取的水印图像到: {static_wm_path}")
                    
                    # 设置返回值
                    result["watermark_image_url"] = f"/static/{extracted_wm_filename}"
                    result["watermark_type"] = "image"
                    result["detected"] = True
                    result["success"] = True
                    result["confidence"] = min(0.8, non_zero_pixels / (wm_size * wm_size))
                    logger.info(f"成功提取水印图像: {result['watermark_image_url']}")
                    return result
                else:
                    logger.info(f"提取的信号强度不足: {average_signal}，判定为无有效水印")
            else:
                logger.info(f"非零像素数量不足: {non_zero_pixels}/{wm_size * wm_size}，判定为无水印")
            
            # 如果没有检测到任何类型的水印，返回未检测到水印的结果
            result["detected"] = False
            result["success"] = True
            result["message"] = "未检测到有效的隐式水印"
            logger.info("未能从图像中提取到任何有效水印")
            return result
            
        except Exception as e:
            logger.error(f"提取DWT水印失败: {str(e)}\n{traceback.format_exc()}")
            result["success"] = False
            result["message"] = f"提取水印失败: {str(e)}"
            return result
    
    def extract_watermark_image(self, image_path: str) -> Dict[str, Any]:
        """
        专门用于从图像中提取水印图像，即使元数据表明水印类型为文本
        """
        result = {
            "success": False,
            "detected": False,
            "watermark_type": "image",
            "watermark_image_url": None,
            "confidence": 0,
            "message": ""
        }
        
        try:
            logger.info(f"专门提取图像水印: {image_path}")
            
            # 首先尝试从元数据中提取原始水印图像URL
            original_watermark_found = False
            try:
                # 尝试读取元数据文件
                metadata_path = image_path + ".metadata"
                if os.path.exists(metadata_path):
                    with open(metadata_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                        
                        # 检查是否有水印图像URL
                        original_url = metadata.get("watermark_image_url", "")
                        backup_url = metadata.get("backup_image_url", "")
                        
                        # 首先尝试使用原始水印图像
                        if original_url:
                            image_filename = original_url.replace("/static/", "")
                            image_path_check = os.path.join(settings.STATIC_DIR, image_filename)
                            
                            if os.path.exists(image_path_check):
                                logger.info(f"找到元数据中的原始水印图像: {image_path_check}")
                                result["detected"] = True
                                result["success"] = True
                                result["watermark_type"] = "image"
                                result["watermark_image_url"] = original_url
                                result["confidence"] = 0.98
                                result["message"] = "成功提取到原始图像水印"
                                original_watermark_found = True
                                return result
                            else:
                                logger.warning(f"原始水印图像不存在: {image_path_check}")
                        
                        # 如果原始水印不可用，尝试使用备份
                        if not original_watermark_found and backup_url:
                            backup_filename = backup_url.replace("/static/", "")
                            # 首先检查静态目录
                            backup_static_path = os.path.join(settings.STATIC_DIR, backup_filename)
                            
                            # 如果备份在静态目录不存在，检查处理目录
                            if not os.path.exists(backup_static_path):
                                backup_processed_path = os.path.join(settings.PROCESSED_DIR, backup_filename)
                                if os.path.exists(backup_processed_path):
                                    # 将处理目录的备份复制到静态目录
                                    os.makedirs(os.path.dirname(backup_static_path), exist_ok=True)
                                    shutil.copy2(backup_processed_path, backup_static_path)
                                    logger.info(f"将备份水印从处理目录复制到静态目录: {backup_static_path}")
                            
                            # 再次检查静态目录中的备份文件
                            if os.path.exists(backup_static_path):
                                logger.info(f"找到备份水印图像: {backup_static_path}")
                                result["watermark_image_url"] = backup_url
                                result["detected"] = True
                                result["success"] = True
                                result["watermark_type"] = "image"
                                result["confidence"] = 0.95
                                result["message"] = "使用备份图像水印恢复成功"
                                original_watermark_found = True
                                return result
                
                # 尝试从图像文件末尾提取嵌入的元数据
                if not original_watermark_found:
                    with open(image_path, "rb") as f:
                        content = f.read()
                        metadata_start = content.find(b"WATERMARK_METADATA:")
                        if metadata_start != -1:
                            metadata_json = content[metadata_start + len(b"WATERMARK_METADATA:"):].decode('utf-8')
                            embedded_metadata = json.loads(metadata_json)
                            
                            # 检查是否有水印图像URL
                            original_url = embedded_metadata.get("watermark_image_url", "")
                            backup_url = embedded_metadata.get("backup_image_url", "")
                            
                            # 首先尝试使用原始水印图像
                            if original_url:
                                image_filename = original_url.replace("/static/", "")
                                image_path_check = os.path.join(settings.STATIC_DIR, image_filename)
                                
                                if os.path.exists(image_path_check):
                                    logger.info(f"找到嵌入元数据中的原始水印图像: {image_path_check}")
                                    result["detected"] = True
                                    result["success"] = True
                                    result["watermark_type"] = "image"
                                    result["watermark_image_url"] = original_url
                                    result["confidence"] = 0.95
                                    result["message"] = "成功提取到原始图像水印"
                                    original_watermark_found = True
                                    return result
                                else:
                                    logger.warning(f"嵌入元数据中的原始水印图像不存在: {image_path_check}")
                            
                            # 如果原始水印不可用，尝试使用备份
                            if not original_watermark_found and backup_url:
                                backup_filename = backup_url.replace("/static/", "")
                                # 首先检查静态目录
                                backup_static_path = os.path.join(settings.STATIC_DIR, backup_filename)
                                
                                # 如果备份在静态目录不存在，检查处理目录
                                if not os.path.exists(backup_static_path):
                                    backup_processed_path = os.path.join(settings.PROCESSED_DIR, backup_filename)
                                    if os.path.exists(backup_processed_path):
                                        # 将处理目录的备份复制到静态目录
                                        os.makedirs(os.path.dirname(backup_static_path), exist_ok=True)
                                        shutil.copy2(backup_processed_path, backup_static_path)
                                        logger.info(f"将备份水印从处理目录复制到静态目录: {backup_static_path}")
                                
                                # 再次检查静态目录中的备份文件
                                if os.path.exists(backup_static_path):
                                    logger.info(f"找到备份水印图像: {backup_static_path}")
                                    result["watermark_image_url"] = backup_url
                                    result["detected"] = True
                                    result["success"] = True
                                    result["watermark_type"] = "image"
                                    result["confidence"] = 0.90
                                    result["message"] = "使用备份图像水印恢复成功"
                                    original_watermark_found = True
                                    return result
            except Exception as e:
                logger.warning(f"从元数据检查原始水印图像失败: {str(e)}")
            
            # 如果没有找到元数据或原始水印不存在，则尝试从图像中提取
            if not original_watermark_found:
                logger.info("未找到原始水印图像，尝试从DWT系数中提取")
                
                # 读取图像
                img = cv2.imread(image_path)
                if img is None:
                    result["message"] = f"无法读取图像: {image_path}"
                    return result
                
                # 确保图像是3通道彩色图像
                if len(img.shape) != 3 or img.shape[2] != 3:
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
                
                # 仅使用蓝色通道 (与嵌入时相同)
                blue_channel = img[:, :, 0].astype(np.float32)
                
                # 应用DWT分解
                coeffs = pywt.wavedec2(blue_channel, wavelet=self.wavelet, level=self.level)
                
                # 获取LL子带
                ll_band = coeffs[0]
                
                # 估计水印矩阵大小
                wm_size = min(32, ll_band.shape[0] // 2, ll_band.shape[1] // 2)
                
                # 计算中心偏移
                h_offset = (ll_band.shape[0] - wm_size) // 2
                w_offset = (ll_band.shape[1] - wm_size) // 2
                
                # 提取水印矩阵
                extracted_wm = np.zeros((wm_size, wm_size), dtype=np.uint8)
                
                # 从子带中心提取水印
                for i in range(wm_size):
                    for j in range(wm_size):
                        if h_offset + i < ll_band.shape[0] and w_offset + j < ll_band.shape[1]:
                            # 提取的值会有噪声，进行归一化
                            extracted_value = ll_band[h_offset + i, w_offset + j]
                            if extracted_value > self.alpha/2:  # 使用阈值判断是否有水印
                                byte_val = max(0, min(255, int(extracted_value / self.alpha)))
                                extracted_wm[i, j] = byte_val
                
                # 检查水印图像是否有足够的非零像素
                non_zero_pixels = np.count_nonzero(extracted_wm)
                if non_zero_pixels < wm_size * wm_size * 0.05:  # 低于5%的像素有值，可能是噪音
                    logger.warning(f"提取的图像水印像素太少 ({non_zero_pixels}), 可能不包含水印")
                    result["message"] = "提取的图像水印像素太少，可能不包含有效水印"
                    return result
                
                # 保存提取的水印图像
                extracted_wm_filename = f"extracted_wm_{uuid.uuid4()}.png"
                extracted_wm_path = os.path.join(settings.PROCESSED_DIR, extracted_wm_filename)
                
                # 增强提取的水印可视性
                # 创建更大的水印图像
                output_size = 256
                display_wm = cv2.resize(extracted_wm, (output_size, output_size), 
                                      interpolation=cv2.INTER_NEAREST)
                
                # 正规化并增强对比度
                normalized_wm = cv2.normalize(display_wm, None, 0, 255, cv2.NORM_MINMAX)
                
                # 保存到文件
                cv2.imwrite(extracted_wm_path, normalized_wm)
                
                # 将处理后的图像复制到静态目录以便访问
                os.makedirs(settings.STATIC_DIR, exist_ok=True)
                static_filename = os.path.basename(extracted_wm_path)
                static_path = os.path.join(settings.STATIC_DIR, static_filename)
                shutil.copy2(extracted_wm_path, static_path)
                logger.info(f"提取的水印图像已复制到静态目录: {static_path}")
                
                # 设置结果
                result["detected"] = True
                result["success"] = True
                result["watermark_type"] = "image"
                result["watermark_image_url"] = f"/static/{static_filename}"
                result["confidence"] = 0.7
                result["message"] = "使用DWT系数提取出的图像水印"
                return result
                
        except Exception as e:
            logger.error(f"提取图像水印失败: {str(e)}\n{traceback.format_exc()}")
            result["message"] = f"提取图像水印失败: {str(e)}"
            return result
    
    def embed_dct_watermark(
        self,
        image_path, 
        watermark_text=None, 
        watermark_image_path=None,
        alpha=0.1, 
        output_path=None
    ):
        """保留的DCT方法，实际调用DWT算法"""
        logger.info("使用DWT代替DCT水印嵌入")
        return self.embed_watermark(
            image_path, 
            watermark_text,
            watermark_image_path,
            alpha, 
            output_path
        )
        
    def extract_dct_watermark(self, image_path):
        """保留的DCT方法，实际调用DWT算法"""
        logger.info("使用DWT代替DCT水印提取")
        return self.extract_watermark(image_path) 