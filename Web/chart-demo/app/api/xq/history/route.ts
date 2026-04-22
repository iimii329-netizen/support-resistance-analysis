import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sid = searchParams.get('sid') || '2330.TW';
  const days = searchParams.get('days') || '100';

  const url = `http://xqtestweb.xq.com.tw/jds/chat/46/TW/gethistdata3.jdxml?sid=${sid}&ST=1&a=8&c=${days}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch from XQ' }, { status: 500 });
    }

    const xmlData = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    const jsonObj = parser.parse(xmlData);

    const dataNode = jsonObj.Result?.Data;
    if (!dataNode) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 });
    }

    const items = Array.isArray(dataNode.Item) ? dataNode.Item : [dataNode.Item];
    
    // Convert to KLineChart format
    const bars = items.map((item: any) => ({
      time: `${item.D.slice(0, 4)}/${item.D.slice(4, 6)}/${item.D.slice(6, 8)}`,
      open: parseFloat(item.O),
      high: parseFloat(item.H),
      low: parseFloat(item.L),
      close: parseFloat(item.C),
      volume: parseInt(item.V),
    })).sort((a: any, b: any) => a.time.localeCompare(b.time));

    return NextResponse.json({
        sid: dataNode.ID,
        bars: bars
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
