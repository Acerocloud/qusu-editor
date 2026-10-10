package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestServerBoundaries(t *testing.T) {
	assets := fstest.MapFS{"index.html": {Data: []byte("editor")}, "assets/app.js": {Data: []byte("app()")}}
	h := handler(assets, "127.0.0.1:17863")
	for _, test := range []struct {
		method, route, host string
		status              int
		body                string
	}{
		{"GET", "/", "127.0.0.1:17863", 200, "editor"},
		{"HEAD", "/", "127.0.0.1:17863", 200, ""},
		{"GET", "/assets/app.js", "127.0.0.1:17863", 200, "app()"},
		{"GET", "/missing", "127.0.0.1:17863", 404, "404"},
		{"GET", "/%2e%2e%2fgo.mod", "127.0.0.1:17863", 403, "Forbidden"},
		{"GET", "/assets%5c..%5cgo.mod", "127.0.0.1:17863", 403, "Forbidden"},
		{"GET", "/", "evil.example", 403, "Forbidden"},
		{"POST", "/", "127.0.0.1:17863", 405, "Method not allowed"},
		{"GET", "/.qusu-launcher", "127.0.0.1:17863", 200, appID},
	} {
		r := httptest.NewRequest(test.method, test.route, nil)
		r.Host = test.host
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != test.status || !strings.Contains(w.Body.String(), test.body) {
			t.Errorf("%+v: %d %s", test, w.Code, w.Body.String())
		}
	}
}

func TestExistingInstance(t *testing.T) {
	for _, data := range []string{`{"id":"com.qusu.editor","version":"1.3.0"}`, `{"id":"other"}`, `not json`} {
		s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(data)) }))
		if existingLauncher(s.URL+"/") != strings.Contains(data, appID) {
			t.Errorf("wrong instance detection for %s", data)
		}
		s.Close()
		if existingLauncher(s.URL + "/") {
			t.Error("closed server accepted")
		}
	}
}
