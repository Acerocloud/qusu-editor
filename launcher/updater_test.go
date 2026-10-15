package main

import (
	"archive/zip"
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

func trustFixture(t *testing.T) ed25519.PrivateKey {
	t.Helper()
	public, private, _ := ed25519.GenerateKey(rand.Reader)
	oldKey, oldVersion := updatePublicKey, version
	updatePublicKey = base64.StdEncoding.EncodeToString(public)
	version = "1.4.0"
	t.Cleanup(func() { updatePublicKey = oldKey; version = oldVersion })
	return private
}
func digest(data []byte) string { hash := sha256.Sum256(data); return hex.EncodeToString(hash[:]) }
func manifestFixture(t *testing.T, private ed25519.PrivateKey, payload []byte) ([]byte, string) {
	t.Helper()
	manifest := updateManifest{Version: "1.5.0", Assets: map[string]updateAsset{platformKey(): {Name: "QUSU-Editor-1.5.0-update-" + platformKey() + ".zip", Size: int64(len(payload)), SHA256: digest(payload), ExecutableSHA256: digest([]byte("program"))}}}
	data, _ := json.Marshal(manifest)
	return data, base64.StdEncoding.EncodeToString(ed25519.Sign(private, data))
}
func TestUpdateVersions(t *testing.T) {
	for _, test := range []struct {
		next, current string
		want          bool
	}{{"1.10.0", "1.9.9", true}, {"2.0.0", "1.99.9", true}, {"1.4.0", "1.4.0", false}, {"1.3.9", "1.4.0", false}, {"v1.5.0", "1.4.0", true}, {"1.5.0-beta", "1.4.0", false}, {"01.5.0", "1.4.0", false}, {"../bad", "1.4.0", false}} {
		if newerVersion(test.next, test.current) != test.want {
			t.Errorf("%+v", test)
		}
	}
}
func TestSignedManifest(t *testing.T) {
	private := trustFixture(t)
	data, signature := manifestFixture(t, private, []byte("zip"))
	if _, err := verifyManifest(data, signature); err != nil {
		t.Fatal(err)
	}
	for _, changed := range [][]byte{append(data, ' '), bytes.ReplaceAll(data, []byte("1.5.0"), []byte("9.5.0"))} {
		if _, err := verifyManifest(changed, signature); err == nil {
			t.Fatal("tampered manifest was accepted")
		}
	}
	if _, err := verifyManifest(data, "invalid"); err == nil {
		t.Fatal("bad signature accepted")
	}
}
func TestUpdateNetworkAndHashFailure(t *testing.T) {
	private := trustFixture(t)
	payload := []byte("expected")
	data, signature := manifestFixture(t, private, payload)
	var mode string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/latest":
			if mode == "offline" {
				http.Error(w, "offline", 503)
				return
			}
			w.Write([]byte(`{"tag_name":"v1.5.0"}`))
		case "/download/v1.5.0/update-manifest.json":
			w.Write(data)
		case "/download/v1.5.0/update-manifest.sig":
			if mode == "signature" {
				w.Write([]byte("bad"))
			} else {
				w.Write([]byte(signature))
			}
		default:
			w.Write([]byte("corrupt!"))
		}
	}))
	defer server.Close()
	t.Setenv("QUSU_TEST_USER_DATA", t.TempDir())
	t.Setenv("QUSU_TEST_UPDATE_FEED", server.URL+"/latest")
	for _, scenario := range []struct{ mode, contains string }{{"offline", "503"}, {"signature", "签名"}, {"hash", "校验"}} {
		mode = scenario.mode
		u := newUpdater("127.0.0.1:17863", func() {})
		u.check(true)
		status := u.snapshot()
		if status.Phase != "error" || !strings.Contains(status.Error, scenario.contains) {
			t.Fatalf("%s: %+v", mode, status)
		}
	}
}
func TestUpdateClientReadiness(t *testing.T) {
	now := time.Now()
	u := &updater{status: updateStatus{Phase: "ready"}, readyAt: now.Add(-11 * time.Second), clients: map[string]updateClient{"a": {Seen: now, Ready: true}, "b": {Seen: now}}}
	if u.canInstall(now) {
		t.Fatal("unsaved client ignored")
	}
	u.clients["b"] = updateClient{Seen: now, Ready: true}
	if !u.canInstall(now) {
		t.Fatal("saved clients blocked")
	}
	u.postponedUntil = now.Add(time.Hour)
	if u.canInstall(now) {
		t.Fatal("postponed update activated")
	}
	u.postponedUntil = time.Time{}
	u.clients["b"] = updateClient{Seen: now.Add(-2 * time.Minute)}
	if !u.canInstall(now) {
		t.Fatal("closed client blocks indefinitely")
	}
	u.readyAt = now
	if u.canInstall(now) {
		t.Fatal("download activated without grace period")
	}
}
func TestUpdaterAPISameOrigin(t *testing.T) {
	t.Setenv("QUSU_TEST_USER_DATA", t.TempDir())
	u := newUpdater("127.0.0.1:17863", func() {})
	h := handler(fstest.MapFS{}, u.address, u)
	for _, test := range []struct {
		origin, token string
		want          int
	}{{"http://evil.example", u.status.Token, 403}, {"http://127.0.0.1:17863", "bad", 403}, {"", u.status.Token, 403}, {"http://127.0.0.1:17863", u.status.Token, 200}} {
		r := httptest.NewRequest("POST", "/.qusu-update/client", strings.NewReader(`{"id":"test-client","ready":true}`))
		r.Host = u.address
		r.Header.Set("Origin", test.origin)
		r.Header.Set("X-QUSU-Token", test.token)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != test.want {
			t.Errorf("%+v => %d", test, w.Code)
		}
	}
}
func TestUpdateZipTraversal(t *testing.T) {
	for _, name := range []string{"../escaped.exe", "/outside.exe", "bad\\evil.exe"} {
		var buffer bytes.Buffer
		writer := zip.NewWriter(&buffer)
		file, _ := writer.Create(name)
		file.Write([]byte("bad"))
		writer.Close()
		dir := t.TempDir()
		archive := filepath.Join(dir, "package.zip")
		os.WriteFile(archive, buffer.Bytes(), 0600)
		if err := extractUpdate(archive, dir, updateAsset{}); err == nil {
			t.Fatalf("unsafe path accepted: %s", name)
		}
	}
}
func TestCachedUpdateIntegrity(t *testing.T) {
	private := trustFixture(t)
	data, signature := manifestFixture(t, private, []byte("zip"))
	root := t.TempDir()
	dir := filepath.Join(root, "update-test")
	os.MkdirAll(filepath.Dir(stagedExecutable(dir)), 0700)
	os.WriteFile(filepath.Join(dir, "package.zip"), []byte("zip"), 0600)
	os.WriteFile(stagedExecutable(dir), []byte("program"), 0700)
	job := activation{Directory: "update-test", Manifest: data, Signature: signature}
	if _, _, err := validateActivation(root, job); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(stagedExecutable(dir), []byte("tampered"), 0700)
	if _, _, err := validateActivation(root, job); err == nil {
		t.Fatal("tampered cached executable accepted")
	}
	job.Directory = "../elsewhere"
	if _, _, err := validateActivation(root, job); err == nil {
		t.Fatal("cache path escape accepted")
	}
}
