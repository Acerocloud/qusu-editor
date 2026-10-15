package main

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Only the public verification key ships with the editor. Release signing stays in GitHub Secrets.
var updatePublicKey = "OIQdExuIxNOW3wsGI3p5zZNO8U4APDn42xSsze2V614="

const releaseBase = "https://github.com/Acerocloud/qusu-editor/releases/download/"
const releaseAPI = "https://api.github.com/repos/Acerocloud/qusu-editor/releases/latest"

type updateAsset struct {
	Name             string `json:"name"`
	Size             int64  `json:"size"`
	SHA256           string `json:"sha256"`
	ExecutableSHA256 string `json:"executableSha256"`
}
type updateManifest struct {
	Version string                 `json:"version"`
	Assets  map[string]updateAsset `json:"assets"`
}
type updateStatus struct {
	Current   string `json:"current"`
	Latest    string `json:"latest,omitempty"`
	Phase     string `json:"phase"`
	Progress  int    `json:"progress"`
	Error     string `json:"error,omitempty"`
	CheckedAt string `json:"checkedAt,omitempty"`
	Token     string `json:"token"`
	Postponed bool   `json:"postponed"`
	Waiting   int    `json:"waiting"`
}
type updateClient struct {
	Seen  time.Time
	Ready bool
}
type updater struct {
	mu                                sync.Mutex
	status                            updateStatus
	clients                           map[string]updateClient
	client                            *http.Client
	feed, downloadBase, root, address string
	readyAt, postponedUntil           time.Time
	busy                              bool
	failedVersion                     string
	job                               string
	pending                           *pendingUpdate
	quit                              func()
}

type pendingUpdate struct {
	manifest  []byte
	signature string
	asset     updateAsset
	base      string
}

func versionParts(value string) ([3]int, error) {
	var result [3]int
	parts := strings.Split(strings.TrimPrefix(value, "v"), ".")
	if len(parts) != 3 {
		return result, errors.New("版本号无效")
	}
	for i, s := range parts {
		n, err := strconv.Atoi(s)
		if err != nil || n < 0 || n > 1000000 || strconv.Itoa(n) != s {
			return result, errors.New("版本号无效")
		}
		result[i] = n
	}
	return result, nil
}
func newerVersion(next, current string) bool {
	a, e1 := versionParts(next)
	b, e2 := versionParts(current)
	if e1 != nil || e2 != nil {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return false
}
func platformKey() string {
	arch := runtime.GOARCH
	if arch == "amd64" {
		arch = "x64"
	}
	platform := runtime.GOOS
	if platform == "windows" {
		platform = "win"
	} else if platform == "darwin" {
		platform = "mac"
	}
	return platform + "-" + arch
}
func verifyManifest(data []byte, signature string) (updateManifest, error) {
	var manifest updateManifest
	key, err := base64.StdEncoding.DecodeString(updatePublicKey)
	if err != nil || len(key) != ed25519.PublicKeySize {
		return manifest, errors.New("更新验证密钥无效")
	}
	sig, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signature))
	if err != nil || !ed25519.Verify(key, data, sig) {
		return manifest, errors.New("更新签名验证失败，已停止更新")
	}
	if len(data) > 256*1024 || json.Unmarshal(data, &manifest) != nil {
		return manifest, errors.New("更新信息无效")
	}
	if _, err := versionParts(manifest.Version); err != nil {
		return manifest, err
	}
	for platform, asset := range manifest.Assets {
		if platform != "win-x64" && platform != "win-arm64" && platform != "mac-x64" && platform != "mac-arm64" {
			return manifest, errors.New("更新架构无效")
		}
		expected := "QUSU-Editor-" + manifest.Version + "-update-" + platform + ".zip"
		if asset.Name != expected || asset.Size < 1 || asset.Size > 128*1024*1024 {
			return manifest, errors.New("更新文件信息无效")
		}
		for _, hash := range []string{asset.SHA256, asset.ExecutableSHA256} {
			decoded, err := hex.DecodeString(hash)
			if err != nil || len(decoded) != 32 {
				return manifest, errors.New("更新文件校验值无效")
			}
		}
	}
	return manifest, nil
}
func updateRoot() (string, error) {
	if test := os.Getenv("QUSU_TEST_USER_DATA"); test != "" {
		return filepath.Join(test, "updates"), nil
	}
	dir, err := os.UserCacheDir()
	return filepath.Join(dir, "QUSU Editor", "updates"), err
}
func newUpdater(address string, quit func()) *updater {
	root, _ := updateRoot()
	token := make([]byte, 32)
	rand.Read(token)
	u := &updater{status: updateStatus{Current: version, Phase: "idle", Token: hex.EncodeToString(token)}, clients: map[string]updateClient{}, root: root, address: address, feed: releaseAPI, downloadBase: releaseBase, quit: quit}
	u.client = &http.Client{Timeout: 3 * time.Minute, CheckRedirect: func(r *http.Request, via []*http.Request) error {
		if len(via) > 8 {
			return errors.New("更新下载重定向过多")
		}
		if r.URL.Scheme != "https" {
			return errors.New("更新下载地址不安全")
		}
		host := r.URL.Hostname()
		if host != "github.com" && host != "api.github.com" && host != "release-assets.githubusercontent.com" && host != "objects.githubusercontent.com" {
			return errors.New("更新下载来源无效")
		}
		return nil
	}}
	// Loopback-only fixtures cannot alter the production trust key.
	if os.Getenv("QUSU_TEST_USER_DATA") != "" {
		if feed, err := url.Parse(os.Getenv("QUSU_TEST_UPDATE_FEED")); err == nil && feed.Scheme == "http" && feed.Hostname() == "127.0.0.1" {
			u.feed = feed.String()
			u.downloadBase = "http://" + feed.Host + "/download/"
			u.client = &http.Client{Timeout: 30 * time.Second}
		}
	}
	if result, err := readUpdateResult(root); err == nil && result.Error != "" {
		u.status.Phase = "error"
		u.status.Error = result.Error
		u.status.Latest = result.Version
		u.failedVersion = result.Version
	}
	return u
}
func (u *updater) snapshot() updateStatus {
	u.mu.Lock()
	defer u.mu.Unlock()
	status := u.status
	status.Postponed = time.Now().Before(u.postponedUntil)
	if status.Phase == "ready" {
		for _, client := range u.clients {
			if time.Since(client.Seen) <= time.Minute && !client.Ready {
				status.Waiting++
			}
		}
	}
	return status
}
func (u *updater) fail(err error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.status.Phase = "error"
	u.status.Error = err.Error()
}
func (u *updater) get(target string, limit int64) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, "GET", target, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", "QUSU-Editor/"+version)
	response, err := u.client.Do(request)
	if err != nil {
		return nil, errors.New("无法连接更新服务，请检查网络后重试")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, fmt.Errorf("更新服务暂不可用（%d），稍后会自动重试", response.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil || int64(len(data)) > limit {
		return nil, errors.New("更新信息读取失败")
	}
	return data, nil
}
func (u *updater) check(manual bool) {
	u.mu.Lock()
	if u.busy || u.status.Phase == "ready" || u.status.Phase == "installing" {
		u.mu.Unlock()
		return
	}
	u.busy = true
	failed := u.failedVersion
	if manual {
		u.failedVersion = ""
	}
	u.status.Phase = "checking"
	u.status.Error = ""
	u.mu.Unlock()
	defer func() { u.mu.Lock(); u.busy = false; u.mu.Unlock() }()
	data, err := u.get(u.feed, 1024*1024)
	if err != nil {
		u.fail(err)
		return
	}
	var release struct {
		Tag        string `json:"tag_name"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
	}
	if json.Unmarshal(data, &release) != nil || release.Draft || release.Prerelease {
		u.fail(errors.New("更新版本信息无效"))
		return
	}
	latest := strings.TrimPrefix(release.Tag, "v")
	if _, err := versionParts(latest); err != nil {
		u.fail(err)
		return
	}
	u.mu.Lock()
	u.status.Latest = latest
	u.status.CheckedAt = time.Now().UTC().Format(time.RFC3339)
	u.mu.Unlock()
	if !newerVersion(latest, version) {
		u.mu.Lock()
		u.status.Phase = "current"
		u.mu.Unlock()
		return
	}
	if !manual && failed == latest {
		u.fail(errors.New("上次更新未完成，当前版本仍可使用。可点击检查更新重试"))
		return
	}
	base := u.downloadBase + "v" + latest + "/"
	manifestData, err := u.get(base+"update-manifest.json", 256*1024)
	if err != nil {
		u.fail(err)
		return
	}
	signature, err := u.get(base+"update-manifest.sig", 1024)
	if err != nil {
		u.fail(err)
		return
	}
	manifest, err := verifyManifest(manifestData, string(signature))
	if err != nil {
		u.fail(err)
		return
	}
	if manifest.Version != latest {
		u.fail(errors.New("更新版本不匹配"))
		return
	}
	asset, ok := manifest.Assets[platformKey()]
	if !ok {
		u.fail(errors.New("暂未提供适合此电脑的更新包"))
		return
	}
	u.mu.Lock()
	u.pending = &pendingUpdate{manifest: manifestData, signature: strings.TrimSpace(string(signature)), asset: asset, base: base}
	u.status.Phase = "available"
	u.mu.Unlock()
}

// Downloading is only allowed after an explicit same-origin confirmation.
func (u *updater) install() bool {
	u.mu.Lock()
	if u.busy || u.status.Phase != "available" || u.pending == nil {
		u.mu.Unlock()
		return false
	}
	pending := *u.pending
	u.busy = true
	u.status.Phase = "downloading"
	u.status.Progress = 0
	u.postponedUntil = time.Time{}
	u.mu.Unlock()
	go u.downloadConfirmed(pending)
	return true
}

func (u *updater) downloadConfirmed(pending pendingUpdate) {
	defer func() { u.mu.Lock(); u.busy = false; u.mu.Unlock() }()
	asset := pending.asset
	if err := os.MkdirAll(u.root, 0700); err != nil {
		u.fail(errors.New("无法创建更新缓存，请检查磁盘权限"))
		return
	}
	dir, err := os.MkdirTemp(u.root, "update-")
	if err != nil {
		u.fail(err)
		return
	}
	u.mu.Lock()
	u.status.Phase = "downloading"
	u.status.Progress = 0
	u.mu.Unlock()
	if err := u.download(pending.base+asset.Name, filepath.Join(dir, "package.zip"), asset); err != nil {
		u.fail(err)
		return
	}
	if err := extractUpdate(filepath.Join(dir, "package.zip"), dir, asset); err != nil {
		u.fail(err)
		return
	}
	job := activation{Directory: filepath.Base(dir), Manifest: pending.manifest, Signature: pending.signature, ParentPID: os.Getpid(), Address: u.address}
	jobData, _ := json.Marshal(job)
	jobPath := filepath.Join(dir, "job.json")
	if err := os.WriteFile(jobPath, jobData, 0600); err != nil {
		u.fail(err)
		return
	}
	u.mu.Lock()
	u.job = jobPath
	u.readyAt = time.Now()
	u.status.Phase = "ready"
	u.status.Progress = 100
	u.mu.Unlock()
}
func (u *updater) download(target, destination string, asset updateAsset) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	request, _ := http.NewRequestWithContext(ctx, "GET", target, nil)
	request.Header.Set("User-Agent", "QUSU-Editor/"+version)
	response, err := u.client.Do(request)
	if err != nil {
		return errors.New("更新下载失败，请检查网络后重试")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return fmt.Errorf("更新下载失败（%d）", response.StatusCode)
	}
	file, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	hash := sha256.New()
	reader := io.LimitReader(response.Body, asset.Size+1)
	buffer := make([]byte, 64*1024)
	var size int64
	for {
		n, readErr := reader.Read(buffer)
		if n > 0 {
			if _, err = io.MultiWriter(file, hash).Write(buffer[:n]); err != nil {
				file.Close()
				return err
			}
			size += int64(n)
			u.mu.Lock()
			u.status.Progress = int(size * 100 / asset.Size)
			u.mu.Unlock()
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			file.Close()
			return errors.New("更新下载中断，请重试")
		}
	}
	if err := file.Close(); err != nil {
		return err
	}
	if size != asset.Size || hex.EncodeToString(hash.Sum(nil)) != asset.SHA256 {
		os.Remove(destination)
		return errors.New("更新文件校验失败，已停止更新")
	}
	return nil
}
func (u *updater) api(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if r.URL.Path == "/.qusu-update" && r.Method == "GET" {
		json.NewEncoder(w).Encode(u.snapshot())
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}
	if r.Header.Get("Origin") != "http://"+u.address || r.Header.Get("X-QUSU-Token") != u.snapshot().Token || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "Forbidden", 403)
		return
	}
	switch r.URL.Path {
	case "/.qusu-update/check":
		u.check(true)
	case "/.qusu-update/install":
		if !u.install() {
			http.Error(w, "Check for an available update first", 409)
			return
		}
	case "/.qusu-update/postpone":
		u.mu.Lock()
		if u.status.Phase == "installing" {
			u.mu.Unlock()
			http.Error(w, "Update already starting", 409)
			return
		}
		u.postponedUntil = time.Now().Add(time.Hour)
		for id, client := range u.clients {
			client.Ready = false
			u.clients[id] = client
		}
		u.mu.Unlock()
	case "/.qusu-update/resume":
		u.mu.Lock()
		u.postponedUntil = time.Time{}
		u.readyAt = time.Now()
		for id, client := range u.clients {
			client.Ready = false
			u.clients[id] = client
		}
		u.mu.Unlock()
	case "/.qusu-update/client":
		var client struct {
			ID     string `json:"id"`
			Ready  bool   `json:"ready"`
			Remove bool   `json:"remove"`
		}
		if json.NewDecoder(io.LimitReader(r.Body, 2048)).Decode(&client) != nil || len(client.ID) < 8 || len(client.ID) > 100 {
			http.Error(w, "Bad request", 400)
			return
		}
		u.mu.Lock()
		if client.Remove {
			delete(u.clients, client.ID)
		} else if len(u.clients) < 100 || !u.clients[client.ID].Seen.IsZero() {
			u.clients[client.ID] = updateClient{Seen: time.Now(), Ready: client.Ready}
		}
		u.mu.Unlock()
	default:
		http.NotFound(w, r)
		return
	}
	json.NewEncoder(w).Encode(u.snapshot())
}
func (u *updater) canInstall(now time.Time) bool {
	if u.status.Phase != "ready" || now.Before(u.postponedUntil) || now.Sub(u.readyAt) < 10*time.Second {
		return false
	}
	for id, client := range u.clients {
		if now.Sub(client.Seen) > time.Minute {
			delete(u.clients, id)
			continue
		}
		if !client.Ready {
			return false
		}
	}
	return true
}
func (u *updater) run() {
	go func() {
		time.Sleep(3 * time.Second)
		// A manual check during startup already supplies the result. Do not
		// overwrite its download/error state with a second automatic check.
		if u.snapshot().CheckedAt == "" {
			u.check(false)
		}
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			u.check(false)
			cleanupUpdates(u.root)
		}
	}()
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for now := range ticker.C {
			u.mu.Lock()
			ready := u.canInstall(now)
			job := u.job
			if ready {
				u.status.Phase = "installing"
			}
			u.mu.Unlock()
			if ready {
				if err := startActivation(job); err != nil {
					u.fail(err)
				} else {
					u.quit()
					return
				}
			}
		}
	}()
	go func() { time.Sleep(2 * time.Minute); cleanupUpdates(u.root) }()
}
