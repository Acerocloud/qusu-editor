package main

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
)

func main() {
	output, err := os.Create(os.Args[2])
	if err != nil {
		panic(err)
	}
	writer := zip.NewWriter(output)
	for _, name := range []string{"QUSU Editor.exe", "THIRD_PARTY_NOTICES.txt"} {
		input, err := os.Open(filepath.Join(os.Args[1], name))
		if err != nil {
			panic(err)
		}
		header := &zip.FileHeader{Name: name, Method: zip.Deflate}
		header.SetMode(0755)
		entry, err := writer.CreateHeader(header)
		if err != nil {
			panic(err)
		}
		if _, err := io.Copy(entry, input); err != nil {
			panic(err)
		}
		input.Close()
	}
	if err := writer.Close(); err != nil {
		panic(err)
	}
	if err := output.Close(); err != nil {
		panic(err)
	}
}
