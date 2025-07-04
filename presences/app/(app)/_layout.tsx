import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '../../Session/ctx';

function useNotificationObserver() {
  useEffect(() => {
    let isMounted = true;

    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string' && url) {
        router.push(url as any);
      }
    }

    Notifications.getLastNotificationResponseAsync() 
      .then(response => {
        if (!isMounted || !response?.notification) {
          return;
        }
        redirect(response?.notification);
      });

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      redirect(response.notification);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);
}

export default function Layout() {
  useNotificationObserver();
  const { user } = useSession();
  
  const headerRight = () => (
    <Ionicons
      name="settings-outline"
      size={26}
      color="#2563EB"
      style={{ marginRight: 18 }}
      onPress={() => router.push('/notification')}
    />
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        headerTitleAlign: 'center',
        headerRight,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="home" color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="emarger"
        options={{
          title: 'Emarger',
          href: user?.role === 'etudiant' ? undefined : null,
          tabBarIcon: ({ color }) => (
            user?.role === 'etudiant' 
              ? <FontAwesome size={28} name="qrcode" color={color} />
              : <FontAwesome size={28} name="cog" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="notification"
        options={{
          title: 'Notifications',
          href: null,
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="bell" color={color} />,
        }}
      />

      <Tabs.Screen
        name="qrcode"
        options={{
          title: 'QRCode',
          href: user?.role === 'enseignant' ? undefined : null,
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="qrcode" color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          href: user?.role === 'etudiant' ? undefined : null,
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="user" color={color} />,
        }}
      />

      <Tabs.Screen
        name="list-emarger"
        options={{
          title: 'List Emarger',
          href: user?.role === 'enseignant' ? undefined : null,
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="list" color={color} />,
        }}
      />
    </Tabs>
  );
}