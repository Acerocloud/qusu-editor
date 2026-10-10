Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

!define APP_GUID "a00c9186-8995-5627-b505-913e811e2c41"
!define APP_KEY "Software\${APP_GUID}"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}"
Name "QUSU Editor"
OutFile "${PROJECT_DIR}\release\QUSU-Editor-${VERSION}-win-${ARCH}.exe"
InstallDir "$LOCALAPPDATA\Programs\qusu-editor"
InstallDirRegKey HKCU "${APP_KEY}" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "${BINARY_DIR}\icon.ico"
UninstallIcon "${BINARY_DIR}\icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\QUSU Editor.exe"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Var OldPath
Var OldUninstall
Function .onInit
  SetShellVarContext current
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
  !if "${ARCH}" == "arm64"
    ${IfNot} ${IsNativeARM64}
      MessageBox MB_ICONSTOP "此安装包适用于 Windows ARM64，请下载 x64 版本。"
      Abort
    ${EndIf}
  !else
    ${IfNot} ${RunningX64}
      MessageBox MB_ICONSTOP "此安装包需要 64 位 Windows。"
      Abort
    ${EndIf}
  !endif
  ReadRegStr $OldPath HKCU "${APP_KEY}" "InstallLocation"
  ReadRegStr $OldUninstall HKCU "${UNINSTALL_KEY}" "UninstallString"
  ${If} $OldPath != ""
    StrCpy $INSTDIR $OldPath
  ${EndIf}
FunctionEnd

Section "Install"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=launcher.exe "${BINARY_DIR}\QUSU Editor.exe"
  check_running:
  ClearErrors
  ExecWait '"$PLUGINSDIR\launcher.exe" --check-running' $0
  ${If} ${Errors}
    SetErrorLevel 2
    Abort "无法检查程序运行状态，安装已停止。请确认安全软件未阻止启动器。"
  ${EndIf}
  ${If} $0 != 0
    IfSilent running_abort
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "请先从系统托盘退出正在运行的 QUSU Editor，再点击重试。" IDRETRY check_running
    running_abort:
    SetErrorLevel 2
    Abort "QUSU Editor 正在运行，安装已停止。"
  ${EndIf}
  ; Let the registered previous uninstaller remove its own Electron files.
  ; Never recursively delete the selected folder or browser data.
  ${If} $OldPath != ""
  ${AndIf} $OldUninstall != ""
    ClearErrors
    StrCpy $0 -1
    ExecWait '$OldUninstall /S _?=$OldPath' $0
    ${If} ${Errors}
      SetErrorLevel 2
      Abort "无法启动旧版卸载程序，安装已停止。请先卸载旧版后重试。"
    ${EndIf}
    ${If} $0 != 0
      SetErrorLevel 2
      Abort "旧版卸载失败，安装已停止。请先卸载旧版后重试。"
    ${EndIf}
    Delete "$OldPath\Uninstall QUSU Editor.exe"
  ${EndIf}
  SetOutPath "$INSTDIR"
  File "${BINARY_DIR}\QUSU Editor.exe"
  File "${BINARY_DIR}\icon.ico"
  File "${BINARY_DIR}\THIRD_PARTY_NOTICES.txt"
  WriteUninstaller "$INSTDIR\Uninstall QUSU Editor.exe"
  CreateShortcut "$DESKTOP\QUSU Editor.lnk" "$INSTDIR\QUSU Editor.exe" "" "$INSTDIR\icon.ico"
  CreateShortcut "$SMPROGRAMS\QUSU Editor.lnk" "$INSTDIR\QUSU Editor.exe" "" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${APP_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "QUSU Editor"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Sean He"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '$\"$INSTDIR\Uninstall QUSU Editor.exe$\"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '$\"$INSTDIR\Uninstall QUSU Editor.exe$\" /S'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
  uninstall_check_running:
  ClearErrors
  ExecWait '"$INSTDIR\QUSU Editor.exe" --check-running' $0
  ${If} ${Errors}
    SetErrorLevel 2
    Abort "无法检查程序运行状态，卸载已停止。请确认启动器未被安全软件隔离。"
  ${EndIf}
  ${If} $0 != 0
    IfSilent uninstall_abort
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "请先从系统托盘退出 QUSU Editor，再点击重试卸载。" IDRETRY uninstall_check_running
    uninstall_abort:
    SetErrorLevel 2
    Abort
  ${EndIf}
  Delete "$INSTDIR\QUSU Editor.exe"
  Delete "$INSTDIR\icon.ico"
  Delete "$INSTDIR\THIRD_PARTY_NOTICES.txt"
  Delete "$INSTDIR\Uninstall QUSU Editor.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\QUSU Editor.lnk"
  Delete "$SMPROGRAMS\QUSU Editor.lnk"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "${APP_KEY}"
SectionEnd
