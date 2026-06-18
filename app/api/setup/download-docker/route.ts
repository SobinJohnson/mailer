import { NextResponse } from 'next/server';
import { readFile, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import JSZip from 'jszip';

async function addFolderToZip(zip: JSZip, folderPath: string, zipPath: string) {
  const entries = await readdir(folderPath);
  for (const entry of entries) {
    const fullPath = join(folderPath, entry);
    const zipEntryPath = join(zipPath, entry).replace(/\\/g, '/');
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      await addFolderToZip(zip, fullPath, zipEntryPath);
    } else {
      const content = await readFile(fullPath);
      zip.file(zipEntryPath, content);
    }
  }
}

export async function GET() {
  try {
    const dockerDir = join(process.cwd(), 'docker');
    const zip = new JSZip();
    await addFolderToZip(zip, dockerDir, 'docker');

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="mailer-docker-setup.zip"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
