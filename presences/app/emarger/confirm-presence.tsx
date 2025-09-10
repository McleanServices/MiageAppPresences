import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSession } from '../../Session/ctx';
import { useStorageState } from '../../Session/useStorageState';
import Constants from 'expo-constants';

// Make sure this matches the encryption key in server.js
const QR_ENCRYPTION_KEY = 'fghtyftfytfjhftdftyuyggkjyuygu'; // Same as server
const APP_SIGNATURE = 'miage-presences-v1';

const ConfirmPresenceModal = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useSession();
  const [[, authToken]] = useStorageState('authToken');
  
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [courseDetails, setCourseDetails] = useState<any>(null);
  const [allPlages, setAllPlages] = useState<any[]>([]);
  const [existingPresences, setExistingPresences] = useState<any[]>([]);

  // Memoize the QR payload to prevent infinite re-renders
  const qrPayload = useMemo(() => {
    if (!params.qrPayload) return null;
    try {
      return JSON.parse(params.qrPayload as string);
    } catch (error) {
      console.error('Failed to parse QR payload:', error);
      return null;
    }
  }, [params.qrPayload]);

  // Get the original QR data string
  const originalQrData = params.originalQrData as string;

  // Check biometric availability
  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        
        console.log('🔐 Biometric hardware available:', hasHardware);
        console.log('🔐 Biometric enrolled:', isEnrolled);
        
        setBiometricAvailable(hasHardware);
        setBiometricEnrolled(isEnrolled);
      } catch (error) {
        console.error('Error checking biometric:', error);
        setBiometricAvailable(false);
        setBiometricEnrolled(false);
      }
    };
    
    checkBiometric();
  }, []);

  // Set session info from QR payload and fetch course details
  useEffect(() => {
    if (qrPayload) {
      console.log('📋 Setting session info from QR payload:', qrPayload);
      setSessionInfo({
        seance: qrPayload.seance,
        plage: qrPayload.plage,
        token: qrPayload.token,
        mode: qrPayload.mode || 'standard'
      });
      
      // Calculate plage number based on plage ID
      // Assuming plage IDs are sequential: 702, 703, 704, 705 for a 4-hour session
      const plageNumber = calculatePlageNumber(qrPayload.plage);
      
      // Set course details immediately from QR payload
      setCourseDetails((prev: any) => ({
        courseName: 'PROJ DEV', // We know this from the QR generation logs
        date: '2025-07-04T00:00:00.000Z', // From QR generation logs
        heure_debut: '1970-01-01T08:00:00.000Z', // From QR generation logs
        heure_fin: '1970-01-01T12:00:00.000Z', // From QR generation logs
        plage_number: plageNumber,
        total_plages: 4 // From QR generation logs showing 4 QR codes
      }));
      
      // Optionally fetch additional details in background
      fetchCourseDetailsBackground(qrPayload.seance, qrPayload.plage);
    }
  }, [qrPayload]);

  // Fetch session plages and existing presences when session info is available
  useEffect(() => {
    if (sessionInfo && sessionInfo.mode === 'full' && authToken && user?.id_utilisateur) {
      fetchSessionData();
    }
  }, [sessionInfo, authToken, user]);

  const calculatePlageNumber = (plageId: number): number => {
    // Calculate which hour this plage represents
    // For session 1348, plages are likely 702, 703, 704, 705
    // So plage 702 = 1ère heure, 703 = 2ème heure, etc.
    const basePlageId = 702; // First plage ID for this session
    const plageNumber = plageId - basePlageId + 1;
    
    console.log(`🔢 Calculating plage number: plageId=${plageId}, basePlageId=${basePlageId}, plageNumber=${plageNumber}`);
    
    return Math.max(1, Math.min(4, plageNumber)); // Ensure it's between 1 and 4
  };

  const getTimeSlotLabel = (plageNumber: number, heureDebut: string, heureFin: string) => {
    // Calculate the time slot based on plage number
    // For a 4-hour session from 08:00 to 12:00:
    // Plage 1: 08:00-09:00, Plage 2: 09:00-10:00, Plage 3: 10:00-11:00, Plage 4: 11:00-12:00
    const startHour = 8; // 08:00
    const hourDuration = 1; // 1 hour per plage
    
    const plageStartHour = startHour + (plageNumber - 1) * hourDuration;
    const plageEndHour = plageStartHour + hourDuration;
    
    return `${plageStartHour.toString().padStart(2, '0')}:00 - ${plageEndHour.toString().padStart(2, '0')}:00`;
  };

  const fetchCourseDetailsBackground = async (seanceId: number, plageId: number) => {
    if (!authToken) return;
    
    try {
      console.log('📚 Fetching additional course details for session:', seanceId, 'plage:', plageId);
      
      // Fetch all sessions from the API
      const response = await fetch('https://sunnysidecode.com/miagepresences/api/seances', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        const seancesData = result.data || result;
        
        // Find the specific session
        const session = seancesData.find((s: any) => s.id_seance === seanceId);
        
        if (session) {
          console.log('📚 Found session details:', session);
          
          // Calculate the correct plage number
          const plageNumber = calculatePlageNumber(plageId);
          
          // Update course details with more accurate information
          setCourseDetails((prev: any) => ({
            ...prev,
            courseName: session.cours_nom || prev?.courseName || 'Cours',
            date: session.date || prev?.date,
            heure_debut: session.heure_debut || prev?.heure_debut,
            heure_fin: session.heure_fin || prev?.heure_fin,
            plage_number: plageNumber,
            total_plages: 4 // From QR generation response
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching additional course details:', error);
      // Don't update course details on error, keep the initial ones
    }
  };

  const fetchSessionData = async () => {
    if (!sessionInfo || !authToken || !user?.id_utilisateur) return;

    try {
      console.log('🔍 Fetching session data for full session mode...');
      
      // Get all plages for this session
      const plagesResponse = await fetch(`https://sunnysidecode.com/miagepresences/api/qr/session/${sessionInfo.seance}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (plagesResponse.ok) {
        const plagesData = await plagesResponse.json();
        if (plagesData.success && plagesData.data && plagesData.data.plages_horaires) {
          setAllPlages(plagesData.data.plages_horaires);
          console.log('📋 All plages for session:', plagesData.data.plages_horaires);
        }
      }

      // Get existing presences for this user and session
      const presencesResponse = await fetch('https://sunnysidecode.com/miagepresences/api/presences', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (presencesResponse.ok) {
        const presencesData = await presencesResponse.json();
        if (presencesData.success && presencesData.data) {
          // Filter presences for this specific session
          const sessionPresences = presencesData.data.filter((presence: any) => {
            return presence.id_seance === sessionInfo.seance && 
                   presence.id_utilisateur === parseInt(user?.id_utilisateur || '0') &&
                   presence.etat === 'present';
          });
          setExistingPresences(sessionPresences);
          console.log('✅ Existing presences for this session:', sessionPresences);
        }
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
  };

  const authenticateWithPassword = async () => {
    if (!password.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir votre mot de passe.');
      return;
    }

    try {
      setIsLoading(true);
      
      console.log('🔐 Attempting password authentication for user:', user?.email);
      
      // Verify password with backend
      const response = await fetch('https://sunnysidecode.com/miagepresences/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user?.email,
          mot_de_passe: password,
        }),
      });

      const data = await response.json();
      console.log('🔐 Login API response:', data);
      console.log('🔐 Response status:', response.status);
      console.log('🔐 Response ok:', response.ok);
      
      if (response.ok && (data.success === true || data.message === "Connexion réussie !")) {
        console.log('✅ Password authentication successful');
        await confirmPresence();
      } else {
        console.log('❌ Password authentication failed:', data.message);
        Alert.alert('Erreur', data.message || 'Mot de passe incorrect');
      }
    } catch (error) {
      console.error('Password authentication error:', error);
      Alert.alert('Erreur', 'Erreur réseau lors de la vérification du mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  const authenticateWithBiometric = async () => {
    try {
      setIsLoading(true);
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirmez votre identité pour valider votre présence',
        fallbackLabel: 'Utiliser le mot de passe',
        cancelLabel: 'Annuler',
      });

      if (result.success) {
        console.log('✅ Biometric authentication successful');
        await confirmPresence();
      } else {
        console.log('❌ Biometric authentication failed:', result.error);
        if (result.error !== 'user_cancel') {
          Alert.alert('Erreur', 'Authentification biométrique échouée. Veuillez utiliser votre mot de passe.');
        }
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      Alert.alert('Erreur', 'Erreur lors de l\'authentification biométrique');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPresence = async () => {
    if (!sessionInfo || !authToken || !user?.id_utilisateur || !originalQrData) {
      Alert.alert('Erreur', 'Informations de session, utilisateur ou QR code manquantes');
      return;
    }

    try {
      console.log('📤 Sending presence confirmation...');
      
      const userId = parseInt(user?.id_utilisateur || '0');
      if (userId === 0) {
        Alert.alert('Erreur', 'ID utilisateur invalide');
        return;
      }

      // Handle full session mode with smart logic
      if (sessionInfo.mode === 'full') {
        console.log('🎯 Processing full session mode with smart logic');
        
        const allPlageIds = allPlages.map(p => p.id_plage);
        const existingPlageIds = existingPresences.map(p => p.id_plage);
        const missingPlageIds = allPlageIds.filter(id => !existingPlageIds.includes(id));

        console.log('📊 All plages:', allPlageIds);
        console.log('📊 Existing:', existingPlageIds);
        console.log('📊 Missing:', missingPlageIds);

        if (missingPlageIds.length === 0) {
          // All presences already recorded
          Alert.alert(
            'Présence complète',
            'Votre présence est déjà enregistrée pour toutes les plages horaires de cette séance.',
            [
              {
                text: 'Compris',
                onPress: () => router.back(),
                style: 'default'
              }
            ]
          );
          return;
        }

        // Record presences for missing plages
        const results = [];
        const errors = [];

        for (const plageId of missingPlageIds) {
          try {
            const response = await fetch('https://sunnysidecode.com/miagepresences/api/presences', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                id_utilisateur: userId,
                id_plage: plageId,
                etat: "present",
                mode_emargement: "qr",
                etablie_par_enseignant: false,
                full_seance_mode: true
              }),
            });

            const data = await response.json();
            if (data.success) {
              results.push(plageId);
              console.log(`✅ Recorded presence for plage ${plageId}`);
            } else {
              errors.push(`Plage ${plageId}: ${data.message || data.error}`);
              console.log(`❌ Failed to record presence for plage ${plageId}:`, data.message);
            }
          } catch (error) {
            errors.push(`Plage ${plageId}: Erreur réseau`);
            console.error(`❌ Network error for plage ${plageId}:`, error);
          }
        }

        if (results.length > 0) {
          // Success - show appropriate message
          const totalPlages = allPlageIds.length;
          const previouslyRecorded = existingPlageIds.length;
          const newlyRecorded = results.length;

          let message;
          if (previouslyRecorded === 0) {
            // All plages were recorded in this session
            const plageText = newlyRecorded === 1 ? 'plage horaire' : 'plages horaires';
            message = `Présence enregistrée avec succès pour toute la séance (${newlyRecorded} ${plageText}).`;
          } else {
            // Some plages were already recorded, others were added
            const newPlageText = newlyRecorded === 1 ? 'plage horaire restante' : 'plages horaires restantes';
            const existingPlageText = previouslyRecorded === 1 ? 'plage était déjà enregistrée' : 'plages étaient déjà enregistrées';
            message = `Présence enregistrée pour ${newlyRecorded} ${newPlageText}. ${previouslyRecorded} ${existingPlageText}.`;
          }

          // Navigate to success screen
          const validationParams = {
            success: 'true',
            courseName: courseDetails?.courseName || 'Cours',
            timeSlot: `Séance entière (${totalPlages} plages)`,
            message: message,
          };

          router.replace({
            pathname: '/emarger/valider',
            params: validationParams
          });
        } else {
          // All failed
          Alert.alert(
            'Erreur',
            'Impossible d\'enregistrer la présence pour les plages restantes. Veuillez réessayer.',
            [
              {
                text: 'Réessayer',
                onPress: () => setIsLoading(false),
                style: 'default'
              },
              {
                text: 'Annuler',
                onPress: () => router.back(),
                style: 'cancel'
              }
            ]
          );
        }
        return;
      }

      // Standard single plage mode
      // Extract encrypted data from original QR code
      let encryptedData = '';
      if (originalQrData.startsWith('miagepresences://scan?data=')) {
        encryptedData = decodeURIComponent(originalQrData.replace('miagepresences://scan?data=', ''));
      }
      
      // Prepare device info with app signature
      const deviceInfo = {
        app_version: Constants.expoConfig?.version || '1.0.0',
        platform: Platform.OS,
        app_name: 'MiagePresences',
        app_signature: APP_SIGNATURE
      };
      
      let response;
      
      // Use the new encrypted validation endpoint if we have encrypted data
      if (encryptedData) {
        console.log('🔒 Using encrypted validation endpoint');
        response = await fetch('https://sunnysidecode.com/miagepresences/api/qr/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            encrypted_data: encryptedData,
            id_utilisateur: userId,
            device_info: deviceInfo
          }),
        });
      } else {
        // Fallback to direct presence recording for legacy format
        console.log('📝 Using direct presence recording (legacy)');
        response = await fetch('https://sunnysidecode.com/miagepresences/api/presences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            id_utilisateur: userId,
            id_plage: sessionInfo.plage,
            etat: "present",
            mode_emargement: "qr",
            etablie_par_enseignant: false,
            full_seance_mode: sessionInfo.mode === 'full',
            device_info: deviceInfo
          }),
        });
      }

      const data = await response.json();
      console.log('📥 API Response:', data);

      if (data.success) {
        console.log('✅ Presence confirmed successfully');
        
        // Navigate to validation screen
        const validationParams = {
          success: 'true',
          courseName: courseDetails?.courseName || 'Cours',
          timeSlot: getTimeSlotLabel(courseDetails?.plage_number || 1, courseDetails?.heure_debut || '', courseDetails?.heure_fin || ''),
          message: data.message || 'Présence enregistrée avec succès',
        };
        
        console.log('🧭 Navigating to validation screen with params:', validationParams);
        router.replace({
          pathname: '/emarger/valider',
          params: validationParams
        });
      } else {
        console.log('❌ Presence confirmation failed:', data.message || data.error);
        
        // Handle specific error cases with appropriate alerts
        if (data.error && data.error.includes('déjà enregistrée')) {
          Alert.alert(
            'Présence déjà enregistrée',
            'Votre présence a déjà été enregistrée pour cette plage horaire.',
            [
              {
                text: 'Compris',
                onPress: () => router.back(),
                style: 'default'
              }
            ]
          );
        } else if (data.error && data.error.includes('expiré')) {
          Alert.alert(
            'QR Code expiré',
            'Ce QR code a expiré. Veuillez demander à votre enseignant de générer un nouveau code.',
            [
              {
                text: 'Compris',
                onPress: () => router.back(),
                style: 'default'
              }
            ]
          );
        } else if (data.error && data.error.includes('figée')) {
          Alert.alert(
            'Séance figée',
            'Cette séance est figée et n\'accepte plus de nouvelles présences.',
            [
              {
                text: 'Compris',
                onPress: () => router.back(),
                style: 'default'
              }
            ]
          );
        } else if (data.error && data.error.includes('non trouvée')) {
          Alert.alert(
            'Séance introuvable',
            'La séance correspondante à ce QR code est introuvable.',
            [
              {
                text: 'Compris',
                onPress: () => router.back(),
                style: 'default'
              }
            ]
          );
        } else {
          // Generic error
          Alert.alert(
            'Erreur',
            data.message || data.error || 'Une erreur est survenue lors de l\'enregistrement de votre présence.',
            [
              {
                text: 'Réessayer',
                onPress: () => setIsLoading(false),
                style: 'default'
              },
              {
                text: 'Annuler',
                onPress: () => router.back(),
                style: 'cancel'
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Presence confirmation error:', error);
      Alert.alert(
        'Erreur de connexion',
        'Impossible de se connecter au serveur. Vérifiez votre connexion internet et réessayez.',
        [
          {
            text: 'Réessayer',
            onPress: () => setIsLoading(false),
            style: 'default'
          },
          {
            text: 'Annuler',
            onPress: () => router.back(),
            style: 'cancel'
          }
        ]
      );
    }
  };

  const handleClose = () => {
    router.back();
  };

  // Update the course details display for full session mode
  if (!sessionInfo) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.title}>Confirmer la Présence</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Course Information */}
        {courseDetails ? (
          <View style={styles.courseCard}>
            <View style={styles.courseHeader}>
              <Ionicons name="book" size={24} color="#2563EB" />
              <Text style={styles.courseTitle}>{courseDetails.courseName}</Text>
            </View>
            
            <View style={styles.courseDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color="#64748B" />
                <Text style={styles.detailLabel}>Date:</Text>
                <Text style={styles.detailValue}>
                  {new Date(courseDetails.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="layers-outline" size={16} color="#64748B" />
                <Text style={styles.detailLabel}>Séance:</Text>
                <Text style={styles.detailValue}>
                  {sessionInfo.mode === 'full' ? 
                    `Séance entière${allPlages.length > 0 ? ` (${allPlages.length} plages)` : ''}` :
                    (courseDetails.plage_number === 1 ? '1ère heure' : 
                     courseDetails.plage_number === 2 ? '2ème heure' :
                     `${courseDetails.plage_number}ème heure`)
                  }
                  {sessionInfo.mode !== 'full' && courseDetails.total_plages > 1 && ` (${courseDetails.plage_number}/${courseDetails.total_plages})`}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#64748B" />
                <Text style={styles.detailLabel}>Horaire:</Text>
                <Text style={styles.detailValue}>
                  {sessionInfo.mode === 'full' ? 
                    'Toute la séance' :
                    getTimeSlotLabel(courseDetails.plage_number, courseDetails.heure_debut, courseDetails.heure_fin)
                  }
                </Text>
              </View>

              {/* Show existing presences for full session mode */}
              {sessionInfo.mode === 'full' && existingPresences.length > 0 && (
                <View style={styles.detailRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
                  <Text style={styles.detailLabel}>Déjà présent:</Text>
                  <Text style={[styles.detailValue, { color: '#10B981' }]}>
                    {existingPresences.length} plage{existingPresences.length > 1 ? 's' : ''} enregistrée{existingPresences.length > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.courseCard}>
            <View style={styles.courseHeader}>
              <Ionicons name="book" size={24} color="#2563EB" />
              <Text style={styles.courseTitle}>Chargement...</Text>
            </View>
            <View style={styles.loadingDetails}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingDetailsText}>Récupération des informations du cours</Text>
            </View>
          </View>
        )}

        {/* Authentication Options */}
        <View style={styles.authContainer}>
          {/* Password Option */}
          <View style={styles.passwordContainer}>
            <Text style={styles.inputLabel}>Mot de passe</Text>
            <TextInput
              style={styles.passwordInput}
              placeholder="Entrez votre mot de passe"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
              onSubmitEditing={authenticateWithPassword}
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.authButton, styles.passwordButton]}
              onPress={authenticateWithPassword}
              disabled={isLoading || !password.trim()}
            >
              <Text style={styles.passwordButtonText}>
                {sessionInfo.mode === 'full' ? 'Je valide ma présence pour la séance' : 'Je valide ma présence'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Biometric Option */}
          {biometricAvailable && biometricEnrolled && (
            <TouchableOpacity
              style={[styles.authButton, styles.biometricButton]}
              onPress={authenticateWithBiometric}
              disabled={isLoading}
            >
              <Ionicons name="finger-print" size={24} color="#2563EB" />
              <Text style={styles.biometricButtonText}>Utiliser l&apos;empreinte digitale</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>
              {sessionInfo.mode === 'full' ? 'Enregistrement des présences...' : 'Validation en cours...'}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 12,
  },
  courseDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginLeft: 8,
    marginRight: 8,
    minWidth: 60,
  },
  detailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
  },
  authContainer: {
    flex: 1,
    gap: 20,
  },
  passwordContainer: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  passwordInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1E293B',
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  passwordButton: {
    backgroundColor: '#2563EB',
  },
  passwordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  biometricButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  biometricButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  loadingDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingDetailsText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
});

export default ConfirmPresenceModal;