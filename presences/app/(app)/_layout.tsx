import { FontAwesome, Ionicons } from '@expo/vector-icons';

import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '../../Session/ctx';



export default function Layout() {

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