
export async function GET({ request }) {
  const url = new URL(request.url);
  const blobUrl = url.searchParams.get('url');
  
  if (!blobUrl || !blobUrl.includes('blob.vercel-storage.com')) {
    return new Response('Invalid URL', { status: 400 });
  }
  
  try {
    const response = await fetch(blobUrl);
    if (!response.ok) throw new Error('Failed to fetch');
    const html = await response.text();
    return new Response(html, { 
      status: 200, 
      headers: { 'Content-Type': 'text/html; charset=utf-8' } 
    });
  } catch (error) {
    return new Response('Error loading site', { status: 500 });
  }
}
