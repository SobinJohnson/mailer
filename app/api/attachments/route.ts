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

    const fileExt = file.name.split('.').pop();
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
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
