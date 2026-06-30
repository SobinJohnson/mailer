import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Size limit: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds limit of 10MB.' }, { status: 400 });
    }

    // Whitelisted types
    const ALLOWED_MIME_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/rtf',
      'application/zip', 'application/x-zip-compressed', 'application/x-tar', 'application/x-gzip', 'application/x-7z-compressed'
    ];
    const ALLOWED_EXTENSIONS = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
      'pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf',
      'zip', 'tar', 'gz', '7z'
    ];

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt) || !ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'File type is not allowed.' }, { status: 400 });
    }

    const fileName = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // 1. Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('campaign-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 2. Save metadata to DB
    const { data: attachment, error: dbError } = await supabase
      .from('attachments')
      .insert([
        {
          filename: file.name,
          storage_path: filePath,
          mime_type: file.type,
          size_bytes: file.size,
        }
      ])
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (error: any) {
    console.error('Attachment upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload attachment' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('attachments')
    .select('id, filename, storage_path, mime_type, size_bytes, uploaded_at')
    .order('uploaded_at', { ascending: false })
    .range(0, 199);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
