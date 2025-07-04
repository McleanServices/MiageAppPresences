import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
}); 