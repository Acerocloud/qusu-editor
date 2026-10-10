package main

import (
	"github.com/Acerocloud/qusu-editor/launcher/internal/appicon"
	"os"
)

func main() {
	data, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile(os.Args[2], appicon.ICO(data), 0644); err != nil {
		panic(err)
	}
}
