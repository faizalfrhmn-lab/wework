import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.log('Credentials missing!');
} else {
  const run = async () => {
    try {
      const restUrl = `${url.replace(/\/$/, '')}/rest/v1/`;
      console.log('Fetching Open_API schema from:', restUrl);
      const res = await fetch(restUrl, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      }
      const data: any = await res.json();
      const tasksTable = data.definitions?.tasks;
      if (tasksTable) {
        console.log('Tasks Table Properties:', Object.keys(tasksTable.properties));
        console.log('Tasks Table Full Definition:', JSON.stringify(tasksTable, null, 2));
      } else {
        console.log('Tasks table definition not found. Available tables:', Object.keys(data.definitions || {}));
      }
    } catch (err: any) {
      console.error('Error fetching schema:', err);
    }
  };
  
  run();
}
