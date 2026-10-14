# Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
"""Pillow-only codec/edit helper. Detection never reads image metadata."""
import json
from pathlib import Path
import struct
import sys
from PIL import Image, ImageEnhance, ImageOps, PngImagePlugin, features


def raster(filename):
    with Image.open(filename) as source:
        image = ImageOps.exif_transpose(source).convert("RGBA")
        return Image.alpha_composite(Image.new("RGBA", image.size, "white"), image)


def emit(filename, operation=None):
    image = raster(filename)
    header = json.dumps({"width": image.width, "height": image.height,
                         "encodedBytes": Path(filename).stat().st_size,
                         "operation": operation}).encode("utf-8")
    sys.stdout.buffer.write(struct.pack(">I", len(header)) + header + image.tobytes())


mode = sys.argv[1]
if mode == "info":
    print(json.dumps({"pillow": Image.__version__, "jpeg": features.version_codec("jpg"),
                      "libjpegTurbo": features.version_feature("libjpeg_turbo")}))
elif mode == "decode":
    emit(sys.argv[2])
elif mode == "encode":
    width, height = int(sys.argv[2]), int(sys.argv[3])
    image = Image.frombytes("RGBA", (width, height), sys.stdin.buffer.read())
    image.save(sys.argv[4], format="PNG", compress_level=6)
    emit(sys.argv[4], {"type": "png", "compressLevel": 6})
elif mode == "edit":
    source, edit, output = sys.argv[2:5]
    image = raster(source)
    operation = {"type": edit}
    pnginfo = None
    quality = None
    if edit == "png-resave":
        pnginfo = PngImagePlugin.PngInfo()
        with Image.open(source) as original:
            for key, value in original.text.items():
                pnginfo.add_itxt(key, value)
        operation["textMetadata"] = "preserved"
    elif edit == "metadata-strip":
        operation["metadata"] = "omitted: text, EXIF, ICC"
    elif edit.startswith("jpeg-"):
        quality = int(edit.split("-")[1])
        operation.update({"quality": quality, "subsampling": "4:2:0", "progressive": False})
    elif edit.startswith("brightness-"):
        factor = int(edit.split("-")[1]) / 100
        image = ImageEnhance.Brightness(image).enhance(factor)
        operation["factor"] = factor
    elif edit.startswith("contrast-"):
        factor = int(edit.split("-")[1]) / 100
        image = ImageEnhance.Contrast(image).enhance(factor)
        operation["factor"] = factor
    elif edit == "flip-horizontal":
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    elif edit == "flip-vertical":
        image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    elif edit == "rotate-90":
        image = image.transpose(Image.Transpose.ROTATE_90)
        operation["angle"] = "90 degrees counterclockwise; no interpolation"
    elif edit.startswith("resize-"):
        ratio = int(edit.split("-")[1]) / 100
        image = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))), Image.Resampling.LANCZOS)
        operation.update({"ratio": ratio, "resampling": "Lanczos", "dimensions": list(image.size)})
    elif edit.startswith("edge-crop-"):
        pixels = int(edit.split("-")[2])
        box = (pixels, pixels, image.width - pixels, image.height - pixels)
        image = image.crop(box)
        operation["box"] = list(box)
    elif edit.startswith("top-aligned-"):
        pixels = int(edit.split("-")[2])
        box = (0, pixels, image.width, image.height)
        image = image.crop(box)
        operation["box"] = list(box)
    elif edit.startswith("center-crop-"):
        ratio = int(edit.split("-")[2]) / 100
        width, height = max(1, round(image.width * ratio)), max(1, round(image.height * ratio))
        left, top = (image.width - width) // 2, (image.height - height) // 2
        box = (left, top, left + width, top + height)
        image = image.crop(box)
        operation.update({"ratio": ratio, "box": list(box)})
    else:
        raise ValueError("Unknown synthetic edit")
    image.info.clear()
    if quality is not None:
        image.convert("RGB").save(output, format="JPEG", quality=quality, subsampling=2, progressive=False, optimize=False)
    else:
        image.save(output, format="PNG", pnginfo=pnginfo, compress_level=6)
    emit(output, operation)
else:
    raise ValueError("Unknown helper operation")
