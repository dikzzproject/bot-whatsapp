<div align="center">

<img src="https://img.icons8.com/color/96/000000/whatsapp--v5.png" alt="Stickers-Formatter" width="96"/>

# Stickers-Formatter

**Create and format WhatsApp Stickers with ease.**

A feature-rich fork of [wa-sticker-formatter](https://github.com/AlenVelocity/wa-sticker-formatter)

[![License](https://img.shields.io/npm/l/stickers-formatter?style=flat-square&label=License&color=blue)](https://github.com/GlobalTechInfo/stickers-formatter/blob/main/LICENSE)
[![Code Quality](https://img.shields.io/codefactor/grade/github/GlobalTechInfo/stickers-formatter?style=flat-square&label=Code%20Quality)](https://www.codefactor.io/repository/github/GlobalTechInfo/stickers-formatter)
[![Downloads](https://img.shields.io/npm/dw/stickers-formatter?style=flat-square&label=Downloads&color=green)](https://npmjs.com/package/stickers-formatter)
[![NPM Version](https://img.shields.io/npm/v/stickers-formatter?style=flat-square&label=Version&color=red)](https://npmjs.com/package/stickers-formatter)
[![GitHub Attestations](https://img.shields.io/github/check-runs/GlobalTechInfo/stickers-formatter/main?label=provenance&logo=github)](https://github.com/GlobalTechInfo/stickers-formatter/attestations)

</div>

---

## ✨ Features

- 🖼️ Supports **static images**, **GIFs**, and **Videos** (animated WebP output)
- 🎨 Custom **backgrounds**, **types**, and **categories**
- 🔗 Fluent **method chaining** API
- 📦 **Baileys-MD** compatible output
- 🔍 **Metadata extraction** from existing stickers
- 📐 Multiple sticker **types**: Default, Crop, Full, Circle, Rounded
- 🖋️ **SVG** input support

---

## 📦 Installation

```bash
npm i stickers-formatter
```

---

## 🚀 Quick Start

```ts
import { Sticker, StickerTypes } from 'stickers-formatter'

const sticker = new Sticker('./image.png', {
    pack: 'My Pack',
    author: 'Me',
    type: StickerTypes.FULL,
})

const buffer = await sticker.toBuffer()
```

---

## 📥 Import

```ts
import { Sticker, createSticker, StickerTypes } from 'stickers-formatter' // ES6
// const { Sticker, createSticker, StickerTypes } = require('stickers-formatter') // CommonJS
```

---

## 📖 Usage

Stickers-Formatter provides two ways to create stickers — the `Sticker` class and the `createSticker` function. Both accept the same parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `image` | `Buffer \| string` | Buffer, URL, SVG string, or file path. GIFs and videos produce animated WebP. |
| `options` | `IStickerOptions` | Configuration object (see [Options](#%EF%B8%8F-options)) |

---

### 🏗️ Using the `Sticker` Class (Recommended)

```ts
const sticker = new Sticker(image, {
    pack: 'My Pack',
    author: 'Me',
    type: StickerTypes.FULL,
    categories: ['🤩', '🎉'],
    id: '12345',
    quality: 50,
    background: '#000000'
})

const buffer = await sticker.toBuffer()

await sticker.toFile('sticker.webp')

sock.sendMessage(jid, await sticker.toMessage())
```

#### Method Chaining

```ts
const buffer = await new Sticker(image)
    .setPack('My Pack')
    .setAuthor('Me')
    .setType(StickerTypes.FULL)
    .setCategories(['🤩', '🎉'])
    .setID('12345')
    .setBackground('#000000')
    .setQuality(50)
    .toBuffer()
```

#### SVG Input

```ts
const sticker = new Sticker(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0z" fill="#ff0000" />
    </svg>
`, { author: 'Me', pack: 'SVG Pack' })
```

---

### ⚡ Using the `createSticker` Function

```ts
const buffer = await createSticker(image, options)
```

> Returns a `Promise<Buffer>` — useful for functional-style code.

---

## ⚙️ Options

```ts
interface IStickerOptions {
    pack?: string
    author?: string
    id?: string
    categories?: Categories[]
    background?: Sharp.Color
    type?: StickerTypes | string
    quality?: number
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pack` | `string` | `''` | Sticker pack title |
| `author` | `string` | `''` | Sticker pack author |
| `id` | `string` | auto-generated | Unique sticker pack ID |
| `categories` | `string[]` | `undefined` | Array of emojis for categorization |
| `background` | `string \| object` | `transparent` | Hex string or RGBA object |
| `type` | `StickerTypes` | `DEFAULT` | How the image is fitted |
| `quality` | `number` (0–100) | `100` | Output WebP quality |

---

## 📐 Sticker Types

```ts
enum StickerTypes {
    DEFAULT = 'default',
    CROPPED = 'crop',
    FULL    = 'full',
    CIRCLE  = 'circle',
    ROUNDED = 'rounded'
}
```

| Type | Description |
|------|-------------|
| `DEFAULT` | Standard WhatsApp sticker sizing |
| `CROPPED` | Crops the image to fit |
| `FULL` | Fits the full image with optional background |
| `CIRCLE` | Circular crop |
| `ROUNDED` | Rounded corners |

---

## 🎨 Background

The `background` option accepts a hex string or a Sharp RGBA object.

```ts
background: '#FFFFFF'
```

```ts
background: {
    r: 255,
    g: 255,
    b: 255,
    alpha: 1
}
```

> Background is only applied when using `StickerTypes.FULL`.

---

## 🔍 Metadata

WhatsApp stickers embed metadata (author, pack name, category) directly into the WebP file as [Exif](https://en.wikipedia.org/wiki/Exif) data.

<a href="https://ibb.co/MhyzMwJ">
  <img src="https://i.ibb.co/9vmxsKd/metadata.jpg" alt="Sticker metadata preview" width="256"/>
</a>

> **Bold text** = Pack title &nbsp;|&nbsp; Regular text = Author name

### Sticker Category

Categories are arrays of emojis embedded in the sticker metadata. [Learn more →](https://github.com/WhatsApp/stickers/wiki/Tag-your-stickers-with-Emojis)

### Extracting Metadata

```ts
import { extractMetadata, Sticker } from 'stickers-formatter'
import { readFileSync } from 'fs'

const file = readFileSync('sticker.webp')

const metadata = await extractMetadata(file)
// {
//   emojis: [],
//   'sticker-pack-id': '',
//   'sticker-pack-name': '',
//   'sticker-pack-publisher': ''
// }

const metadata2 = await Sticker.extractMetadata(file)
```

---

## 🤝 Contributing

Contributions, issues and feature requests are welcome! Feel free to open an [issue](https://github.com/GlobalTechInfo/stickers-formatter/issues) or submit a pull request.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](https://github.com/GlobalTechInfo/stickers-formatter/blob/main/LICENSE) for more information.

---

<div align="center">

Made with ❤️ — Thanks for using **Stickers-Formatter**!

</div>
