package appicon

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/png"
)

// Windows expects ICO; keep only a small PNG frame rather than a full icon library.
func ICO(data []byte) []byte {
	source, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil
	}
	img := image.NewNRGBA(image.Rect(0, 0, 32, 32))
	for y := 0; y < 32; y++ {
		for x := 0; x < 32; x++ {
			img.Set(x, y, source.At(source.Bounds().Min.X+x*source.Bounds().Dx()/32, source.Bounds().Min.Y+y*source.Bounds().Dy()/32))
		}
	}
	var pngData bytes.Buffer
	png.Encode(&pngData, img)
	result := make([]byte, 22)
	binary.LittleEndian.PutUint16(result[2:], 1)
	binary.LittleEndian.PutUint16(result[4:], 1)
	result[6], result[7] = 32, 32
	binary.LittleEndian.PutUint16(result[10:], 1)
	binary.LittleEndian.PutUint16(result[12:], 32)
	binary.LittleEndian.PutUint32(result[14:], uint32(pngData.Len()))
	binary.LittleEndian.PutUint32(result[18:], 22)
	return append(result, pngData.Bytes()...)
}
