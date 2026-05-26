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
    // 1. Fetch valid organization
    const { data: orgs, error: orgErr } = await supabase.from('organizations').select('id').limit(1);
    if (orgErr) {
      console.error('Fetch org failed:', orgErr);
      return;
    }
    if (!orgs || orgs.length === 0) {
      console.log('No organizations exist in the database yet. Cannot bypass foreign key constraint.');
      return;
    }
    const realOrgId = orgs[0].id;
    console.log('Using real organization ID:', realOrgId);

    // 2. Fetch valid folder (division) matching this org or any org
    const { data: folders, error: fldErr } = await supabase.from('folders').select('id').limit(1);
    if (fldErr) {
      console.error('Fetch folder failed:', fldErr);
      return;
    }
    if (!folders || folders.length === 0) {
      console.log('No folders exist in database yet. Cannot bypass foreign key.');
      return;
    }
    const realFolderId = folders[0].id;
    console.log('Using real folder ID:', realFolderId);

    // 3. Insert temporary task
    const testUserId = '00000000-0000-0000-0000-000000000000';
    console.log('Inserting a temporary test task with active references...');
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        organizationId: realOrgId,
        folderId: realFolderId,
        members: [testUserId],
        title: 'TEMP_TEST_TASK_COLUMNS',
        category: 'General',
        status: 'todo',
        progress: 0,
        deadline: '2026-06-30'
      })
      .select('*')
      .single();
      
    if (error) {
      console.error('Insert failed:', error);
    } else if (data) {
      console.log('Successfully inserted task! Column keys we received:');
      console.log(Object.keys(data));
      console.log('Full row data:', data);
      
      // Clean up by deleting the inserted task
      console.log('Cleaning up: deleting temp task with id', data.id);
      const { error: delErr } = await supabase.from('tasks').delete().eq('id', data.id);
      console.log('Cleanup error:', delErr ? delErr.message : 'NONE');
    }
  };
  
  run();
}
