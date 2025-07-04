import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSession } from '../../Session/ctx';
import { useStorageState } from '../../Session/useStorageState';

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
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Request camera permission on mount
  useEffect(() => {
    (async () => {
      console.log('📷 Requesting camera permissions...');
      const { status } = await Camera.requestCameraPermissionsAsync();
      console.log('📷 Camera permission status:', status);
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Handle scanning the QR code
  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    console.log('🔍 QR Code scanned:', data);
    console.log('🔍 Barcode type:', type);
    console.log('👤 Current user:', user);
    console.log('🔑 Auth token available:', !!authToken);
    
    // Prevent multiple scans of the same data
    if (lastScannedDataRef.current === data) {
      console.log('⚠️ Duplicate scan detected, ignoring');
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
    
    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    // Add debounce delay
    scanTimeoutRef.current = setTimeout(async () => {
      console.log('⏰ Timeout triggered - starting QR processing');
      try {
        setError('');

        console.log('📋 Validating QR code format...');
        
        // Parse the QR data - it should be a JSON string from the backend
        let qrPayload;
        try {
          qrPayload = JSON.parse(data);
          console.log('📦 Parsed QR payload:', qrPayload);
          
          // Validate required fields
          if (!qrPayload.token || !qrPayload.seance || !qrPayload.plage) {
            console.log('❌ Missing required fields in QR payload');
            throw new Error('QR Code invalide. Données manquantes.');
          }
        } catch (parseError) {
          console.log('❌ Failed to parse QR data as JSON:', parseError);
          throw new Error('QR Code invalide. Format non reconnu.');
        }

        console.log('✅ QR format valid, preparing navigation...');
        console.log('📤 QR payload:', qrPayload);

        // Set navigated flag to prevent further processing
        setNavigated(true);
        console.log('🚀 Setting navigated flag to true');

        // Navigate directly to confirmation modal without API call
        const navigationParams = {
          qrPayload: JSON.stringify(qrPayload),
          originalQrData: data, // Pass the original QR data string
        };
        
        console.log('🧭 Navigating to confirmation modal with QR data');
        
        router.push({
          pathname: '/emarger/confirm-presence',
          params: navigationParams
        });
        
        console.log('✅ Navigation initiated successfully');
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
        }, 3000);
      } finally {
        console.log('🏁 Scan process completed');
        if (!navigated) {
          setLoading(false);
        }
      }
    }, 100); // 100ms debounce delay - reduced to prevent interruption
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
