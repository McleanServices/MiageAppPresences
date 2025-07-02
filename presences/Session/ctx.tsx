import { createContext, use, type PropsWithChildren } from 'react';
import { useStorageState } from './useStorageState';

const AuthContext = createContext<{
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  session: boolean;
  isLoading: boolean;
  user: {
    nom: string;
    prenom: string;
    email: string;
    role: string;
    type_utilisateur: string;
  } | null;
}>({
  signIn: async () => ({ success: false }),
  signOut: () => null,
  session: false,
  isLoading: false,
  user: null,
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
            // Store user info from data.utilisateur
            if (data.utilisateur) {
              setUserInfo(JSON.stringify({
                nom: data.utilisateur.nom,
                prenom: data.utilisateur.prenom,
                email: data.utilisateur.email,
                role: data.utilisateur.role,
                type_utilisateur: data.utilisateur.type_utilisateur,
              }));
            } else {
              setUserInfo(null);
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
        },
        session: !!session,
        isLoading,
        user: userInfo ? JSON.parse(userInfo) : null,
      }}>
      {children}
    </AuthContext>
  );
}
