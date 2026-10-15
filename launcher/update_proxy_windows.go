package main

import "golang.org/x/sys/windows/registry"

// GUI launches do not inherit a browser's proxy environment variables.
func systemProxyServer() string {
	key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Internet Settings`, registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer key.Close()
	enabled, _, err := key.GetIntegerValue("ProxyEnable")
	if err != nil || enabled == 0 {
		return ""
	}
	server, _, _ := key.GetStringValue("ProxyServer")
	return server
}
