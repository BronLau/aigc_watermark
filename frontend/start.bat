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

echo 使用IP地址: %IP%
echo 启动前端服务(在局域网可访问)...

REM 设置环境变量并启动React应用
set HOST=0.0.0.0
npm run start-network 