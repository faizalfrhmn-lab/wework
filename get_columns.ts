import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.log('Credentials missing!');
} else {
  const supabase = createClient(url, key);
  
  const run = async () => {
    const candidates = [
      'id',
      'folderId',
      'folder_id',
      'organizationId',
      'organization_id',
      'members',
      'title',
      'note',
      'category',
      'initialAmount',
      'initial_amount',
      'amount',
      'status',
      'assigneeId',
      'assignee_id',
      'deadline',
      'progress',
      'completedAt',
      'completed_at',
      'createdAt',
      'created_at'
    ];
    
    console.log('Testing column names...');
    for (const col of candidates) {
      const { error } = await supabase.from('tasks').select(col).limit(1);
      console.log(`Column '${col}':`, error ? `FAILED (${error.message})` : 'SUCCESS');
    }
  };
  
  run();
}
