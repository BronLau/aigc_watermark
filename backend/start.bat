@echo off
REM 设置控制台代码页为UTF-8，解决中文显示问题
chcp 65001
REM 获取本机IP地址
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set IP=%%a
    goto :found
)
:found
REM 移除IP地址前面的空格
set IP=%IP:~1%

REM 设置环境变量
set BASE_URL=http://%IP%:8000
set DISABLE_AUTO_WATERMARK=1

echo 使用IP地址: %IP%
echo 禁用自动添加AIGC标识
echo 启动后端服务...

REM 验证环境变量是否正确设置
python -c "import os; print('环境变量DISABLE_AUTO_WATERMARK =', os.environ.get('DISABLE_AUTO_WATERMARK', '未设置'))"

REM 启动FastAPI服务器
python main.py 