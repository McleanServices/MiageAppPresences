import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function NotificationPanel() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Bienvenue au panneau de notifications</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
});
