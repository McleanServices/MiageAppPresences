import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { useSession } from '../../Session/ctx';
import { useStorageState } from '../../Session/useStorageState';
import CryptoJS from 'crypto-js';

const QR_ENCRYPTION_KEY = 'fghtyftfytfjhftdftyuyggkjyuygu'; // Match server key
const APP_SIGNATURE = 'miage-presences-v1';

const ScanCodeScreen = () => {
  const router = useRouter();
  const { user } = useSession();
  const [[, authToken]] = useStorageState('authToken');
  const [hasPermission, setHasPermission] = useState<null | boolean>(null);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState(''); 
  const [navigated, setNavigated] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Add refs to prevent multiple scans
  const isProcessingRef = useRef(false);
  const lastScannedDataRef = useRef<string>('');
  const lastScanTimestampRef = useRef<number>(0);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanIdRef = useRef<number>(0);
  
  // Request camera permission on mount
  useEffect(() => {
    (async () => {
      console.log('📷 Requesting camera permissions...');
      const { status } = await Camera.requestCameraPermissionsAsync();
      console.log('📷 Camera permission status:', status);
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Simplified decryption function - no more AES/UTF-8 issues
  const decryptQRData = (encryptedData: string) => {
    try {
      console.log('🔓 Attempting to decode QR data...');
      console.log('🔍 Data preview:', encryptedData.substring(0, 50) + '...');
      
      // Handle base64 encoded data
      if (encryptedData.startsWith('B64:')) {
        console.log('📦 Using base64 decoding');
        const base64Data = encryptedData.substring(4);
        const jsonString = atob(base64Data); // Simple base64 decode
        const payload = JSON.parse(jsonString);
        
        // Validate app signature
        if (payload.app_signature !== APP_SIGNATURE) {
          throw new Error('Invalid app signature');
        }
        
        console.log('✅ Successfully decoded and validated QR data');
        return payload;
      }
      
      // Legacy support for direct JSON
      console.log('📦 Attempting direct JSON parsing');
      const payload = JSON.parse(encryptedData);
      
      // Validate app signature
      if (payload.app_signature !== APP_SIGNATURE) {
        throw new Error('Invalid app signature');
      }
      
      console.log('✅ Successfully parsed and validated QR data');
      return payload;
      
    } catch (error) {
      console.error('❌ Decoding failed with error:', error);
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('JSON')) {
          throw new Error('QR code invalide - format incorrect');
        }
        if (error.message.includes('signature')) {
          throw new Error('QR code non autorisé');
        }
      }
      
      throw new Error('QR code invalide ou corrompu');
    }
  };

  // Handle scanning the QR code
  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    const scanTimestamp = Date.now();
    const scanId = ++scanIdRef.current;
    
    console.log('🔍 QR Code scanned:', data);
    console.log('🔍 Scan ID:', scanId);
    console.log('🔍 Scan timestamp:', scanTimestamp);
    console.log('🔍 Barcode type:', type);
    console.log('👤 Current user:', user);
    console.log('🔑 Auth token available:', !!authToken);
    
    // Prevent multiple scans of the same data within 2 seconds
    if (lastScannedDataRef.current === data && (scanTimestamp - lastScanTimestampRef.current) < 2000) {
      console.log('⚠️ Duplicate scan detected within 2 seconds, ignoring');
      return;
    }
    
    // Prevent multiple simultaneous processing
    if (isProcessingRef.current || scanned || navigated || loading) {
      console.log('⚠️ Scan ignored - already processing or navigated');
      return;
    }
    
    // Immediately set processing flags to prevent further scans
    isProcessingRef.current = true;
    setScanned(true);
    setLoading(true);
    lastScannedDataRef.current = data;
    lastScanTimestampRef.current = scanTimestamp;
    
    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    // Add debounce delay
    scanTimeoutRef.current = setTimeout(async () => {
      console.log('⏰ Timeout triggered - starting QR processing for scan ID:', scanId);
      try {
        setError('');
        console.log('📋 Validating QR code format...');
        
        let qrPayload;
        try {
          // Check if it's our custom URL scheme
          if (data.startsWith('miagepresences://scan?data=')) {
            console.log('🔗 Processing custom URL scheme');
            const encryptedData = decodeURIComponent(data.replace('miagepresences://scan?data=', ''));
            qrPayload = decryptQRData(encryptedData);
          } else {
            // Legacy support for direct JSON (should be removed in production)
            console.log('⚠️ Legacy QR format detected');
            qrPayload = JSON.parse(data);
            
            // Validate app signature even for legacy format
            if (qrPayload.app_signature !== APP_SIGNATURE) {
              throw new Error('QR code non autorisé');
            }
          }
          
          console.log('📦 Parsed QR payload:', qrPayload);
          
          // Validate required fields
          if (!qrPayload.token || !qrPayload.seance || !qrPayload.plage) {
            console.log('❌ Missing required fields in QR payload');
            throw new Error('QR Code invalide. Données manquantes.');
          }
          
          // Validate expiration
          if (qrPayload.expires_at && new Date(qrPayload.expires_at) < new Date()) {
            throw new Error('QR Code expiré');
          }
          
        } catch (parseError) {
          console.log('❌ Failed to process QR data:', parseError);
          throw new Error(parseError instanceof Error ? parseError.message : 'QR Code invalide. Format non reconnu.');
        }

        console.log('✅ QR format valid, preparing navigation...');

        // Set navigated flag to prevent further processing
        setNavigated(true);
        console.log('🚀 Setting navigated flag to true');

        // Add device info for validation
        const deviceInfo = {
          app_version: Constants.expoConfig?.version || '1.0.0',
          platform: Platform.OS,
          app_name: 'MiagePresences',
          app_signature: APP_SIGNATURE
        };
        
        // Add fresh data identifiers to ensure uniqueness
        const navigationParams = {
          qrPayload: JSON.stringify(qrPayload),
          originalQrData: data,
          deviceInfo: JSON.stringify(deviceInfo),
          scanId: scanId.toString(),
          scanTimestamp: scanTimestamp.toString(),
          freshDataToken: Math.random().toString(36).substring(2, 15) // Random token for freshness
        };
        
        console.log('🧭 Navigating to confirmation modal with fresh scan data');
        console.log('📊 Navigation params keys:', Object.keys(navigationParams));
        
        // Use replace instead of push to ensure fresh navigation
        router.replace({
          pathname: '/emarger/confirm-presence',
          params: navigationParams
        });
        
        console.log('✅ Navigation initiated successfully with scan ID:', scanId);
      } catch (err) {
        console.log('💥 Error caught:', err);
        const errorMessage = err instanceof Error ? err.message : 'Erreur réseau lors de la validation';
        console.log('📝 Setting error message:', errorMessage);
        setError(errorMessage);
        
        // Show error for 3 seconds then allow rescan
        setTimeout(() => {
          console.log('🔄 Resetting scan state for retry');
          setScanned(false);
          setError('');
          setLoading(false);
          isProcessingRef.current = false;
          lastScannedDataRef.current = '';
          lastScanTimestampRef.current = 0;
        }, 3000);
      } finally {
        console.log('🏁 Scan process completed for scan ID:', scanId);
        if (!navigated) {
          setLoading(false);
        }
      }
    }, 100);
  };

  const handleClose = () => {
    router.back();
  };

  const resetScanState = () => {
    console.log('🔄 Resetting scan state');
    setScanned(false);
    setError('');
    setLoading(false);
    setNavigated(false);
    isProcessingRef.current = false;
    lastScannedDataRef.current = '';
    lastScanTimestampRef.current = 0;
    scanIdRef.current = 0;
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  };

  useFocusEffect(() => {
    console.log('🎯 Camera screen focused');
    console.log('📷 Camera permission state:', hasPermission);
    console.log('👤 User state:', user);
    console.log('🔑 Auth token state:', !!authToken);
    
    if (hasPermission === null || hasPermission === false) {
      console.log('⚠️ Camera not ready - permission issue');
      return;
    }
    
    console.log('✅ Camera ready for scanning');
    
    // Don't automatically reset state on focus - let the scan process complete
    // Only reset if we're not in the middle of processing
    if (!isProcessingRef.current && !scanned && !loading && !navigated) {
      console.log('🔄 Initial clean state - ready for scanning');
    } else {
      console.log('⏸️ Keeping existing state - scan in progress');
    }
    
    return () => {
      console.log('👋 Camera screen unfocused');
      
      // Only reset state if we're not in the middle of processing a scan
      if (!isProcessingRef.current && !navigated) {
        console.log('🔄 Resetting state on unfocus');
        setScanned(false);
        setNavigated(false);
        setError('');
        setLoading(false);
        
        // Reset refs
        lastScannedDataRef.current = '';
        lastScanTimestampRef.current = 0;
        scanIdRef.current = 0;
        
        // Clear timeout
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
      } else {
        console.log('⏸️ Keeping state - scan in progress or navigation occurred');
      }
    };
  });

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Demande d&apos;accès à la caméra...</Text>
      </View>
    );
  }
  
  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.errorText}>Accès à la caméra refusé</Text>
        <Text style={styles.permissionSubtext}>
          Veuillez autoriser l&apos;accès à la caméra dans les paramètres de votre appareil pour scanner les QR codes.
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>Fermer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <CameraView
        style={styles.camera}
        onBarcodeScanned={(scanned || loading || navigated) ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />
      
      {/* Header with close button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>Scanner QR Code</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Scanning frame overlay */}
      <View style={styles.scanFrame}>
        <View style={styles.cornerTopLeft} />
        <View style={styles.cornerTopRight} />
        <View style={styles.cornerBottomLeft} />
        <View style={styles.cornerBottomRight} />
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsText}>
          Positionnez le QR code dans le cadre
        </Text>
        <Text style={styles.subInstructionsText}>
          La caméra détectera automatiquement le code
        </Text>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Validation en cours...</Text>
        </View>
      )}

      {/* Error message */}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="white" />
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      ) : null}

      {/* Rescan button */}
      {scanned && !navigated && !loading && (
        <View style={styles.bottomContainer}>
          <TouchableOpacity 
            style={styles.rescanButton} 
            onPress={() => {
              console.log('🔄 Manual reset - allowing rescan');
              setScanned(false);
              setError('');
              setLoading(false);
              setNavigated(false);
              isProcessingRef.current = false;
              lastScannedDataRef.current = '';
              lastScanTimestampRef.current = 0;
              scanIdRef.current = 0;
              if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
                scanTimeoutRef.current = null;
              }
            }}
          >
            <Text style={styles.rescanButtonText}>Scanner à nouveau</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  scanFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 250,
    height: 250,
    marginLeft: -125,
    marginTop: -125,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#2563EB',
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#2563EB',
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#2563EB',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#2563EB',
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  instructionsText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  subInstructionsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  loadingContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#ff4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorMessage: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  rescanButton: {
    backgroundColor: '#58cc02',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  rescanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
});


export default ScanCodeScreen;
