import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ValiderScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const isSuccess = params.success === 'true';
  const courseName = params.courseName as string || 'Cours';
  const timeSlot = params.timeSlot as string || '';
  const message = params.message as string || 'Validation réussie';

  const handleGoHome = () => {
    router.replace('/');
  };

  const handleScanAgain = () => {
    router.replace('/emarger/camera');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons 
              name={isSuccess ? "checkmark-circle" : "alert-circle"} 
              size={80} 
              color={isSuccess ? "#10B981" : "#EF4444"} 
            />
          </View>
        </View>

        {/* Status Title */}
        <Text style={styles.title}>
          {isSuccess ? 'Présence Enregistrée !' : 'Erreur'}
        </Text>

        {/* Message */}
        <Text style={styles.message}>
          {message}
        </Text>

        {/* Course Information */}
        {isSuccess && (
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="book-outline" size={20} color="#64748B" />
              <Text style={styles.infoLabel}>Cours:</Text>
              <Text style={styles.infoValue}>{courseName}</Text>
            </View>
            
            {timeSlot && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color="#64748B" />
                <Text style={styles.infoLabel}>Horaire:</Text>
                <Text style={styles.infoValue}>{timeSlot}</Text>
              </View>
            )}
            
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color="#64748B" />
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>
                {new Date().toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>
            {isSuccess ? 'Que faire maintenant ?' : 'Que faire ?'}
          </Text>
          <Text style={styles.instructionsText}>
            {isSuccess 
              ? 'Votre présence a été enregistrée avec succès. Vous pouvez maintenant retourner à l\'accueil ou scanner un autre QR code.'
              : 'Une erreur s\'est produite lors de la validation. Veuillez réessayer ou contacter votre enseignant.'
            }
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={handleGoHome}
          >
            <Ionicons name="home-outline" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Retour à l&apos;accueil</Text>
          </TouchableOpacity>

          {isSuccess && (
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={handleScanAgain}
            >
              <Ionicons name="qr-code-outline" size={20} color="#2563EB" />
              <Text style={styles.secondaryButtonText}>Scanner un autre QR</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
    minHeight: '100%',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  infoContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 8,
    marginRight: 8,
    minWidth: 60,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
  },
  instructionsContainer: {
    marginBottom: 32,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ValiderScreen;
