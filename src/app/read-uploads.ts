import type { InputFile } from './run-analysis.ts'

/** Reads the picked files into memory; nothing leaves the browser. */
export async function readUploadedFiles(files: readonly File[]): Promise<InputFile[]> {
  return Promise.all(files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })))
}
