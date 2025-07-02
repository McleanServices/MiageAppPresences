import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
} from "react-native";

import { useRouter } from "expo-router";

const EmargerScreen = () => {
  const router = useRouter();

  const openCamera = () => {
    router.push('/emarger/camera');
  };

  return (
    <View style={styles.container}>
      
      <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
        <Text style={styles.buttonText}>Ouvrir la caméra</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  cameraButton: {
    marginTop: 30,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default EmargerScreen;
