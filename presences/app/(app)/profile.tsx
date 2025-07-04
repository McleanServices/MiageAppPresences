import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSession } from '../../Session/ctx';

interface PresenceRecord {
  id_utilisateur: number;
  id_plage: number;
  etat: 'present' | 'absent' | 'retard';
  mode_emargement: string;
  heure_debut: string;
  heure_fin: string;
  date: string;
  cours_nom: string;
}

interface CoursePresence {
  cours_nom: string;
  presences: PresenceRecord[];
  total: number;
  present: number;
  absent: number;
  retard: number;
}

export default function Profile() {
  const { signOut, user } = useSession();
  const [presenceData, setPresenceData] = useState<CoursePresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchPresenceData = async () => {
    try {
      if (!user?.id_utilisateur) return;

      const response = await fetch(
        `https://sunnysidecode.com/miagepresences/api/presences/user/${user.id_utilisateur}?limit=1000`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Group presences by course
          const courseMap = new Map<string, CoursePresence>();
          
          // Remove duplicates based on id_plage and date
          const uniquePresences = data.data.filter((presence: PresenceRecord, index: number, self: PresenceRecord[]) => 
            index === self.findIndex(p => p.id_plage === presence.id_plage && p.date === presence.date)
          );
          
          uniquePresences.forEach((presence: PresenceRecord) => {
            if (!courseMap.has(presence.cours_nom)) {
              courseMap.set(presence.cours_nom, {
                cours_nom: presence.cours_nom,
                presences: [],
                total: 0,
                present: 0,
                absent: 0,
                retard: 0,
              });
            }
            
            const course = courseMap.get(presence.cours_nom)!;
            course.presences.push(presence);
            course.total++;
            
            switch (presence.etat) {
              case 'present':
                course.present++;
                break;
              case 'absent':
                course.absent++;
                break;
              case 'retard':
                course.retard++;
                break;
            }
          });
          
          setPresenceData(Array.from(courseMap.values()));
        }
      }
    } catch (error) {
      console.error('Error fetching presence data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données de présence');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getAuthToken = async () => {
    // Get auth token from SecureStore
    return await SecureStore.getItemAsync('authToken');
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPresenceData();
  };

  const generatePDF = async () => {
    if (!user) return;
    
    setDownloading(true);
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Relevé de Présence - ${user.prenom} ${user.nom}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563EB; padding-bottom: 10px; }
            .student-info { margin-bottom: 20px; }
            .course-section { margin-bottom: 25px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            .course-title { font-size: 18px; font-weight: bold; color: #2563EB; margin-bottom: 10px; }
            .stats { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .stat-item { text-align: center; }
            .stat-number { font-size: 20px; font-weight: bold; }
            .stat-label { font-size: 12px; color: #666; }
            .presence-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .presence-table th, .presence-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .presence-table th { background-color: #f8f9fa; font-weight: bold; }
            .status-present { color: #28a745; font-weight: bold; }
            .status-absent { color: #dc3545; font-weight: bold; }
            .status-retard { color: #ffc107; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Relevé de Présence</h1>
            <h2>${user.prenom} ${user.nom}</h2>
          </div>
          
          <div class="student-info">
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Date de génération:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
          </div>
          
          ${presenceData.map(course => `
            <div class="course-section">
              <div class="course-title">${course.cours_nom}</div>
              <div class="stats">
                <div class="stat-item">
                  <div class="stat-number">${course.total}</div>
                  <div class="stat-label">Total</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number status-present">${course.present}</div>
                  <div class="stat-label">Présences</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number status-absent">${course.absent}</div>
                  <div class="stat-label">Absences</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number status-retard">${course.retard}</div>
                  <div class="stat-label">Retards</div>
                </div>
              </div>
              
              <table class="presence-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Heure</th>
                    <th>Statut</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  ${course.presences.map(presence => `
                    <tr>
                      <td>${new Date(presence.date).toLocaleDateString('fr-FR')}</td>
                      <td>${presence.heure_debut} - ${presence.heure_fin}</td>
                      <td class="status-${presence.etat}">${presence.etat.toUpperCase()}</td>
                      <td>${presence.mode_emargement}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
          
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
          dialogTitle: 'Télécharger le relevé de présence',
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Se déconnecter',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  const renderPresenceItem = ({ item }: { item: PresenceRecord }) => (
    <View style={styles.presenceItem}>
      <View style={styles.presenceHeader}>
        <Text style={styles.presenceDate}>
          {new Date(item.date).toLocaleDateString('fr-FR')}
        </Text>
        <View style={[
          styles.statusBadge,
          item.etat === 'present' ? styles.statusPresent :
          item.etat === 'absent' ? styles.statusAbsent :
          styles.statusRetard
        ]}>
          <Text style={styles.statusText}>
            {item.etat === 'present' ? 'PRÉSENT' :
             item.etat === 'absent' ? 'ABSENT' : 'RETARD'}
          </Text>
        </View>
      </View>
      <Text style={styles.presenceTime}>
        {item.heure_debut} - {item.heure_fin}
      </Text>
      <Text style={styles.presenceMode}>
        Mode: {item.mode_emargement}
      </Text>
    </View>
  );

  const renderCourseSection = ({ item }: { item: CoursePresence }) => (
    <View style={styles.courseCard}>
      <View style={styles.courseHeader}>
        <Text style={styles.courseTitle}>{item.cours_nom}</Text>
        <View style={styles.courseStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{item.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, styles.statPresent]}>{item.present}</Text>
            <Text style={styles.statLabel}>Présences</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, styles.statAbsent]}>{item.absent}</Text>
            <Text style={styles.statLabel}>Absences</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, styles.statRetard]}>{item.retard}</Text>
            <Text style={styles.statLabel}>Retards</Text>
          </View>
        </View>
      </View>
      
      <FlatList
        data={item.presences}
        renderItem={renderPresenceItem}
        keyExtractor={(presence, index) => `${presence.id_plage}-${presence.date}-${index}`}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  useEffect(() => {
    fetchPresenceData();
  }, [user]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563EB"]} />
        }
      >
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.profileImage}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.prenom || ''} {user?.nom || ''}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            </View>
          </View>
        </View>

        {/* Download PDF Button */}
        <View style={[styles.card, styles.actionCard]}>
          <TouchableOpacity 
            style={[styles.button, downloading && styles.buttonDisabled]} 
            onPress={generatePDF}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" style={styles.buttonIcon} />
            ) : (
              <Ionicons name="download-outline" size={20} color="#fff" style={styles.buttonIcon} />
            )}
            <Text style={styles.buttonText}>
              {downloading ? 'Génération...' : 'Télécharger PDF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Presence Records */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Relevé de Présence</Text>
          <Text style={styles.sectionSubtitle}>
            {presenceData.length} cours • {presenceData.reduce((total, course) => total + course.total, 0)} séances
          </Text>
        </View>

        {presenceData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>Aucune donnée de présence disponible</Text>
          </View>
        ) : (
          <FlatList
            data={presenceData}
            renderItem={renderCourseSection}
            keyExtractor={(course, index) => `${course.cours_nom}-${index}`}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Logout Button */}
        <View style={[styles.card, styles.actionCard, styles.logoutCard]}>
          <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ccc',
    marginRight: 18,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 15,
    color: '#64748B',
  },
  actionCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 18,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    justifyContent: 'center',
    flex: 1,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  logoutButton: {
    backgroundColor: '#DC2626',
  },
  logoutCard: {
    marginTop: 20,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  courseHeader: {
    marginBottom: 16,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  courseStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  statPresent: {
    color: '#28A745',
  },
  statAbsent: {
    color: '#DC3545',
  },
  statRetard: {
    color: '#FFC107',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  presenceItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  presenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  presenceDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPresent: {
    backgroundColor: '#D1FAE5',
  },
  statusAbsent: {
    backgroundColor: '#FEE2E2',
  },
  statusRetard: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  presenceTime: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  presenceMode: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  scrollViewContent: {
    padding: 20,
  },
});
