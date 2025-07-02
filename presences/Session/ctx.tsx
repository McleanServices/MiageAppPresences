import { createContext, use, type PropsWithChildren } from 'react';
import { useStorageState } from './useStorageState';

const AuthContext = createContext<{
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  session: boolean;
  isLoading: boolean;
  user: {
    id_utilisateur: string;
    nom: string;
    prenom: string;
    email: string;
    role: string;
    type_utilisateur: string;
  } | null;
  updateNotificationKey: (token: string) => Promise<{ success: boolean; error?: string }>;
}>({
  signIn: async () => ({ success: false }),
  signOut: () => null,
  session: false,
  isLoading: false,
  user: null,
  updateNotificationKey: async () => ({ success: false }),
});

// This hook can be used to access the user info.
export function useSession() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useSession must be wrapped in a <SessionProvider />');
  }

  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, session], setSession] = useStorageState('session');
  const [[, userInfo], setUserInfo] = useStorageState('userInfo');
  const [[, authToken], setAuthToken] = useStorageState('authToken');

  return (
    <AuthContext
      value={{
        signIn: async (email: string, password: string) => {
          try {
            const response = await fetch('https://sunnysidecode.com/miagepresences/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, mot_de_passe: password }),
            });
            const data = await response.json();
            if (!response.ok) {
              return { success: false, error: data.message || 'Erreur inconnue' };
            }
            
            // Store the auth token
            setAuthToken(data.token);
            
            // Fetch complete user profile to get id_utilisateur
            try {
              const profileResponse = await fetch('https://sunnysidecode.com/miagepresences/api/profile', {
                method: 'GET',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${data.token}`
                },
              });
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                setUserInfo(JSON.stringify({
                  id_utilisateur: profileData.id_utilisateur,
                  nom: profileData.nom,
                  prenom: profileData.prenom,
                  email: profileData.email,
                  role: profileData.role,
                  type_utilisateur: profileData.type_utilisateur,
                }));
              } else {
                // Fallback to basic user info if profile fetch fails
                if (data.utilisateur) {
                  setUserInfo(JSON.stringify({
                    id_utilisateur: data.utilisateur.id_utilisateur || '',
                    nom: data.utilisateur.nom,
                    prenom: data.utilisateur.prenom,
                    email: data.utilisateur.email,
                    role: data.utilisateur.role,
                    type_utilisateur: data.utilisateur.type_utilisateur,
                  }));
                } else {
                  setUserInfo(null);
                }
              }
            } catch (profileErr) {
              // Fallback to basic user info if profile fetch fails
              if (data.utilisateur) {
                setUserInfo(JSON.stringify({
                  id_utilisateur: data.utilisateur.id_utilisateur || '',
                  nom: data.utilisateur.nom,
                  prenom: data.utilisateur.prenom,
                  email: data.utilisateur.email,
                  role: data.utilisateur.role,
                  type_utilisateur: data.utilisateur.type_utilisateur,
                }));
              } else {
                setUserInfo(null);
              }
            }
            
            setSession('true');
            return { success: true };
          } catch (err) {
            return { success: false, error: 'Impossible de se connecter au serveur. Veuillez réessayer plus tard.' };
          }
        },
        signOut: () => {
          setSession(null);
          setUserInfo(null);
          setAuthToken(null);
        },
        session: !!session,
        isLoading,
        user: userInfo ? JSON.parse(userInfo) : null,
        updateNotificationKey: async (token: string) => {
          try {
            const user = userInfo ? JSON.parse(userInfo) : null;
            if (!user || !user.id_utilisateur) {
              return { success: false, error: 'Utilisateur non connecté' };
            }

            if (!authToken) {
              return { success: false, error: 'Token d\'authentification manquant' };
            }

            console.log('Updating notification key for user:', user.id_utilisateur);
            console.log('Using notification token:', token);

            const response = await fetch(`https://sunnysidecode.com/miagepresences/api/notifications/user/${user.id_utilisateur}/key`, {
              method: 'PATCH',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({ cle_notification: token }),
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            // Get response as text first to see what we're getting
            const responseText = await response.text();
            console.log('Raw response:', responseText);
            
            // Check if response is JSON
            let data;
            try {
              data = JSON.parse(responseText);
            } catch (parseError) {
              console.error('Failed to parse response as JSON:', parseError);
              return { 
                success: false, 
                error: `Erreur serveur: réponse non-JSON reçue (Status: ${response.status}). Vérifiez l'URL de l'API.` 
              };
            }
            
            console.log('Parsed response data:', data);
            
            if (!response.ok) {
              return { success: false, error: data.message || `Erreur ${response.status}: ${response.statusText}` };
            }

            return { success: true };
          } catch (err) {
            console.error('Network error:', err);
            return { success: false, error: `Erreur réseau: ${err instanceof Error ? err.message : String(err)}` };
          }
        },
      }}>
      {children}
    </AuthContext>
  );
}
