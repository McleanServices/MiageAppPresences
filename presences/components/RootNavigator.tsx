import { Stack } from 'expo-router';
import { useSession } from '../Session/ctx';
import { Platform } from 'react-native';


export function RootNavigator() {
  const { session } = useSession();

  return (
    <Stack>
      <Stack.Protected guard={!session}>
        <Stack.Screen
          name="login"
          options={{ headerShown: false, headerBackVisible: false }}
        />
        <Stack.Screen name="register" options={{ headerShown: false, headerBackVisible: false }} />
      </Stack.Protected>

      <Stack.Protected guard={session}>
        <Stack.Screen
          name="(app)"
          options={{ headerShown: false }}
        />
        
      </Stack.Protected>
    </Stack>
  );
}