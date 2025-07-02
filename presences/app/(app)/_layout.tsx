import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';


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
  const headerRight = () => (
    <Ionicons
      name="help-circle-outline"
      size={26}
      color="#2563EB"
      style={{ marginRight: 18 }}
      onPress={() => router.push('/profile')}
    />
  );
  return (
    <Tabs
      screenOptions={{
      tabBarActiveTintColor: '#2563EB',
      headerTitleAlign: 'center', // Center the header title
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
        tabBarIcon: ({ color }) => <FontAwesome size={28} name="qrcode" color={color} />,
      }}
      />
      <Tabs.Screen
      name="profile"
      options={{
        title: 'Profil',
        tabBarIcon: ({ color }) => <FontAwesome size={28} name="cog" color={color} />,
      }}
      />
     
      
    </Tabs>
  );
}