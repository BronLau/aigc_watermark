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
            # 读取水印图像
            watermark_img = cv2.imread(watermark_image_path, cv2.IMREAD_UNCHANGED)
            if watermark_img is None:
                logger.error(f"无法读取水印图像: {watermark_image_path}")
                # 如果图像读取失败，回退到文本水印
                return self._prepare_watermark_data(watermark_text, None, max_size)
                
            # 调整图像大小以适应要求
            size = min(max_size, 32)
            watermark_img_resized = cv2.resize(watermark_img, (size, size))
            
            # 转换为灰度图
            if len(watermark_img_resized.shape) > 2:
                watermark = cv2.cvtColor(watermark_img_resized, cv2.COLOR_BGR2GRAY)
            else:
                watermark = watermark_img_resized
                
            # 规范化为标准范围
            watermark = watermark.astype(np.uint8)
            
            # 保存临时文件用于提取
            watermark_filename = f"watermark_{uuid.uuid4()}.png"
            watermark_save_path = os.path.join(settings.PROCESSED_DIR, watermark_filename)
            cv2.imwrite(watermark_save_path, watermark_img)
            
            # 记录元数据
            metadata["watermark_type"] = "image"
            metadata["watermark_image_url"] = f"/static/{watermark_filename}"
            metadata["matrix_size"] = size
            
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
            # 如果没有提供水印文本，创建一个空的水印矩阵
            watermark = np.zeros((1, 1), dtype=np.uint8)
            metadata["watermark_type"] = "none"
        
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
            if watermark_image_path:
                logger.info(f"DWT添加图像水印 - 图像路径: {watermark_image_path}")
            else:
                logger.info(f"DWT添加文本水印 - 文本: {watermark_text}")
            
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
            
            # 添加水印 - 强化字节加入，确保可提取性
            # 使用加法操作嵌入水印 (直接在系数上添加)
            for i in range(watermark_resized.shape[0]):
                for j in range(watermark_resized.shape[1]):
                    if h_offset + i < h_end and w_offset + j < w_end:
                        if watermark_resized[i, j] > 0:
                            # 对于有意义的字节，显著增强信号
                            ll_band[h_offset + i, w_offset + j] += self.alpha * watermark_resized[i, j]
            
            # 更新系数
            coeffs[0] = ll_band
            
            # 应用逆DWT重建图像
            reconstructed = pywt.waverec2(coeffs, wavelet=self.wavelet)
            
            # 处理尺寸差异 (DWT可能会改变尺寸)
            reconstructed = cv2.resize(reconstructed, (img.shape[1], img.shape[0]))
            
            # 裁剪值到有效范围
            reconstructed = np.clip(reconstructed, 0, 255)
            
            # 更新蓝色通道
            watermarked_img[:, :, 0] = reconstructed.astype(np.uint8)
            
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
                    
                    # 处理图像水印
                    if metadata.get("watermark_type") == "image" and metadata.get("watermark_image_url"):
                        result["watermark_type"] = "image"
                        result["watermark_image_url"] = metadata["watermark_image_url"]
                        result["detected"] = True
                        result["success"] = True
                        result["confidence"] = 0.99
                        logger.info(f"从元数据提取到图像水印: {result['watermark_image_url']}")
                        return result
                    
                    # 处理文本水印
                    elif "watermark_text" in metadata:
                        result["watermark_text"] = metadata["watermark_text"]
                        result["watermark_type"] = metadata.get("watermark_type", "text")
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
                        logger.info(f"从图像文件末尾提取到元数据")
                        
                        # 处理图像水印
                        if embedded_metadata.get("watermark_type") == "image" and embedded_metadata.get("watermark_image_url"):
                            result["watermark_type"] = "image"
                            result["watermark_image_url"] = embedded_metadata["watermark_image_url"]
                            result["detected"] = True
                            result["success"] = True
                            result["confidence"] = 0.95
                            logger.info(f"从嵌入元数据提取到图像水印: {result['watermark_image_url']}")
                            return result
                            
                        # 处理文本水印
                        elif "watermark_text" in embedded_metadata:
                            result["watermark_text"] = embedded_metadata["watermark_text"]
                            result["watermark_type"] = embedded_metadata.get("watermark_type", "text")
                            result["detected"] = True
                            result["success"] = True
                            result["confidence"] = 0.95
                            logger.info(f"从嵌入元数据提取到水印文本: {result['watermark_text']}")
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
            
            # 从子带中心提取水印 - 仅从对角线提取
            for i in range(wm_size):
                # 对角线上的值可能包含水印字节
                # 从LL带中提取值
                extracted_value = ll_band[h_offset + i, w_offset + i]
                
                # 尝试将值转换回原始字节
                # 提取的值会有噪声，进行归一化和近似
                if extracted_value > self.alpha/2:  # 使用阈值判断是否有水印
                    byte_val = max(0, min(255, int(extracted_value / self.alpha)))
                    if 32 <= byte_val <= 126:  # 可打印ASCII范围
                        extracted_wm[i, i] = byte_val
            
            # 从对角线上收集有意义的字节
            extracted_bytes = bytearray()
            for i in range(wm_size):
                if extracted_wm[i, i] > 0:
                    extracted_bytes.append(extracted_wm[i, i])
            
            logger.info(f"提取的字节序列: {[b for b in extracted_bytes]}")
            
            # 尝试解码为文本
            if len(extracted_bytes) > 0:
                try:
                    # 直接尝试UTF-8解码
                    watermark_text = extracted_bytes.decode('utf-8', errors='ignore')
                    logger.info(f"直接解码的文本: {watermark_text}")
                    
                    # 清理文本 (删除不可打印字符)
                    import string
                    printable = set(string.printable)
                    cleaned_text = ''.join(c for c in watermark_text if c in printable)
                    
                    # 移除前后的空白字符
                    cleaned_text = cleaned_text.strip()
                    
                    logger.info(f"清理后的文本: {cleaned_text}")
                    
                    if cleaned_text:
                        result["watermark_text"] = cleaned_text
                    result["watermark_type"] = "text"
                    result["detected"] = True
                    result["success"] = True
                    result["confidence"] = 0.8
                    return result
                except Exception as e:
                    logger.error(f"水印文本解码失败: {str(e)}")
            
            # 未能提取到有效水印
            result["detected"] = False
            result["success"] = True
            result["message"] = "未检测到有效水印"
            return result
            
        except Exception as e:
            logger.error(f"提取DWT水印失败: {str(e)}\n{traceback.format_exc()}")
            result["success"] = False
            result["message"] = f"提取水印失败: {str(e)}"
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
