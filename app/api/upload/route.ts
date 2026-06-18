import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // Verify the user is authenticated
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const buffer = await file.arrayBuffer();
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const { data, error } = await supabase.storage
      .from('campaign-attachments')
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (error) {
      console.error('Storage error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate a signed URL that's valid for 10 years (or we can download it when sending)
    const { data: urlData } = await supabase.storage
      .from('campaign-attachments')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10); // 10 years

    return NextResponse.json({ 
      filename: file.name,
      storagePath: fileName,
      url: urlData?.signedUrl || '' 
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
