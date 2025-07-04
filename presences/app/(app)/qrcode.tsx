import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import { useSession } from '../../Session/ctx';
import { useStorageState } from '../../Session/useStorageState';

// Color palette matching index.tsx
const COLORS = {
  primary: '#2563EB',
  secondary: '#64748B',
  background: '#F8FAFC',
  white: '#FFFFFF',
  border: '#E2E8F0',
  text: '#1E293B',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

type Session = {
  id_seance: number;
  cours_nom: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  enseignant_id: number;
  enseignant_nom: string;
  enseignant_prenom: string;
  id_cours: number;
};

function formatTimeRange(start: string, end: string) {
  if (!start || !end) return '';
  return `${start.slice(11, 16)} – ${end.slice(11, 16)}`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function formatDateShort(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

export default function TeacherQRCodeScreen() {
  const { user } = useSession();
  const [[, authToken]] = useStorageState('authToken');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedPlage, setSelectedPlage] = useState<string>('full'); // 'full' or plage number
  const [selectedDuration, setSelectedDuration] = useState<number>(15); // Default 15 minutes
  const [qrData, setQrData] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [sessionPlages, setSessionPlages] = useState<any[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Available duration options (10-30 minutes)
  const durationOptions = [10, 15, 20, 25, 30];

  // Fetch sessions data
  useEffect(() => {
    if (!authToken) return;
    
    const fetchSessionsData = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://sunnysidecode.com/miagepresences/api/seances', {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const seancesData = result.data || result;
          
          console.log('All sessions from API:', seancesData.length);
          console.log('User info:', user);
          
          // Filter for sessions on July 4th, 2025 ONLY
          const targetDate = new Date('2025-07-04');
          targetDate.setHours(0, 0, 0, 0); // Start of target date
          const sessionsForJuly4 = seancesData.filter((s: any) => {
            const sessionDate = new Date(s.date);
            sessionDate.setHours(0, 0, 0, 0);
            return sessionDate.getTime() === targetDate.getTime();
          });
          
          console.log('Sessions for July 4th, 2025:', sessionsForJuly4.length);
          
          // If user is a teacher, filter for their sessions
          let teacherSessions = sessionsForJuly4;
          if (user && user.role === 'enseignant') {
            teacherSessions = sessionsForJuly4.filter((s: any) => {
              // Convert both to numbers for comparison
              const teacherId = parseInt(user.id_utilisateur);
              const sessionTeacherId = parseInt(s.enseignant_id);
              return teacherId === sessionTeacherId;
            });
            console.log('Teacher sessions:', teacherSessions.length);
          }
          
          // Sort by date
          teacherSessions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          setSessions(teacherSessions);
          console.log('Final sessions to display:', teacherSessions.length);
          
          // Auto-select first session if available
          if (teacherSessions.length > 0 && !selectedSession) {
            setSelectedSession(teacherSessions[0]);
            console.log('Auto-selected session:', teacherSessions[0]);
          }
          
          // Reset plage selection when sessions change
          setSelectedPlage('full');
          setQrData(null); // Clear existing QR data
          setExpiresAt(null); // Clear expiration
          setCountdown(0); // Reset countdown
          setSessionPlages([]); // Clear session plages
        } else {
          setError('Erreur lors de la récupération des sessions');
        }
      } catch (err) {
        setError('Erreur réseau lors de la récupération des sessions');
        console.error('Error fetching sessions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionsData();
  }, [authToken, user]);

  // Fetch plage data when session changes
  useEffect(() => {
    if (selectedSession && authToken) {
      fetchSessionPlages();
    }
  }, [selectedSession, authToken]);

  // Fetch plage data for a session
  const fetchSessionPlages = async () => {
    if (!authToken || !selectedSession) return;
    try {
      console.log('Fetching plage data for session:', selectedSession.id_seance);
      // Get plage data from the session QR endpoint
      const response = await fetch(`https://sunnysidecode.com/miagepresences/api/qr/session/${selectedSession.id_seance}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Session plage data:', data);
        if (data.success && data.data && data.data.plages_horaires) {
          setSessionPlages(
            data.data.plages_horaires.map((plage: any, idx: number) => ({
              ...plage,
              plage_number: idx + 1,
              timeSlot: `${plage.heure_debut} - ${plage.heure_fin}`
            }))
          );
        } else {
          setSessionPlages([]);
        }
      } else {
        setSessionPlages([]);
      }
    } catch (error) {
      console.error('Error fetching session plages:', error);
      setSessionPlages([]);
    }
  };

  // Generate QR code when session, plage, or duration is selected
  useEffect(() => {
    if (selectedSession && authToken) {
      generateQr();
    }
  }, [selectedSession, selectedPlage, selectedDuration, authToken]);

  // Generate QR code
  const generateQr = async () => {
    if (!authToken || !selectedSession) return;
    setLoading(true);
    setError('');
    
    try {
      console.log('Generating QR for session:', selectedSession.id_seance, 'plage:', selectedPlage, 'duration:', selectedDuration);
      
      const requestBody: any = {
        id_seance: selectedSession.id_seance,
        expires_in: `${selectedDuration}m`, // Use selected duration in minutes
        full_seance_mode: selectedPlage === 'full',
      };
      
      // If specific plage is selected, add id_plage to request
      if (selectedPlage !== 'full') {
        // Find the selected plage from sessionPlages
        const selectedPlageData = sessionPlages.find(p => p.plage_number.toString() === selectedPlage);
        if (selectedPlageData) {
          requestBody.id_plage = selectedPlageData.id_plage;
        } else {
          // Fallback: calculate plage ID based on selected plage number
          const basePlageId = 700; // Fallback base plage ID
          const plageId = basePlageId + parseInt(selectedPlage);
          requestBody.id_plage = plageId;
        }
      }
      
      const res = await fetch('https://sunnysidecode.com/miagepresences/api/qr/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('QR generation response status:', res.status);
      const data = await res.json();
      console.log('QR generation response:', data);
      
      if (data.success && data.data && data.data.qr_codes && data.data.qr_codes[0]) {
        const qrCode = data.data.qr_codes[0];
        
        // The qr_data is already a JSON string from the backend
        setQrData(qrCode.qr_data);
        
        // Calculate expiration time based on selected duration
        const expirationTime = new Date(Date.now() + selectedDuration * 60 * 1000).toISOString();
        setExpiresAt(expirationTime);
        setCountdown(selectedDuration * 60);
        
        console.log('QR code generated successfully:', qrCode.qr_data);
        console.log('QR code expiration set to:', expirationTime);
      } else {
        setError(data.message || 'Erreur lors de la génération du QR code');
        console.error('QR generation failed:', data);
      }
    } catch (e) {
      setError('Erreur réseau lors de la génération du QR code');
      console.error('QR generation error:', e);
    }
    setLoading(false);
  };

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 1000));
      setCountdown(diff);
      if (diff <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt]);

  if (loading && sessions.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Chargement des sessions...</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Check if user is a teacher
  if (user && user.role !== 'enseignant') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Accès réservé aux enseignants</Text>
            <Text style={styles.errorText}>Seuls les enseignants peuvent générer des QR codes</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (sessions.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Aucune session à venir</Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>QR Code de Présence</Text>
          <Text style={styles.subtitle}>Générez des QR codes pour vos étudiants</Text>
        </View>

        {/* Session Selector */}
        <View style={styles.sessionSelector}>
          <Text style={styles.selectorLabel}>Sélectionner une session</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionsScroll}>
            {sessions.map((session) => (
              <TouchableOpacity
                key={session.id_seance}
                style={[
                  styles.sessionOption,
                  selectedSession?.id_seance === session.id_seance && styles.selectedSessionOption
                ]}
                onPress={() => {
                  setSelectedSession(session);
                  setSelectedPlage('full'); // Reset plage selection when changing sessions
                  setQrData(null); // Clear existing QR data
                  setExpiresAt(null); // Clear expiration
                  setCountdown(0); // Reset countdown
                  setSessionPlages([]); // Clear session plages
                }}
              >
                <Text style={[
                  styles.sessionOptionCourse,
                  selectedSession?.id_seance === session.id_seance && styles.selectedSessionText
                ]}>
                  {session.cours_nom}
                </Text>
                <Text style={[
                  styles.sessionOptionDate,
                  selectedSession?.id_seance === session.id_seance && styles.selectedSessionText
                ]}>
                  {formatDateShort(session.date)}
                </Text>
                <Text style={[
                  styles.sessionOptionTime,
                  selectedSession?.id_seance === session.id_seance && styles.selectedSessionText
                ]}>
                  {formatTimeRange(session.heure_debut, session.heure_fin)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Session Info Card */}
        {selectedSession && (
          <View style={styles.sessionCard}>
            <Text style={styles.courseName}>{selectedSession.cours_nom}</Text>
            <Text style={styles.sessionDate}>{formatDate(selectedSession.date)}</Text>
            <Text style={styles.sessionTime}>
              {formatTimeRange(selectedSession.heure_debut, selectedSession.heure_fin)}
            </Text>
            <Text style={styles.teacherInfo}>
              Enseignant: {selectedSession.enseignant_prenom} {selectedSession.enseignant_nom}
            </Text>
            <Text style={styles.sessionId}>Session ID: {selectedSession.id_seance}</Text>
          </View>
        )}

        {/* Duration Selector */}
        {selectedSession && (
          <View style={styles.durationSelector}>
            <Text style={styles.selectorLabel}>Durée de validité du QR code</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.durationScroll}>
              {durationOptions.map((duration) => (
                <TouchableOpacity
                  key={duration}
                  style={[
                    styles.durationOption,
                    selectedDuration === duration && styles.selectedDurationOption
                  ]}
                  onPress={() => setSelectedDuration(duration)}
                >
                  <Text style={[
                    styles.durationOptionText,
                    selectedDuration === duration && styles.selectedDurationText
                  ]}>
                    {duration} min
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Plage Selector */}
        {selectedSession && (
          <View style={styles.plageSelector}>
            <Text style={styles.selectorLabel}>Sélectionner une plage horaire</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.plageScroll}>
              {/* Full Session Option */}
              <TouchableOpacity
                style={[
                  styles.plageOption,
                  selectedPlage === 'full' && styles.selectedPlageOption
                ]}
                onPress={() => setSelectedPlage('full')}
              >
                <Text style={[
                  styles.plageOptionText,
                  selectedPlage === 'full' && styles.selectedPlageText
                ]}>
                  Séance entière
                </Text>
              </TouchableOpacity>
              
              {/* Individual Plage Options */}
              {sessionPlages.map((plage) => (
                <TouchableOpacity
                  key={plage.plage_number}
                  style={[
                    styles.plageOption,
                    selectedPlage === plage.plage_number.toString() && styles.selectedPlageOption
                  ]}
                  onPress={() => setSelectedPlage(plage.plage_number.toString())}
                >
                  <Text style={[
                    styles.plageOptionText,
                    selectedPlage === plage.plage_number.toString() && styles.selectedPlageText
                  ]}>
                    {plage.plage_number === 1 ? '1ère heure' : `${plage.plage_number}ème heure`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* QR Code */}
        <View style={styles.qrContainer}>
          {qrData ? (
            <View style={styles.qrCodeContainer}>
              <QRCodeSVG
                value={qrData}
                size={260}
                backgroundColor={COLORS.white}
                color={COLORS.text}
                ecl="H"
              />
            </View>
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>
                {loading ? 'Génération...' : 'QR Code'}
              </Text>
            </View>
          )}
          
          {/* Status and Refresh */}
          <View style={styles.statusContainer}>
            <View style={styles.statusIndicator}>
              <View style={[
                styles.statusDot, 
                { backgroundColor: countdown > 0 ? COLORS.success : COLORS.error }
              ]} />
              <Text style={[
                styles.statusText,
                { color: countdown > 0 ? COLORS.success : COLORS.error }
              ]}>
                {countdown > 0 ? 
                  `Valide : ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}` : 
                  'Expiré'
                }
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={generateQr}
              disabled={loading}
            >
              <Text style={styles.refreshButtonText}>🔄 Rafraîchir</Text>
            </TouchableOpacity>
          </View>
          
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}
          
          
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <Text style={styles.instructionsText}>
            Sélectionnez une plage horaire et une durée de validité ci-dessus, puis les étudiants scanneront ce QR code avec l&apos;application pour enregistrer leur présence.
            {'\n'}
            Le code expire automatiquement après {selectedDuration} minute{selectedDuration > 1 ? 's' : ''}.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: COLORS.white,
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.secondary,
    textAlign: 'center',
  },
  sessionSelector: {
    marginBottom: 24,
  },
  durationSelector: {
    marginBottom: 24,
  },
  plageSelector: {
    marginBottom: 24,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  sessionsScroll: {
    flexDirection: 'row',
  },
  durationScroll: {
    flexDirection: 'row',
  },
  plageScroll: {
    flexDirection: 'row',
  },
  sessionOption: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  selectedSessionOption: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sessionOptionCourse: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  selectedSessionText: {
    color: COLORS.white,
  },
  sessionOptionDate: {
    fontSize: 12,
    color: COLORS.secondary,
    marginBottom: 2,
  },
  sessionOptionTime: {
    fontSize: 12,
    color: COLORS.secondary,
  },
  durationOption: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 80,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  selectedDurationOption: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  durationOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectedDurationText: {
    color: COLORS.white,
  },
  plageOption: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  selectedPlageOption: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  plageOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  selectedPlageText: {
    color: COLORS.white,
  },
  sessionCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  courseName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 16,
    color: COLORS.secondary,
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  teacherInfo: {
    fontSize: 14,
    color: COLORS.secondary,
    marginBottom: 4,
  },
  sessionId: {
    fontSize: 12,
    color: COLORS.secondary,
    fontFamily: 'monospace',
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  qrCodeContainer: {
    width: 280,
    height: 280,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 8,
  },
  qrPlaceholder: {
    width: 280,
    height: 280,
    backgroundColor: COLORS.border,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholderText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    width: '100%',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 16,
  },
  refreshButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  refreshButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    color: COLORS.error,
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  tokenContainer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  tokenText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  instructionsContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 18,
    color: COLORS.secondary,
    textAlign: 'center',
  },
});
