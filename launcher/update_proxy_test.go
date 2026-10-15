package main

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

func TestParseSystemProxy(t *testing.T) {
	for _, test := range []struct{ server, scheme, want string }{
		{"127.0.0.1:7897", "https", "http://127.0.0.1:7897"},
		{"http=127.0.0.1:8080;https=127.0.0.1:7897", "https", "http://127.0.0.1:7897"},
		{"http=127.0.0.1:8080;https=127.0.0.1:7897", "http", "http://127.0.0.1:8080"},
		{"http=127.0.0.1:8080", "https", ""},
		{"socks=127.0.0.1:1080", "https", "socks5://127.0.0.1:1080"},
		{"", "https", ""},
	} {
		proxy, err := parseSystemProxy(test.server, test.scheme)
		if err != nil {
			t.Fatal(err)
		}
		got := ""
		if proxy != nil {
			got = proxy.String()
		}
		if got != test.want {
			t.Fatalf("%s: got %s, want %s", test.server, got, test.want)
		}
	}
	for _, value := range []string{"file:///tmp/proxy", "http://", "http://proxy/path"} {
		if _, err := parseSystemProxy(value, "https"); err == nil {
			t.Fatalf("invalid proxy accepted: %s", value)
		}
	}
}

func TestUpdateProxyBypassesLocalEditor(t *testing.T) {
	transport := updateTransport()
	defer transport.CloseIdleConnections()
	for _, address := range []string{"http://localhost:17863/", "http://127.0.0.1:17863/", "http://[::1]:17863/"} {
		request, _ := http.NewRequest("GET", address, nil)
		proxy, err := transport.Proxy(request)
		if err != nil || proxy != nil {
			t.Fatal("local editor traffic must remain local")
		}
	}
}

// Opt-in publisher verification; never installs or touches an existing editor.
func TestPublishedDownloadWithSystemProxy(t *testing.T) {
	if os.Getenv("QUSU_VERIFY_SYSTEM_PROXY") != "1" {
		t.Skip("live system proxy verification is opt-in")
	}
	for _, name := range []string{"HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"} {
		t.Setenv(name, "")
	}
	if systemProxyServer() == "" {
		t.Fatal("no system proxy configured for this verification")
	}
	t.Setenv("QUSU_TEST_USER_DATA", t.TempDir())
	u := newUpdater("127.0.0.1:17863", func() {})
	base := releaseBase + "v1.4.1/"
	data, err := u.get(base+"update-manifest.json", 256*1024)
	if err != nil {
		t.Fatal(err)
	}
	sig, err := u.get(base+"update-manifest.sig", 1024)
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := verifyManifest(data, string(sig))
	if err != nil {
		t.Fatal(err)
	}
	asset, ok := manifest.Assets[platformKey()]
	if !ok {
		t.Fatal("platform missing")
	}
	if err := u.download(base+asset.Name, filepath.Join(t.TempDir(), "package.zip"), asset); err != nil {
		t.Fatal(err)
	}
	t.Log("Published update downloaded through system proxy; release signature, size and SHA-256 verified")
}
