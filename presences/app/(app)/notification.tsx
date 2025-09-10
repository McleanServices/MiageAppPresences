import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Button, Platform, View, StyleSheet, Text, Alert, ActivityIndicator } from 'react-native';
import { useSession } from '../../Session/ctx';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

Notifications.scheduleNotificationAsync({
  content: {
    title: 'Salut',
    body: "Bienvenue dans l'application Miage Présences !",
  },
  trigger: null,
});

export default function Notification() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(
    undefined
  );
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);
  const [keyUpdateStatus, setKeyUpdateStatus] = useState<string | null>(null);
  const { updateNotificationKey, user, signOut } = useSession();

  useEffect(() => {
    registerForPushNotificationsAsync().then(async token => {
      if (token) {
        setExpoPushToken(token);
        // Update user's notification key when token is obtained
        if (user) {
          await updateUserNotificationKey(token);
        }
      }
    });

    if (Platform.OS === 'android') {
      Notifications.getNotificationChannelsAsync();
    }
    
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log(response);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [user]);

  const updateUserNotificationKey = async (token: string) => {
    setIsUpdatingKey(true);
    setKeyUpdateStatus('Mise à jour de la clé de notification...');
    
    try {
      const result = await updateNotificationKey(token);
      if (result.success) {
        console.log('Notification key updated successfully');
        setKeyUpdateStatus('Clé de notification mise à jour avec succès');
        setTimeout(() => setKeyUpdateStatus(null), 3000);
      } else {
        console.error('Failed to update notification key:', result.error);
        setKeyUpdateStatus(`Erreur: ${result.error}`);
        Alert.alert(
          'Erreur de mise à jour',
          `Impossible de mettre à jour la clé de notification: ${result.error}`,
          [
            { text: 'OK' },
            { 
              text: 'Réessayer', 
              onPress: () => updateUserNotificationKey(token) 
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error updating notification key:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setKeyUpdateStatus(`Erreur: ${errorMessage}`);
      Alert.alert('Erreur', `Une erreur est survenue: ${errorMessage}`);
    } finally {
      setIsUpdatingKey(false);
    }
  };

  const retryUpdateNotificationKey = async () => {
    if (expoPushToken) {
      await updateUserNotificationKey(expoPushToken);
    } else {
      Alert.alert('Erreur', 'Token de notification non disponible. Veuillez redémarrer l\'application.');
    }
  };

  return (
    <View style={styles.container}>
      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.userText}>
            Utilisateur: {user.prenom} {user.nom}
          </Text>
          {expoPushToken && (
            <Text style={styles.tokenText}>
              Token: {expoPushToken.substring(0, 20)}...
            </Text>
          )}
        </View>
      )}
      
      {isUpdatingKey && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color="#0000ff" />
          <Text style={styles.statusText}>Mise à jour en cours...</Text>
        </View>
      )}
      
      {keyUpdateStatus && !isUpdatingKey && (
        <View style={styles.statusContainer}>
          <Text style={[
            styles.statusText,
            keyUpdateStatus.includes('succès') ? styles.successText : styles.errorText
          ]}>
            {keyUpdateStatus}
          </Text>
        </View>
      )}
      
      {keyUpdateStatus && keyUpdateStatus.includes('Erreur') && (
        <Button
          title="Réessayer la mise à jour"
          onPress={retryUpdateNotificationKey}
          color="#ff6b6b"
        />
      )}
      
      <View style={styles.buttonContainer}>
        <Button
          title="Tester notification"
          onPress={schedulePushNotification}
          color="#4CAF50"
        />
        <Button
          title="Se déconnecter"
          onPress={signOut}
          color="#f44336"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  userInfo: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  userText: {
    fontSize: 16,
    marginBottom: 5,
  },
  tokenText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    marginLeft: 5,
    fontSize: 14,
  },
  successText: {
    color: '#4CAF50',
  },
  errorText: {
    color: '#f44336',
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
});

async function schedulePushNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "You've got mail! 📬",
      body: 'Here is the notification body',
      data: { 
        data: 'goes here', 
        test: { test1: 'more data' },
        url: '/notifications/index'
      },
      sound: Platform.OS === 'ios' ? 'notification_sound.wav' : undefined,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('new_emails', {
      name: 'E-mail notifications',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'notification_sound.wav', 
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log(token);
    } catch (e) {
      token = `${e}`;
    }
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}
