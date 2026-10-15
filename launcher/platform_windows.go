package main

import (
	"fmt"
	"github.com/Acerocloud/qusu-editor/launcher/internal/appicon"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"

	"fyne.io/systray"
)

func openBrowser(url string) error {
	shell := syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW")
	verb, _ := syscall.UTF16PtrFromString("open")
	target, _ := syscall.UTF16PtrFromString(url)
	result, _, err := shell.Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(target)), 0, 0, 1)
	if result <= 32 {
		return err
	}
	return nil
}

func showError(title, message string) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(message)
	syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
}

func setTrayIcon(png []byte) { systray.SetIcon(appicon.ICO(png)) }

func backgroundCommand(command *exec.Cmd) {
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x00000200}
}
func waitForParent(pid int) error {
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if err == windows.ERROR_INVALID_PARAMETER {
		return nil
	}
	if err != nil {
		return err
	}
	defer windows.CloseHandle(handle)
	result, err := windows.WaitForSingleObject(handle, 30000)
	if err != nil {
		return err
	}
	if result != windows.WAIT_OBJECT_0 {
		return fmt.Errorf("旧版程序尚未退出")
	}
	return nil
}
func verifyNativeUpdate(dir string) error { return nil }
func recordUpdatedVersion(value string) {
	if os.Getenv("QUSU_TEST_USER_DATA") != "" {
		return
	}
	key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Uninstall\a00c9186-8995-5627-b505-913e811e2c41`, registry.QUERY_VALUE|registry.SET_VALUE|registry.WOW64_64KEY)
	if err != nil {
		return
	}
	defer key.Close()
	location, _, err := key.GetStringValue("InstallLocation")
	if err != nil {
		return
	}
	if _, err := os.Stat(filepath.Join(location, "QUSU Editor.exe")); err == nil {
		key.SetStringValue("DisplayVersion", value)
	}
}
