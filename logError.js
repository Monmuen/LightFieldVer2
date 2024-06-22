// /api/logError.js
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { context, message, stack } = req.body;

    // 在这里处理日志记录，可以将日志存储在数据库或外部日志系统中
    console.log('Error context:', context);
    console.log('Error message:', message);
    console.log('Error stack:', stack);

    res.status(200).json({ status: 'ok' });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

