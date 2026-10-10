package main

import (
	"github.com/Acerocloud/qusu-editor/launcher/internal/appicon"
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
