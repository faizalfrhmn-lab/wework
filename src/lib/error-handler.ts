import { supabase } from './supabase';

export const handleFirestoreError = async (error: any, operationType: string, path: string | null = null): Promise<never> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const errorInfo = {
    error: error.message || 'Unknown error',
    operationType,
    path,
    authInfo: {
      userId: user?.id || 'anonymous',
      email: user?.email || 'none',
      userMetadata: user?.user_metadata || {}
    }
  };

  console.error("Database/Auth Error:", errorInfo);
  throw new Error(JSON.stringify(errorInfo));
};
