package main

import (
	"errors"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"fyne.io/systray"
)

func openBrowser(url string) error { return exec.Command("/usr/bin/open", url).Run() }

func showError(title, message string) {
	exec.Command("/usr/bin/osascript", "-e", "display dialog "+strconv.Quote(message)+" with title "+strconv.Quote(title)+" buttons {\"确定\"} default button 1 with icon stop").Run()
}

func setTrayIcon(png []byte) { systray.SetIcon(png) }

func backgroundCommand(command *exec.Cmd) { command.SysProcAttr = &syscall.SysProcAttr{Setsid: true} }
func waitForParent(pid int) error {
	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		err := syscall.Kill(pid, 0)
		if err == syscall.ESRCH {
			return nil
		}
		if err != nil {
			return err
		}
		time.Sleep(100 * time.Millisecond)
	}
	return errors.New("旧版程序尚未退出")
}
func verifyNativeUpdate(dir string) error {
	return exec.Command("/usr/bin/codesign", "--verify", "--deep", "--strict", filepath.Join(dir, "app", "QUSU Editor.app")).Run()
}
func recordUpdatedVersion(value string) {}
