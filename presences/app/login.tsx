import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image'; // <-- added import
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSession } from '../Session/ctx';


// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export default function Login() {
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const { signIn } = useSession();
  const [appIsReady, setAppIsReady] = useState(false);

  // Add state for form fields and error
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [biometricPrompted, setBiometricPrompted] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
    
        // Artificially delay for two seconds to simulate a slow loading
        // experience. Remove this if you copy and paste the code!
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    // Check if biometrics is enabled and available
    const checkBiometrics = async () => {
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      setBiometricEnabled(enabled === 'true');
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
      // If enabled, prompt for biometrics
      if (enabled === 'true' && hasHardware && isEnrolled && !biometricPrompted) {
        setBiometricPrompted(true);
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authentifiez-vous pour vous connecter',
        });
        if (result.success) {
          router.replace('/');
        }
      }
    };
    checkBiometrics();
  }, []);

  const onLayoutRootView = useCallback(() => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      SplashScreen.hide();
    }
  }, [appIsReady]);

  // Add login handler
  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    const result = await signIn(email, motDePasse);
    if (result.success) {
      if (biometricAvailable) {
        setShowBiometricModal(true);
      } else {
        router.replace('/');
      }
    } else {
      setError(result.error || 'Erreur inconnue');
    }
    setLoading(false);
  };

  const handleEnableBiometrics = async () => {
    setShowBiometricModal(false);
    const bioResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Activez la connexion biométrique',
    });
    if (bioResult.success) {
      await AsyncStorage.setItem('biometricEnabled', 'true');
      setBiometricEnabled(true);
    }
    router.replace('/');
  };

  const handleDeclineBiometrics = async () => {
    setShowBiometricModal(false);
    await AsyncStorage.setItem('biometricEnabled', 'false');
    setBiometricEnabled(false);
    router.replace('/');
  };

  if (!appIsReady) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.centeredView}>
          {/* Four images above the card */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
            <Image
              source={require('../assets/images/icon.png')}
              style={{ width: 80, height: 80, marginHorizontal: 4 }}
              contentFit="contain"
            />
            <Image
              source={require('../assets/images/icon.png')}
              style={{ width: 80, height: 80, marginHorizontal: 4 }}
              contentFit="contain"
            />
            <Image
              source={require('../assets/images/icon.png')}
              style={{ width: 80, height: 80, marginHorizontal: 4 }}
              contentFit="contain"
            />
            <Image
              source={require('../assets/images/icon.png')}
              style={{ width: 80, height: 80, marginHorizontal: 4 }}
              contentFit="contain"
            />
          </View>
          {/* Card */}
          <View style={styles.card}>
            {/* Title */}
            <Text style={styles.title}>
              CONNEXION
            </Text>
            <View style={styles.titleUnderline} />
            {/* Error message (fixed height to prevent bounce) */}
            <View style={styles.errorBoxWrapper}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText} numberOfLines={2} ellipsizeMode="tail">
                    {error}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Login input */}
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="LOGIN"
                style={styles.input}
                placeholderTextColor="#555"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Ionicons name="person-outline" size={24} color="#E15A2D" style={styles.inputIcon} />
            </View>

            {/* Password input */}
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="MOT DE PASSE"
                style={styles.input}
                placeholderTextColor="#555"
                secureTextEntry
                value={motDePasse}
                onChangeText={setMotDePasse}
              />
              <Ionicons name="lock-closed-outline" size={24} color="#E15A2D" style={styles.inputIcon} />
            </View>

            {/* Forgot password - right aligned */}
            <View style={styles.forgotPasswordContainer}>
              <TouchableOpacity>
                <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </View>

            {/* Login button */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Connexion...' : 'SE CONNECTER'}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Shadow background just under the card */}
          <View style={styles.shadowBackground} />
          {/* Modal for biometric enable prompt */}
          <Modal
            visible={showBiometricModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowBiometricModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Connexion biométrique</Text>
                </View>
                <Text style={styles.modalMessage}>
                  Voulez-vous activer la connexion biométrique pour la prochaine fois ?
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalButton} onPress={handleEnableBiometrics}>
                    <Text style={[styles.modalButtonText, { color: '#2563EB' }]}>Oui, activer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalButton} onPress={handleDeclineBiometrics}>
                    <Text style={[styles.modalButtonText, { color: '#EF4444' }]}>Non, merci</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 600, // add a fixed minHeight to stabilize vertical position
  },
  card: {
    backgroundColor: "#1686B0",
    borderRadius: 60,
    width: "90%",
    maxWidth: 600,
    alignItems: "center",
    paddingVertical: 20, // reduced from 36 to 20
    marginTop: 0,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 0,
    letterSpacing: 1,
    textAlign: "center"
  },
  titleUnderline: {
    width: 160,
    height: 4,
    backgroundColor: "#3CA1D8", // changed to a lighter blue
    opacity: 0.4, // more dim
    marginTop: 6,
    marginBottom: 28,
    borderRadius: 2,
    alignSelf: "center"
  },
  errorBoxWrapper: {
    height: 48, // increased fixed height for error area
    width: '100%',
    justifyContent: 'center',
    marginBottom: 0,
    overflow: 'hidden',
  },
  errorBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    minHeight: 28,
    justifyContent: 'center',
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center'
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F2",
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
    width: 320,
    height: 48,
  },
  input: {
    flex: 1,
    color: "#333",
    fontSize: 16,
  },
  inputIcon: {
    marginLeft: 8,
  },
  forgotPasswordContainer: {
    width: 320,
    alignItems: "flex-end",
    marginBottom: 18,
  },
  forgotPasswordText: {
    color: "#fff",
    fontSize: 14,
    opacity: 0.85,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E15A2D",
    borderRadius: 5,
    paddingVertical: 12,
    width: 320,
    justifyContent: "center",
    marginBottom: 10,
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  registerLink: {
    color: "#fff",
    fontSize: 15,
    marginTop: 10,
    opacity: 0.85,
    textAlign: "center",
  },
  registerLinkUnderline: {
    textDecorationLine: "underline",
    color: "#fff",
  },
  shadowBackground: {
    width: "90%",
    maxWidth: 600,
    height: 150,
    backgroundColor: "#0A2342",
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    alignSelf: "center",
    marginTop: -60,
    zIndex: 0,
  },
  testButton: {
    marginTop: 10,
    backgroundColor: "#4CAF50",
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  testButtonText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: 320,
    alignItems: 'center',
  },
  modalHeader: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563EB',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});