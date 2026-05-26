import { supabase } from './supabase';

export const handleFirestoreError = async (error: any, operationType: string, path: string | null = null): Promise<never> => {
  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch (authErr) {
    console.warn("Could not retrieve user info for error log:", authErr);
  }
  
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
