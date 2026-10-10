# QUSU Editor 1.0.0

安装后直接打开编辑器，无需安装 Node.js、启动服务或连接付费 API。包含模块排版、局部文字样式、图片与相册、JSON 项目导入导出，以及复制公众号排版。

## 下载安装

- Windows（Intel / AMD）：下载 `QUSU-Editor-1.0.0-win-x64.exe`，双击安装。
- Windows ARM：下载 `QUSU-Editor-1.0.0-win-arm64.exe`。
- Mac（Apple 芯片）：下载 `QUSU-Editor-1.0.0-mac-arm64.dmg`，打开后将应用拖到 Applications。
- Mac（Intel）：下载 `QUSU-Editor-1.0.0-mac-x64.dmg`，同样拖到 Applications。
- macOS 另提供 ZIP 包，解压后将应用放入 Applications。

此版本未做 Windows 代码签名、Apple 签名或公证。Windows 首次打开可能显示 SmartScreen 提示；确认下载自此私有仓库后选择“更多信息 → 仍要运行”。macOS 如阻止打开，请按 Apple 的“系统设置 → 隐私与安全性 → 仍要打开”流程确认。组织管理的设备可能要求管理员批准。若要求无此提示，需要配置对应平台的签名证书。

## 本地文章

文章及本地图片保存在桌面应用的本机数据目录，不会自动上传 GitHub。桌面版与浏览器版的存储独立；迁移时，在浏览器版点击“保存 JSON”，然后在桌面版导入该文件。重要文章建议定期导出 JSON 备份。

滚动图片的公众号兼容性仍取决于公众号保存时的处理；上传公众号素材后填回图片 URL，并保存草稿、发送手机预览确认。

仓库目前为私有，下载安装包需要有该仓库的访问权限。
