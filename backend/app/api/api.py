from fastapi import APIRouter
from app.api import watermark_api

router = APIRouter()

router.include_router(watermark_api.router, prefix="/watermark", tags=["watermark"]) 