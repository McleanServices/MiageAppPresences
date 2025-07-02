import { ExtensionStorage } from '@bacons/apple-targets';
import { Ionicons } from '@expo/vector-icons';
import { eachDayOfInterval, endOfWeek, format, isSameDay, isToday, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as BackgroundTask from 'expo-background-task';
import * as SplashScreen from 'expo-splash-screen';
import { useSQLiteContext } from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { useSession } from '../../Session/ctx';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

// Mock data - replace with actual API call
const mockSeances = [
  {
    "id_seance": 1344,
    "date": "2025-01-20T00:00:00.000Z",
    "heure_debut": "1970-01-01T08:00:00.000Z",
    "heure_fin": "1970-01-01T12:00:00.000Z",
    "statut": null,
    "est_figee": null,
    "id_cours": 137,
    "cours_nom": "ANGLAIS",
    "cours_description": null,
    "cours_modules": null,
    "enseignant_id": 165,
    "enseignant_nom": "C",
    "enseignant_prenom": "Marcin",
    "enseignant_email": "enseignant_165@gmail.com",
    "matricule_enseignant": null,
    "matiere_principale": null,
    "role_dans_le_cours": null
  },
  {
    "id_seance": 1345,
    "date": "2025-01-20T00:00:00.000Z",
    "heure_debut": "1970-01-01T14:00:00.000Z",
    "heure_fin": "1970-01-01T18:00:00.000Z",
    "statut": null,
    "est_figee": null,
    "id_cours": 138,
    "cours_nom": "MATHÉMATIQUES",
    "cours_description": null,
    "cours_modules": null,
    "enseignant_id": 166,
    "enseignant_nom": "D",
    "enseignant_prenom": "Sophie",
    "enseignant_email": "enseignant_166@gmail.com",
    "matricule_enseignant": null,
    "matiere_principale": null,
    "role_dans_le_cours": null
  },
  {
    "id_seance": 1346,
    "date": "2025-01-21T00:00:00.000Z",
    "heure_debut": "1970-01-01T09:00:00.000Z",
    "heure_fin": "1970-01-01T11:00:00.000Z",
    "statut": null,
    "est_figee": null,
    "id_cours": 139,
    "cours_nom": "INFORMATIQUE",
    "cours_description": null,
    "cours_modules": null,
    "enseignant_id": 167,
    "enseignant_nom": "E",
    "enseignant_prenom": "Pierre",
    "enseignant_email": "enseignant_167@gmail.com",
    "matricule_enseignant": null,
    "matiere_principale": null,
    "role_dans_le_cours": null
  }
];

const { width } = Dimensions.get('window');

const BACKGROUND_SYNC_TASK = 'calendar-background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    // Use a separate fetch to avoid using React state/hooks
    const response = await fetch('https://zq2s6rh4-8082.use.devtunnels.ms/api/seances');
    if (response.ok) {
      const result = await response.json();
      const seancesData = result.data || result;
      // Open DB directly
      const db = await require('expo-sqlite').openDatabaseAsync('local.db');
      await db.execAsync('DELETE FROM calendar');
      for (const seance of seancesData) {
        await db.runAsync(
          `INSERT OR REPLACE INTO calendar (
            id_seance, date, heure_debut, heure_fin, statut, est_figee, id_cours, cours_nom, cours_description, cours_modules, enseignant_id, enseignant_nom, enseignant_prenom, enseignant_email, matricule_enseignant, matiere_principale, role_dans_le_cours
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          seance.id_seance,
          seance.date,
          seance.heure_debut,
          seance.heure_fin,
          seance.statut,
          seance.est_figee,
          seance.id_cours,
          seance.cours_nom,
          seance.cours_description,
          seance.cours_modules,
          seance.enseignant_id,
          seance.enseignant_nom,
          seance.enseignant_prenom,
          seance.enseignant_email,
          seance.matricule_enseignant,
          seance.matiere_principale,
          seance.role_dans_le_cours
        );
      }
      // Save last sync date
      const now = new Date().toISOString();
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'lastSync', now);
      
      // Update widget storage with today's seances
      const today = new Date();
      const todayYMD = today.toISOString().slice(0, 10);
      const todaySeances = seancesData.filter((seance: any) => seance.date.slice(0, 10) === todayYMD);
      const { ExtensionStorage } = require('@bacons/apple-targets');
      const widgetStorage = new ExtensionStorage('group.com.presencestyrece.mywidget');
      await widgetStorage.set('today', JSON.stringify(todaySeances));
      ExtensionStorage.reloadWidget();
      
      return;
    } else {
      throw new Error('Failed to fetch data');
    }
  } catch (e) {
    console.error('Background task failed:', e);
    throw e;
  }
});

const widgetStorage = new ExtensionStorage('group.com.presencestyrece.mywidget');

// Save today's seances to widget storage
export async function saveTodayToWidgetStorage(seances: any[]) {
  const today = new Date();
  const todayYMD = today.toISOString().slice(0, 10);
  const todaySeances = seances.filter(seance => seance.date.slice(0, 10) === todayYMD);
  await widgetStorage.set('today', JSON.stringify(todaySeances));
  // Optionally, trigger widget reload
  ExtensionStorage.reloadWidget();
}

export default function Profile() {
  const { signOut, user } = useSession();
  const db = useSQLiteContext();
  const [appIsReady, setAppIsReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [seances, setSeances] = useState<any[]>(mockSeances);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Create table if not exists
  useEffect(() => {
    async function setupDb() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS calendar (
          id_seance INTEGER PRIMARY KEY,
          date TEXT,
          heure_debut TEXT,
          heure_fin TEXT,
          statut TEXT,
          est_figee TEXT,
          id_cours INTEGER,
          cours_nom TEXT,
          cours_description TEXT,
          cours_modules TEXT,
          enseignant_id INTEGER,
          enseignant_nom TEXT,
          enseignant_prenom TEXT,
          enseignant_email TEXT,
          matricule_enseignant TEXT,
          matiere_principale TEXT,
          role_dans_le_cours TEXT
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
    }
    setupDb();
  }, [db]);

  // Load last sync date on mount
  useEffect(() => {
    async function loadLastSync() {
      try {
        const row = await db.getFirstAsync<{ value?: string }>('SELECT value FROM settings WHERE key = ?', 'lastSync');
        if (row && typeof row.value === 'string') setLastSync(row.value);
      } catch {}
    }
    loadLastSync();
  }, [db]);

  // Poll for updates every 1 hour while app is active
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSeances(); // Silent sync without toast
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        // Fetch seances from API
        await fetchSeances();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const fetchSeances = async (showToast = false) => {
    let success = false;
    try {
      const response = await fetch('https://sunnysidecode.com/miagepresences/api/seances');
      if (response.ok) {
        const result = await response.json();
        const seancesData = result.data || result;
        setSeances(Array.isArray(seancesData) ? seancesData : mockSeances);
        await saveTodayToWidgetStorage(Array.isArray(seancesData) ? seancesData : mockSeances);
        // Save to SQLite
        await db.execAsync('DELETE FROM calendar');
        for (const seance of seancesData) {
          await db.runAsync(
            `INSERT OR REPLACE INTO calendar (
              id_seance, date, heure_debut, heure_fin, statut, est_figee, id_cours, cours_nom, cours_description, cours_modules, enseignant_id, enseignant_nom, enseignant_prenom, enseignant_email, matricule_enseignant, matiere_principale, role_dans_le_cours
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            seance.id_seance,
            seance.date,
            seance.heure_debut,
            seance.heure_fin,
            seance.statut,
            seance.est_figee,
            seance.id_cours,
            seance.cours_nom,
            seance.cours_description,
            seance.cours_modules,
            seance.enseignant_id,
            seance.enseignant_nom,
            seance.enseignant_prenom,
            seance.enseignant_email,
            seance.matricule_enseignant,
            seance.matiere_principale,
            seance.role_dans_le_cours
          );
        }
        // Save last sync date
        const now = new Date().toISOString();
        await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'lastSync', now);
        setLastSync(now);
        success = true;
        if (showToast) Toast.show({ type: 'success', text1: 'Calendrier synchronisé', text2: 'Les données ont été mises à jour.' });
      } else {
        await loadSeancesFromDb();
        if (showToast) Toast.show({ type: 'error', text1: 'Erreur de synchronisation', text2: 'Impossible de mettre à jour les données.' });
      }
    } catch (error) {
      await loadSeancesFromDb();
      if (showToast) Toast.show({ type: 'error', text1: 'Erreur de synchronisation', text2: 'Impossible de mettre à jour les données.' });
    } finally {
      setLoading(false);
    }
    return success;
  };

  const loadSeancesFromDb = async () => {
    try {
      const rows = await db.getAllAsync('SELECT * FROM calendar');
      setSeances(rows.length > 0 ? rows : mockSeances);
      console.log('Loaded seances from SQLite:', rows.length);
    } catch (err) {
      setSeances(mockSeances);
    }
  };

  const onLayoutRootView = useCallback(() => {
    if (appIsReady) {
      SplashScreen.hide();
    }
  }, [appIsReady]);

  const getWeekDays = () => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const end = endOfWeek(currentWeek, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const goToPreviousWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() - 7);
    setCurrentWeek(newWeek);
  };

  const goToNextWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + 7);
    setCurrentWeek(newWeek);
  };

  const goToWeekWithData = () => {
    if (seances && seances.length > 0) {
      // Parse the date string properly to avoid timezone issues
      const dateString = seances[0].date;
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
      const firstSeanceDate = new Date(year, month - 1, day); // month is 0-indexed
      setCurrentWeek(firstSeanceDate);
      setSelectedDate(firstSeanceDate);
    }
  };

  const getSeancesForDate = (date: Date) => {
    if (!seances || !Array.isArray(seances)) {
      return [];
    }
    const selectedYMD = date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    return seances.filter(seance => {
      const seanceYMD = seance.date.slice(0, 10); // 'YYYY-MM-DD'
      return seanceYMD === selectedYMD;
    });
  };

  const formatTime = (timeString: string) => {
    // timeString is like "1970-01-01T08:00:00.000Z"
    // Extract the HH:mm part directly
    return timeString.slice(11, 16); // "08:00"
  };

  const getDateLabel = (date: Date) => {
    const today = new Date();
    if (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    ) {
      return "Aujourd'hui";
    }
    return format(date, 'dd/MM');
  };

  const getDayName = (date: Date) => {
    return format(date, 'EEE', { locale: fr });
  };

  // Register background fetch on mount
  useEffect(() => {
    async function registerBackgroundSync() {
      try {
        const status = await BackgroundTask.getStatusAsync();
        if (status === BackgroundTask.BackgroundTaskStatus.Available) {
          // Task is already defined above with TaskManager.defineTask
          await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK);
          console.log('Background sync registered');
        } else {
          console.log('Background task unavailable:', status);
        }
      } catch (error) {
        console.error('Failed to register background task:', error);
      }
    }
    registerBackgroundSync();
  }, []);

  if (!appIsReady) {
    return null;
  }

  const weekDays = getWeekDays();

  return (
    <>
      <View style={styles.container} onLayout={onLayoutRootView}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Bonjour {user?.prenom ? user.prenom : ''} ! 👋
            </Text>
            <Text style={styles.subGreeting}>Prêt pour vos cours aujourd&apos;hui ?</Text>
            {lastSync && (
              <Text style={styles.lastSyncText}>
                Dernière synchronisation : {format(new Date(lastSync), 'dd/MM/yyyy HH:mm', { locale: fr })}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={async () => {
              setLoading(true);
              await fetchSeances(true);
            }}
            disabled={loading}
          >
            <Ionicons name={loading ? 'refresh-circle' : 'refresh'} size={28} color={loading ? '#94A3B8' : '#2563EB'} />
          </TouchableOpacity>
        </View>

        {/* Week Calendar */}
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity style={styles.navButton} onPress={goToPreviousWeek}>
              <Ionicons name="chevron-back" size={24} color="#2563EB" />
            </TouchableOpacity>
            <Text style={styles.monthYear}>
              {format(currentWeek, 'MMMM yyyy', { locale: fr })}
            </Text>
            <TouchableOpacity style={styles.navButton} onPress={goToNextWeek}>
              <Ionicons name="chevron-forward" size={24} color="#2563EB" />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
            {weekDays.map((day, index) => {
              const daySeances = getSeancesForDate(day);
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dayCard, isSelected && styles.selectedDayCard]}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={[styles.dayName, isSelected && styles.selectedDayText]}>
                    {getDayName(day)}
                  </Text>
                  <Text style={[styles.dayNumber, isSelected && styles.selectedDayText]}>
                    {format(day, 'd')}
                  </Text>
                  {daySeances && daySeances.length > 0 && (
                    <View style={[styles.indicator, isSelected && styles.selectedIndicator]}>
                      <Text style={styles.indicatorText}>{daySeances.length}</Text>
                    </View>
                  )}
                  {isTodayDate && !isSelected && <View style={styles.todayIndicator} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Daily Schedule */}
        <View style={styles.scheduleContainer}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleTitle}>
              {getDateLabel(selectedDate)}
            </Text>
            <Text style={styles.scheduleSubtitle}>
              {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </Text>
            <TouchableOpacity onPress={goToWeekWithData} style={styles.navButtonSmall}>
              <Text style={styles.navButtonText}>Voir les cours</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scheduleList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Chargement...</Text>
              </View>
            ) : (getSeancesForDate(selectedDate) || []).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>Aucun cours aujourd&apos;hui</Text>
                <Text style={styles.emptySubtext}>Profitez de votre journée libre !</Text>
              </View>
            ) : (
              (getSeancesForDate(selectedDate) || [])
                .sort((a, b) => new Date(a.heure_debut).getTime() - new Date(b.heure_debut).getTime())
                .map((seance, index) => (
                  <View key={seance.id_seance} style={styles.courseCard}>
                    <View style={styles.courseTime}>
                      <Text style={styles.timeText}>
                        {formatTime(seance.heure_debut)} - {formatTime(seance.heure_fin)}
                      </Text>
                    </View>
                    
                    <View style={styles.courseContent}>
                      <View style={styles.courseHeader}>
                        <Text style={styles.courseName}>{seance.cours_nom}</Text>
                        <View style={styles.courseStatus}>
                          <Ionicons name="time-outline" size={16} color="#64748B" />
                          <Text style={styles.statusText}>À venir</Text>
                        </View>
                      </View>
                      
                      <View style={styles.teacherInfo}>
                        <Ionicons name="person-outline" size={16} color="#64748B" />
                        <Text style={styles.teacherText}>
                          {seance.enseignant_prenom || 'Non renseigné'} {seance.enseignant_nom || ''}
                        </Text>
                      </View>
                      
                      <View style={styles.courseActions}>
                        <TouchableOpacity style={styles.actionButton}>
                          <Ionicons name="location-outline" size={16} color="#2563EB" />
                          <Text style={styles.actionText}>Localisation</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton}>
                          <Ionicons name="mail-outline" size={16} color="#2563EB" />
                          <Text style={styles.actionText}>Contacter</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
            )}
          </ScrollView>
        </View>
      </View>
      <Toast />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subGreeting: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  signOutButton: {
    padding: 8,
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  navButton: {
    padding: 8,
  },
  monthYear: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    textTransform: 'capitalize',
  },
  weekScroll: {
    paddingHorizontal: 10,
  },
  dayCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 80,
    marginHorizontal: 5,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  selectedDayCard: {
    backgroundColor: '#2563EB',
  },
  dayName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 4,
  },
  selectedDayText: {
    color: '#FFFFFF',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  indicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIndicator: {
    backgroundColor: '#FFFFFF',
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  todayIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
  },
  scheduleContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scheduleHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  scheduleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  scheduleSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textTransform: 'capitalize',
  },
  scheduleList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  courseTime: {
    marginBottom: 12,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  courseContent: {
    flex: 1,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  courseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
  },
  courseStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D97706',
    marginLeft: 4,
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teacherText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
  },
  courseActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2563EB',
    marginLeft: 4,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  navButtonSmall: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2563EB',
  },
  refreshButton: {
    padding: 8,
    marginLeft: 10,
  },
  lastSyncText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
});
