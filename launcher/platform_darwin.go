package main

import (
	"os/exec"
	"strconv"

	"fyne.io/systray"
)

func openBrowser(url string) error { return exec.Command("/usr/bin/open", url).Run() }

func showError(title, message string) {
	exec.Command("/usr/bin/osascript", "-e", "display dialog "+strconv.Quote(message)+" with title "+strconv.Quote(title)+" buttons {\"确定\"} default button 1 with icon stop").Run()
}

func setTrayIcon(png []byte) { systray.SetIcon(png) }
