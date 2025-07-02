import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ValiderScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Validation réussie</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
});

export default ValiderScreen;
