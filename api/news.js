export default async function handler(req, res) {
  // Allow CORS from your app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate'); // Cache 15 min

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

  try {
    const encoded = encodeURIComponent(q);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=sv&gl=SE&ceid=SE:sv`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketPage/1.0)' }
    });

    if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);

    const xml = await response.text();

    // Parse RSS items
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
      const block = match[1];

      const title = strip(extract(block, 'title'));
      const link  = extract(block, 'link') || extract(block, 'guid');
      const pubDate = extract(block, 'pubDate');
      const source = extract(block, 'source') || extractAttr(block, 'source', 'url') || '';
      const description = strip(extract(block, 'description'));

      if (title) {
        items.push({
          title,
          link: link?.trim(),
          pubDate: pubDate?.trim(),
          source: source?.trim(),
          description: description?.substring(0, 200)
        });
      }
    }

    res.status(200).json({ items, query: q });

  } catch (err) {
    console.error('news.js error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

function extract(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`));
  return m ? (m[1] || m[2] || '') : '';
}

function extractAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`));
  return m ? m[1] : '';
}

function strip(str) {
  return (str || '').replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}
