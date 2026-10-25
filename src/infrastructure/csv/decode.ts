export type SourceEncoding = 'utf-8' | 'windows-1250'

export interface DecodedText {
  readonly text: string
  readonly encoding: SourceEncoding
  readonly hadBom: boolean
}

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const

/**
 * Decodes a CSV export: BOM → UTF-8; otherwise strict UTF-8, falling back to
 * Windows-1250 (the encoding of the legacy completions export).
 */
export function decodeCsvBytes(bytes: Uint8Array): DecodedText {
  const hadBom = UTF8_BOM.every((byte, index) => bytes[index] === byte)
  if (hadBom) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(UTF8_BOM.length)), encoding: 'utf-8', hadBom }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8', hadBom }
  } catch {
    return { text: new TextDecoder('windows-1250').decode(bytes), encoding: 'windows-1250', hadBom }
  }
}
