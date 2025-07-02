import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSession } from '../../Session/ctx';

export default function Profile() {
  const { signOut, user } = useSession();

  const handleLogout = () => {
    Alert.alert(
      'Se déconnecter',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.profileImage}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.prenom || ''} {user?.nom || ''}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            <Text style={styles.profileId}>ID: {user?.id_utilisateur || ''}</Text>
          </View>
        </View>
      </View>

      {/* Actions Section */}
      <View style={[styles.card, styles.actionCard]}>
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ccc',
    marginRight: 18,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 15,
    color: '#64748B',
  },
  profileId: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  actionCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 18,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    justifyContent: 'center',
    flex: 1,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
