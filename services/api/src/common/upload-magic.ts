import { BadRequestException } from '@nestjs/common';

function startsWith(buf: Buffer, bytes: number[]) {
  return bytes.every((b, i) => buf[i] === b);
}

export function assertJpegPngOrWebp(file: Express.Multer.File, label = 'Image') {
  const buf = file.buffer;
  if (!buf?.length) throw new BadRequestException(`${label} is empty.`);
  const mime = (file.mimetype || '').toLowerCase();
  const jpeg = mime === 'image/jpeg' && startsWith(buf, [0xff, 0xd8]);
  const png = mime === 'image/png' && startsWith(buf, [0x89, 0x50, 0x4e, 0x47]);
  const webp =
    mime === 'image/webp' &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP';
  if (!jpeg && !png && !webp) {
    throw new BadRequestException(`Use a JPG, PNG, or WebP ${label.toLowerCase()}.`);
  }
}

export function assertPdfOrEpubMagic(file: Express.Multer.File) {
  const buf = file.buffer;
  if (!buf?.length) throw new BadRequestException('File is empty.');
  const isPdf = buf.toString('ascii', 0, 4) === '%PDF';
  const isZip = startsWith(buf, [0x50, 0x4b]);
  if (!isPdf && !isZip) {
    throw new BadRequestException('Only PDF and EPUB files are supported.');
  }
  return { isPdf, isEpub: !isPdf && isZip };
}
