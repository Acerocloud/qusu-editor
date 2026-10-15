package main

import (
	"errors"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
)

func parseSystemProxy(server, scheme string) (*url.URL, error) {
	server = strings.TrimSpace(server)
	if strings.Contains(server, "=") {
		selected, socks := "", ""
		for _, entry := range strings.Split(server, ";") {
			key, value, ok := strings.Cut(strings.TrimSpace(entry), "=")
			if ok && strings.EqualFold(key, scheme) {
				selected = strings.TrimSpace(value)
			}
			if ok && strings.EqualFold(key, "socks") {
				socks = strings.TrimSpace(value)
			}
		}
		server = selected
		if server == "" && socks != "" {
			server = "socks5://" + socks
		}
	}
	if server == "" {
		return nil, nil
	}
	if !strings.Contains(server, "://") {
		server = "http://" + server
	}
	proxy, err := url.Parse(server)
	if err != nil || proxy.Hostname() == "" || proxy.Path != "" || proxy.RawQuery != "" || proxy.Fragment != "" {
		return nil, errors.New("系统代理地址无效，请检查系统代理设置")
	}
	if proxy.Scheme != "http" && proxy.Scheme != "https" && proxy.Scheme != "socks5" && proxy.Scheme != "socks5h" {
		return nil, errors.New("系统代理协议不受支持")
	}
	return proxy, nil
}

func updateTransport() *http.Transport {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = func(request *http.Request) (*url.URL, error) {
		host := request.URL.Hostname()
		if host == "localhost" || net.ParseIP(host).IsLoopback() {
			return nil, nil
		}
		// Explicit process settings retain their normal precedence and NO_PROXY behavior.
		name := "HTTP_PROXY"
		if request.URL.Scheme == "https" {
			name = "HTTPS_PROXY"
		}
		if os.Getenv(name) != "" || os.Getenv(strings.ToLower(name)) != "" {
			return http.ProxyFromEnvironment(request)
		}
		return parseSystemProxy(systemProxyServer(), request.URL.Scheme)
	}
	return transport
}
