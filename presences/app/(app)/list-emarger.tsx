import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSession } from '../../Session/ctx';
import { useStorageState } from '../../Session/useStorageState';

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

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeRange(start: string, end: string) {
  if (!start || !end) return '';
  return `${start.slice(11, 16)} – ${end.slice(11, 16)}`;
}

export default function ListEmargerScreen() {
  const { user } = useSession();
  const [[, authToken]] = useStorageState('authToken');
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [presencesBySession, setPresencesBySession] = useState<{ [sessionId: string]: any[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Extracted fetch logic for reuse
  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch all students
      const studentsRes = await fetch('https://sunnysidecode.com/miagepresences/api/etudiants', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      let studentsData: any[] = [];
      if (studentsRes.ok) {
        const data = await studentsRes.json();
        studentsData = data.data || [];
        setStudents(studentsData);
      } else {
        setStudents([]);
        setError('Erreur lors de la récupération des étudiants');
      }

      // 2. Fetch upcoming sessions for this enseignant
      const sessionsRes = await fetch('https://sunnysidecode.com/miagepresences/api/seances', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      let teacherSessions: any[] = [];
      if (sessionsRes.ok) {
        const result = await sessionsRes.json();
        const seancesData = result.data || result;
        if (user) {
          const teacherId = parseInt(user.id_utilisateur);
          // Force filter for July 4th, 2025
          const targetDate = new Date('2025-07-04');
          targetDate.setHours(0, 0, 0, 0);
          teacherSessions = seancesData.filter((s: any) => {
            const sessionDate = new Date(s.date);
            sessionDate.setHours(0, 0, 0, 0);
            return parseInt(s.enseignant_id) === teacherId && sessionDate.getTime() === targetDate.getTime();
          });
          teacherSessions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
        setSessions(teacherSessions);
      } else {
        setSessions([]);
        setError('Erreur lors de la récupération des sessions');
      }

      // 3. For each session, fetch presences
      const presencesObj: { [sessionId: string]: any[] } = {};
      for (const session of teacherSessions) {
        try {
          const presRes = await fetch(`https://sunnysidecode.com/miagepresences/api/presences/seance/${session.id_seance}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          });
          if (presRes.ok) {
            const data = await presRes.json();
            presencesObj[session.id_seance] = data.presences || [];
          } else {
            presencesObj[session.id_seance] = [];
          }
        } catch {
          presencesObj[session.id_seance] = [];
        }
      }
      setPresencesBySession(presencesObj);
    } catch (err) {
      setError('Erreur réseau lors de la récupération des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authToken || !user || user.role !== 'enseignant') return;
    fetchAll();
  }, [authToken, user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const generatePDF = async () => {
    if (!user || sessions.length === 0) return;
    
    setDownloading(true);
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Liste des Présences - ${user.prenom} ${user.nom}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563EB; padding-bottom: 10px; }
            .teacher-info { margin-bottom: 20px; }
            .session-section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            .session-title { font-size: 18px; font-weight: bold; color: #2563EB; margin-bottom: 10px; }
            .session-details { margin-bottom: 15px; color: #666; }
            .students-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .students-table th, .students-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .students-table th { background-color: #f8f9fa; font-weight: bold; }
            .status-present { color: #28a745; font-weight: bold; }
            .status-absent { color: #dc3545; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            .stats { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .stat-item { text-align: center; }
            .stat-number { font-size: 20px; font-weight: bold; }
            .stat-label { font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Liste des Présences par Session</h1>
            <h2>Enseignant: ${user.prenom} ${user.nom}</h2>
          </div>
          
          <div class="teacher-info">
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Date de génération:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
            <p><strong>Nombre total d'étudiants:</strong> ${students.length}</p>
          </div>
          
          ${sessions.map(session => {
            const sessionPresences = presencesBySession[session.id_seance] || [];
            const presentStudents = sessionPresences.filter((p: any) => p.etat === 'present');
            const absentStudents = students.filter(student => 
              !sessionPresences.find((p: any) => p.id_utilisateur === student.id_utilisateur && p.etat === 'present')
            );
            
            return `
              <div class="session-section">
                <div class="session-title">${session.cours_nom}</div>
                <div class="session-details">
                  <p><strong>Date:</strong> ${formatDate(session.date)}</p>
                  <p><strong>Heure:</strong> ${formatTimeRange(session.heure_debut, session.heure_fin)}</p>
                </div>
                
                <div class="stats">
                  <div class="stat-item">
                    <div class="stat-number">${students.length}</div>
                    <div class="stat-label">Total</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-number status-present">${presentStudents.length}</div>
                    <div class="stat-label">Présents</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-number status-absent">${absentStudents.length}</div>
                    <div class="stat-label">Absents</div>
                  </div>
                </div>
                
                <table class="students-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Prénom</th>
                      <th>Formation</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${students.map(student => {
                      const presence = sessionPresences.find((p: any) => p.id_utilisateur === student.id_utilisateur);
                      const isPresent = presence && presence.etat === 'present';
                      return `
                        <tr>
                          <td>${student.nom}</td>
                          <td>${student.prenom}</td>
                          <td>${student.formation_intitule || 'Non spécifié'}</td>
                          <td class="${isPresent ? 'status-present' : 'status-absent'}">
                            ${isPresent ? 'PRÉSENT' : 'ABSENT'}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
          
          <div class="footer">
            <p>Document généré automatiquement par l'application MIAGE Presences</p>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Télécharger la liste des présences',
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (user?.role !== 'enseignant') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Accès refusé : réservé aux enseignants.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
      }
    >
      <Text style={styles.title}>Émargement des étudiants par session</Text>
      
      {/* Download PDF Button */}
      {sessions.length > 0 && (
        <View style={styles.downloadCard}>
          <TouchableOpacity 
            style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]} 
            onPress={generatePDF}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" style={styles.buttonIcon} />
            ) : (
              <Ionicons name="download-outline" size={20} color="#fff" style={styles.buttonIcon} />
            )}
            <Text style={styles.downloadButtonText}>
              {downloading ? 'Génération...' : 'Télécharger PDF'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : sessions.length === 0 ? (
        <Text style={styles.text}>Aucune session à venir.</Text>
      ) : (
        sessions.map((session) => (
          <View key={session.id_seance} style={styles.sessionSection}>
            <Text style={styles.sessionTitle}>{session.cours_nom}</Text>
            <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
            <Text style={styles.sessionTime}>{formatTimeRange(session.heure_debut, session.heure_fin)}</Text>
            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>Étudiants ({students.length})</Text>
              {students.map((student) => {
                const presence = (presencesBySession[session.id_seance] || []).find((p) => p.id_utilisateur === student.id_utilisateur);
                const isEmarge = presence && presence.etat === 'present';
                return (
                  <View key={student.id_utilisateur} style={styles.studentRow}>
                    <Text style={styles.studentName}>{student.prenom} {student.nom}</Text>
                    <Text style={styles.studentClass}>{student.formation_intitule || 'Classe inconnue'}</Text>
                    <Text style={[styles.status, isEmarge && styles.present]}>{isEmarge ? 'Émargé' : ''}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: COLORS.primary,
    textAlign: 'center',
  },
  sessionSection: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 14,
    color: COLORS.secondary,
    marginBottom: 2,
  },
  sessionTime: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  listContainer: {
    width: '100%',
    marginTop: 8,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: COLORS.text,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
    flex: 2,
  },
  studentClass: {
    fontSize: 13,
    color: COLORS.secondary,
    flex: 1,
    textAlign: 'center',
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  present: {
    color: COLORS.success,
  },
  absent: {
    color: COLORS.error,
  },
  notSigned: {
    color: COLORS.warning,
  },
  errorText: {
    color: COLORS.error,
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  text: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  downloadCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  downloadButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  buttonIcon: {
    marginRight: 8,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
}); 