package main

import (
	"bufio"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"fyne.io/systray"
)

//go:embed all:web
var files embed.FS

//go:embed icon.png
var icon []byte

var version = "dev"
var nativeReady atomic.Bool

const appID = "com.qusu.editor"

func handler(assets fs.FS, address string, updates ...*updater) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != address {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/.qusu-update") && len(updates) > 0 {
			updates[0].api(w, r)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if r.URL.Path == "/.qusu-launcher" {
			w.Header().Set("Content-Type", "application/json")
			if r.Method != http.MethodHead {
				json.NewEncoder(w).Encode(map[string]any{"id": appID, "version": version, "ready": nativeReady.Load()})
			}
			return
		}
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == "" {
			name = "index.html"
		}
		if strings.ContainsAny(name, "\\\x00") || !fs.ValidPath(name) {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		data, err := fs.ReadFile(assets, name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		mime := map[string]string{".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".json": "application/json"}
		if contentType := mime[path.Ext(name)]; contentType != "" {
			w.Header().Set("Content-Type", contentType)
		}
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		if r.Method != http.MethodHead {
			w.Write(data)
		}
	})
}

func existingLauncher(url string) bool {
	client := http.Client{Timeout: 2 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Get(url + ".qusu-launcher")
	if err != nil {
		return false
	}
	defer response.Body.Close()
	var info struct {
		ID string `json:"id"`
	}
	return response.StatusCode == http.StatusOK && json.NewDecoder(response.Body).Decode(&info) == nil && info.ID == appID
}

func testRecord(name, value string) {
	if dir := os.Getenv("QUSU_TEST_USER_DATA"); dir != "" {
		f, err := os.OpenFile(path.Join(dir, name), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
		if err == nil {
			defer f.Close()
			fmt.Fprintln(f, value)
		}
	}
}

func openEditor(url string) {
	if os.Getenv("QUSU_TEST_USER_DATA") != "" {
		testRecord("opened-urls.txt", url)
		return
	}
	if err := openBrowser(url); err != nil {
		showError("无法自动打开浏览器", "请在浏览器地址栏打开："+url)
	}
}

func main() {
	if len(os.Args) == 2 && os.Args[1] == "--updated" && os.Getenv("QUSU_TEST_USER_DATA") != "" && os.Getenv("QUSU_TEST_UPDATE_FAIL_VERSION") == version {
		os.Exit(1)
	}
	if len(os.Args) == 2 && os.Args[1] == "--version" {
		fmt.Println(version)
		return
	}
	if len(os.Args) == 3 && os.Args[1] == "--activate-update" {
		if err := applyActivation(os.Args[2]); err != nil {
			activationError(err, os.Args[2])
			if _, ready := os.Stat(filepath.Join(filepath.Dir(os.Args[2]), "handoff.ready")); ready == nil {
				executable, _ := os.Executable()
				command := exec.Command(executable, "--updated")
				backgroundCommand(command)
				if command.Start() == nil {
					command.Process.Release()
				}
			}
			os.Exit(1)
		}
		return
	}
	port := 17863 // Keep the same origin as all browser-based Electron versions.
	if os.Getenv("QUSU_TEST_USER_DATA") != "" && os.Getenv("QUSU_TEST_PORT") != "" {
		value, err := strconv.Atoi(os.Getenv("QUSU_TEST_PORT"))
		if err != nil || value < 1 || value > 65535 {
			os.Exit(1)
		}
		port = value
	}
	address := fmt.Sprintf("127.0.0.1:%d", port)
	url := "http://" + address + "/"
	if len(os.Args) == 2 && os.Args[1] == "--check-running" {
		probe, err := net.Listen("tcp", address)
		if err != nil {
			os.Exit(1)
		}
		probe.Close()
		return
	}
	if forwardUpdated() {
		return
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		if existingLauncher(url) {
			openEditor(url)
			return
		}
		message := fmt.Sprintf("本地端口 %d 已被占用。请先从托盘退出旧版 QUSU Editor 或关闭占用程序，再重新启动。", port)
		if os.Getenv("QUSU_TEST_USER_DATA") != "" {
			testRecord("error.txt", message)
		} else {
			showError("QUSU Editor 启动失败", message)
		}
		os.Exit(1)
	}
	assets, _ := fs.Sub(files, "web")
	updates := newUpdater(address, systray.Quit)
	server := &http.Server{Handler: handler(assets, address, updates), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second}
	go server.Serve(listener)
	systray.Run(func() {
		setTrayIcon(icon)
		systray.SetTooltip("QUSU Editor — 浏览器编辑器")
		open := systray.AddMenuItem("打开编辑器", "在默认浏览器中打开")
		checkUpdate := systray.AddMenuItem("检查更新", "自动下载并升级到最新版本")
		systray.AddMenuItem(url, "本机编辑地址").Disable()
		systray.AddSeparator()
		quit := systray.AddMenuItem("退出 QUSU Editor", "停止本机服务")
		systray.SetOnTapped(func() { openEditor(url) })
		go func() {
			for {
				select {
				case <-open.ClickedCh:
					openEditor(url)
				case <-checkUpdate.ClickedCh:
					openEditor(url)
					go updates.check(true)
				case <-quit.ClickedCh:
					systray.Quit()
					return
				}
			}
		}()
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		go func() { <-stop; systray.Quit() }()
		if os.Getenv("QUSU_TEST_USER_DATA") != "" {
			go func() {
				scanner := bufio.NewScanner(os.Stdin)
				for scanner.Scan() {
					if scanner.Text() == "quit" {
						systray.Quit()
						return
					}
				}
			}()
		}
		nativeReady.Store(true)
		testRecord("tray-ready.txt", version)
		testRecord("native-instances.jsonl", fmt.Sprintf(`{"pid":%d,"version":%q}`, os.Getpid(), version))
		if len(os.Args) != 2 || os.Args[1] != "--updated" {
			openEditor(url)
		}
		if os.Getenv("QUSU_TEST_USER_DATA") == "" || os.Getenv("QUSU_TEST_UPDATE_FEED") != "" {
			updates.run()
		}
	}, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	})
}
