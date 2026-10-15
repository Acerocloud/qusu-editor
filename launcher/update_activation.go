package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type activation struct {
	Directory string          `json:"directory"`
	Manifest  json.RawMessage `json:"manifest"`
	Signature string          `json:"signature"`
	ParentPID int             `json:"parentPid"`
	Address   string          `json:"address"`
}
type updateResult struct {
	Version string `json:"version"`
	Error   string `json:"error,omitempty"`
	At      string `json:"at"`
}

func readUpdateResult(root string) (updateResult, error) {
	var result updateResult
	data, err := os.ReadFile(filepath.Join(root, "result.json"))
	if err == nil {
		err = json.Unmarshal(data, &result)
	}
	return result, err
}
func writeJSONFile(name string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return atomicFile(name, data)
}
func atomicFile(name string, data []byte) error {
	file, err := os.CreateTemp(filepath.Dir(name), ".qusu-write-")
	if err != nil {
		return err
	}
	temp := file.Name()
	defer os.Remove(temp)
	if err := file.Chmod(0600); err != nil {
		file.Close()
		return err
	}
	if _, err := file.Write(data); err != nil {
		file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(temp, name)
}
func hashFile(name string) (string, error) {
	file, err := os.Open(name)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}
func stagedExecutable(dir string) string {
	if runtime.GOOS == "windows" {
		return filepath.Join(dir, "app", "QUSU Editor.exe")
	}
	return filepath.Join(dir, "app", "QUSU Editor.app", "Contents", "MacOS", "QUSU Editor")
}
func extractUpdate(archive, dir string, asset updateAsset) error {
	reader, err := zip.OpenReader(archive)
	if err != nil {
		return errors.New("更新压缩包损坏")
	}
	defer reader.Close()
	root := filepath.Join(dir, "app")
	if err := os.Mkdir(root, 0700); err != nil {
		return err
	}
	if len(reader.File) > 1000 {
		return errors.New("更新压缩包文件过多")
	}
	var total uint64
	for _, file := range reader.File {
		name := file.Name
		if strings.HasPrefix(name, "__MACOSX/") {
			continue
		}
		if file.Mode()&os.ModeSymlink != 0 || strings.ContainsAny(name, "\\\x00") || strings.HasPrefix(name, "/") {
			return errors.New("更新压缩包包含无效路径")
		}
		target := filepath.Join(root, filepath.FromSlash(name))
		relative, err := filepath.Rel(root, target)
		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) || filepath.IsAbs(relative) {
			return errors.New("更新压缩包路径越界")
		}
		if runtime.GOOS == "darwin" && name != "QUSU Editor.app/" && !strings.HasPrefix(name, "QUSU Editor.app/") {
			return errors.New("更新包不是 QUSU Editor 应用")
		}
		total += file.UncompressedSize64
		if total > 128*1024*1024 {
			return errors.New("更新包解压大小异常")
		}
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0700); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
			return err
		}
		input, err := file.Open()
		if err != nil {
			return err
		}
		mode := os.FileMode(0600)
		if file.Mode()&0111 != 0 {
			mode = 0700
		}
		output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
		if err != nil {
			input.Close()
			return err
		}
		n, copyErr := io.Copy(output, io.LimitReader(input, 128*1024*1024+1))
		closeErr := output.Close()
		input.Close()
		if copyErr != nil || closeErr != nil || uint64(n) != file.UncompressedSize64 {
			return errors.New("更新包解压失败")
		}
	}
	actual, err := hashFile(stagedExecutable(dir))
	if err != nil || actual != asset.ExecutableSHA256 {
		return errors.New("新版程序校验失败")
	}
	if err := verifyNativeUpdate(dir); err != nil {
		return err
	}
	return nil
}
func validateActivation(root string, job activation) (updateManifest, string, error) {
	var empty updateManifest
	if filepath.Base(job.Directory) != job.Directory || !strings.HasPrefix(job.Directory, "update-") || strings.ContainsAny(job.Directory, "\\/") {
		return empty, "", errors.New("更新目录无效")
	}
	dir := filepath.Join(root, job.Directory)
	info, err := os.Lstat(dir)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return empty, "", errors.New("更新目录不可用")
	}
	manifest, err := verifyManifest(job.Manifest, job.Signature)
	if err != nil {
		return empty, "", err
	}
	asset, ok := manifest.Assets[platformKey()]
	if !ok {
		return empty, "", errors.New("更新架构不匹配")
	}
	actual, err := hashFile(filepath.Join(dir, "package.zip"))
	if err != nil || actual != asset.SHA256 {
		return empty, "", errors.New("更新缓存校验失败")
	}
	executable := stagedExecutable(dir)
	actual, err = hashFile(executable)
	if err != nil || actual != asset.ExecutableSHA256 {
		return empty, "", errors.New("新版程序校验失败")
	}
	return manifest, executable, nil
}
func readActivation(root string) (activation, updateManifest, string, error) {
	var job activation
	data, err := os.ReadFile(filepath.Join(root, "active.json"))
	if err != nil {
		return job, updateManifest{}, "", err
	}
	if len(data) > 512*1024 || json.Unmarshal(data, &job) != nil {
		return job, updateManifest{}, "", errors.New("更新指针无效")
	}
	manifest, executable, err := validateActivation(root, job)
	return job, manifest, executable, err
}
func forwardUpdated() bool {
	root, err := updateRoot()
	if err != nil {
		return false
	}
	_, manifest, executable, err := readActivation(root)
	if err != nil || !newerVersion(manifest.Version, version) {
		return false
	}
	command := exec.Command(executable, os.Args[1:]...)
	backgroundCommand(command)
	if command.Start() != nil {
		return false
	}
	command.Process.Release()
	return true
}
func startActivation(job string) error {
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	command := exec.Command(executable, "--activate-update", job)
	backgroundCommand(command)
	if err := command.Start(); err != nil {
		return errors.New("无法启动自动升级，请重试")
	}
	exited := make(chan error, 1)
	go func() { exited <- command.Wait() }()
	deadline := time.NewTimer(30 * time.Second)
	defer deadline.Stop()
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if _, err := os.Stat(filepath.Join(filepath.Dir(job), "handoff.ready")); err == nil {
				return nil
			}
		case <-exited:
			return errors.New("更新准备失败，当前版本仍可使用，可重试")
		case <-deadline.C:
			command.Process.Kill()
			return errors.New("更新准备超时，请重试")
		}
	}
}
func applyActivation(jobPath string) error {
	root, err := updateRoot()
	if err != nil {
		return err
	}
	expected := filepath.Join(filepath.Dir(jobPath), "job.json")
	relative, err := filepath.Rel(root, expected)
	if err != nil || filepath.IsAbs(relative) || strings.HasPrefix(relative, "..") || len(strings.Split(relative, string(os.PathSeparator))) != 2 || filepath.Base(jobPath) != "job.json" {
		return errors.New("更新任务路径无效")
	}
	data, err := os.ReadFile(jobPath)
	if err != nil {
		return err
	}
	var job activation
	if json.Unmarshal(data, &job) != nil {
		return errors.New("更新任务无效")
	}
	if filepath.Clean(filepath.Join(root, job.Directory)) != filepath.Clean(filepath.Dir(jobPath)) {
		return errors.New("更新任务目录不匹配")
	}
	manifest, newExecutable, err := validateActivation(root, job)
	if err != nil {
		return err
	}
	if !newerVersion(manifest.Version, version) || job.ParentPID < 1 {
		return errors.New("更新任务版本无效")
	}
	address, err := url.Parse("http://" + job.Address)
	if err != nil || address.Hostname() != "127.0.0.1" || address.Port() == "" || address.Path != "" {
		return errors.New("更新服务地址无效")
	}
	if err := verifyNativeUpdate(filepath.Dir(jobPath)); err != nil {
		return err
	}
	probe := exec.Command(newExecutable, "--version")
	backgroundCommand(probe)
	output, err := probe.Output()
	if err != nil || strings.TrimSpace(string(output)) != manifest.Version {
		return errors.New("新版程序无法启动，已保留当前版本")
	}
	if err := os.WriteFile(filepath.Join(filepath.Dir(jobPath), "handoff.ready"), []byte("ready"), 0600); err != nil {
		return err
	}
	if err := waitForParent(job.ParentPID); err != nil {
		return err
	}
	previous, _ := os.ReadFile(filepath.Join(root, "active.json"))
	if err := writeJSONFile(filepath.Join(root, "active.json"), job); err != nil {
		return err
	}
	newProcess := exec.Command(newExecutable, "--updated")
	backgroundCommand(newProcess)
	startErr := newProcess.Start()
	if startErr == nil {
		client := http.Client{Timeout: time.Second}
		deadline := time.Now().Add(20 * time.Second)
		for time.Now().Before(deadline) {
			response, err := client.Get("http://" + job.Address + "/.qusu-launcher")
			if err == nil {
				var info struct {
					ID      string `json:"id"`
					Version string `json:"version"`
					Ready   bool   `json:"ready"`
				}
				json.NewDecoder(io.LimitReader(response.Body, 2048)).Decode(&info)
				response.Body.Close()
				if info.ID == appID && info.Version == manifest.Version && info.Ready {
					newProcess.Process.Release()
					writeJSONFile(filepath.Join(root, "result.json"), updateResult{Version: manifest.Version, At: time.Now().UTC().Format(time.RFC3339)})
					recordUpdatedVersion(manifest.Version)
					return nil
				}
			}
			time.Sleep(250 * time.Millisecond)
		}
		newProcess.Process.Kill()
		newProcess.Wait()
	}
	if len(previous) > 0 {
		atomicFile(filepath.Join(root, "active.json"), previous)
	} else {
		os.Remove(filepath.Join(root, "active.json"))
	}
	message := "新版启动失败，已自动恢复之前的版本。可点击检查更新重试。"
	writeJSONFile(filepath.Join(root, "result.json"), updateResult{Version: manifest.Version, Error: message, At: time.Now().UTC().Format(time.RFC3339)})
	return errors.New(message)
}
func cleanupUpdates(root string) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return
	}
	active, _, _, _ := readActivation(root)
	for _, entry := range entries {
		if !entry.IsDir() || entry.Type()&os.ModeSymlink != 0 || !strings.HasPrefix(entry.Name(), "update-") || entry.Name() == active.Directory {
			continue
		}
		info, err := entry.Info()
		if err != nil || time.Since(info.ModTime()) < 48*time.Hour {
			continue
		}
		// Resolve and verify the exact cache child before recursively removing our own old downloads.
		target := filepath.Join(root, entry.Name())
		relative, err := filepath.Rel(root, target)
		if err == nil && relative == entry.Name() && !filepath.IsAbs(relative) && !strings.ContainsAny(relative, "/\\") {
			os.RemoveAll(target)
		}
	}
}

func activationError(err error, jobPath string) {
	var failedVersion string
	if data, e := os.ReadFile(jobPath); e == nil {
		var job activation
		if json.Unmarshal(data, &job) == nil {
			if manifest, e := verifyManifest(job.Manifest, job.Signature); e == nil {
				failedVersion = manifest.Version
			}
		}
	}
	if root, e := updateRoot(); e == nil {
		os.MkdirAll(root, 0700)
		writeJSONFile(filepath.Join(root, "result.json"), updateResult{Version: failedVersion, Error: fmt.Sprintf("自动升级未完成：%v。当前内容仍保留，可重试。", err), At: time.Now().UTC().Format(time.RFC3339)})
	}
}
