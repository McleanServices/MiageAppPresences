import { SQLiteProvider } from 'expo-sqlite';
import { SessionProvider, useSession } from '../Session/ctx';
import { SplashScreenController } from '../Session/splash';
import { RootNavigator } from '../components/RootNavigator';




export default function Root() {
  // Set up the auth context and render our layout inside of it.
  return (
    <SQLiteProvider databaseName="local.db">
      <SessionProvider>
        <SplashScreenController />
        <RootNavigatorWrapper />
      </SessionProvider>
    </SQLiteProvider>
  );
}



// Wrapper to wait for session loading before rendering navigation
function RootNavigatorWrapper() {
  const { isLoading } = useSession();

  if (isLoading) {
    // Optionally, you could return a splash/loading component here
    return null;
  }

  return <RootNavigator />;
}
